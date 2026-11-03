import { randomUUID } from 'node:crypto';
import { LauncherError, type SerializedLauncherError } from '../../shared/errors';
import type { LocalizedText, TaskKind, TaskSnapshot, TaskStep } from '../../shared/types/tasks';
import type { RendererEvents } from '../core/renderer-events';
import type { DownloadProgress } from '../downloads/download-types';

export interface StepDefinition {
  id: string;
  label: LocalizedText;
  weight?: number;
}

export interface TaskDefinition {
  kind: TaskKind;
  title: LocalizedText;
  instanceId?: string | null;
  steps: StepDefinition[];
}

export class TaskHandle {
  private readonly controller = new AbortController();
  private readonly weights: Map<string, number>;
  private committedBytes = 0;
  private committedTotal = 0;

  constructor(
    readonly snapshot: TaskSnapshot,
    steps: StepDefinition[],
    private readonly notify: (immediate: boolean) => void
  ) {
    this.weights = new Map(steps.map((step) => [step.id, step.weight ?? 1]));
  }

  get id(): string {
    return this.snapshot.id;
  }

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  throwIfCancelled(): void {
    if (this.controller.signal.aborted) throw new LauncherError('cancelled');
  }

  addStep(step: StepDefinition, beforeId?: string): void {
    if (this.snapshot.steps.some((existing) => existing.id === step.id)) return;
    const entry: TaskStep = { id: step.id, label: step.label, state: 'pending', progress: 0 };
    const index = beforeId ? this.snapshot.steps.findIndex((existing) => existing.id === beforeId) : -1;
    if (index >= 0) this.snapshot.steps.splice(index, 0, entry);
    else this.snapshot.steps.push(entry);
    this.weights.set(step.id, step.weight ?? 1);
    this.notify(true);
  }

  startStep(id: string): void {
    for (const step of this.snapshot.steps) {
      if (step.id === id) {
        step.state = 'active';
        step.progress = 0;
      } else if (step.state === 'active') {
        step.state = 'done';
        step.progress = 1;
      }
    }
    this.snapshot.currentFile = null;
    this.recalculate();
    this.notify(true);
  }

  setStepProgress(id: string, fraction: number): void {
    const step = this.snapshot.steps.find((entry) => entry.id === id);
    if (!step) return;
    step.progress = Math.max(0, Math.min(1, fraction));
    this.recalculate();
    this.notify(false);
  }

  completeStep(id: string): void {
    const step = this.snapshot.steps.find((entry) => entry.id === id);
    if (!step) return;
    step.state = 'done';
    step.progress = 1;
    this.recalculate();
    this.notify(true);
  }

  setCurrentFile(file: string | null): void {
    this.snapshot.currentFile = file;
    this.notify(false);
  }

  downloadReporter(stepId: string): (progress: DownloadProgress) => void {
    this.committedBytes = this.snapshot.downloadedBytes;
    this.committedTotal = this.snapshot.totalBytes;
    return (progress) => {
      this.snapshot.downloadedBytes = this.committedBytes + progress.downloadedBytes;
      this.snapshot.totalBytes = this.committedTotal + progress.totalBytes;
      this.snapshot.speedBytesPerSecond = progress.speedBytesPerSecond;
      this.snapshot.currentFile = progress.currentFile;
      const fraction = progress.totalBytes > 0
        ? progress.downloadedBytes / progress.totalBytes
        : progress.totalFiles > 0 ? progress.completedFiles / progress.totalFiles : 1;
      this.setStepProgress(stepId, fraction);
    };
  }

  succeed(): void {
    for (const step of this.snapshot.steps) {
      step.state = 'done';
      step.progress = 1;
    }
    this.finish('done', null);
  }

  fail(error: unknown): void {
    const launcherError = LauncherError.from(error);
    if (launcherError.code === 'cancelled' || this.controller.signal.aborted) this.finish('cancelled', null);
    else this.finish('failed', launcherError.serialize());
  }

  cancel(): void {
    this.controller.abort();
  }

  private finish(state: TaskSnapshot['state'], error: SerializedLauncherError | null): void {
    this.snapshot.state = state;
    this.snapshot.error = error;
    this.snapshot.finishedAt = Date.now();
    this.snapshot.speedBytesPerSecond = 0;
    this.snapshot.currentFile = null;
    this.recalculate();
    this.notify(true);
  }

  private recalculate(): void {
    let total = 0;
    let done = 0;
    for (const step of this.snapshot.steps) {
      const weight = this.weights.get(step.id) ?? 1;
      total += weight;
      done += weight * (step.state === 'done' ? 1 : step.state === 'active' ? step.progress : 0);
    }
    this.snapshot.progress = total > 0 ? done / total : 0;
  }
}

export class TaskManager {
  private readonly tasks = new Map<string, TaskHandle>();
  private emitTimer: NodeJS.Timeout | null = null;

  constructor(private readonly events: RendererEvents) {}

  create(definition: TaskDefinition): TaskHandle {
    if (this.list().some((task) => task.kind === 'instance-move' && task.state === 'running')) throw new LauncherError('game-directory-moving', 'The game folder is being moved');
    const snapshot: TaskSnapshot = {
      id: randomUUID(),
      kind: definition.kind,
      title: definition.title,
      instanceId: definition.instanceId ?? null,
      state: 'running',
      steps: definition.steps.map((step) => ({ id: step.id, label: step.label, state: 'pending', progress: 0 })),
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      speedBytesPerSecond: 0,
      currentFile: null,
      error: null,
      startedAt: Date.now(),
      finishedAt: null
    };
    const handle = new TaskHandle(snapshot, definition.steps, (immediate) => this.scheduleEmit(immediate));
    this.tasks.set(snapshot.id, handle);
    this.scheduleEmit(true);
    return handle;
  }

  async run<T>(handle: TaskHandle, work: (task: TaskHandle) => Promise<T>): Promise<T> {
    try {
      const result = await work(handle);
      handle.succeed();
      return result;
    } catch (error) {
      handle.fail(error);
      throw error;
    }
  }

  runInBackground(handle: TaskHandle, work: (task: TaskHandle) => Promise<unknown>): string {
    this.run(handle, work).catch(() => undefined);
    return handle.id;
  }

  get(taskId: string): TaskSnapshot | null {
    return this.tasks.get(taskId)?.snapshot ?? null;
  }

  list(): TaskSnapshot[] {
    return [...this.tasks.values()].map((handle) => handle.snapshot);
  }

  cancel(taskId: string): void {
    this.tasks.get(taskId)?.cancel();
  }

  dismiss(taskId: string): TaskSnapshot[] {
    const handle = this.tasks.get(taskId);
    if (handle && handle.snapshot.state !== 'running') this.tasks.delete(taskId);
    this.scheduleEmit(true);
    return this.list();
  }

  private scheduleEmit(immediate: boolean): void {
    if (immediate) {
      if (this.emitTimer) clearTimeout(this.emitTimer);
      this.emitTimer = null;
      this.events.emit('tasks:changed', structuredClone(this.list()));
      return;
    }
    if (this.emitTimer) return;
    this.emitTimer = setTimeout(() => {
      this.emitTimer = null;
      this.events.emit('tasks:changed', structuredClone(this.list()));
    }, 150);
  }
}
