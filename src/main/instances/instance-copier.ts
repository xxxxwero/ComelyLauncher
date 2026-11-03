import fs from 'node:fs/promises';
import path from 'node:path';
import type { Instance } from '../../shared/types/instances';
import { copyTree, pathExists } from '../core/file-system';
import type { TaskHandle, TaskManager } from '../tasks/task-manager';
import { createInstanceId, type InstanceService } from './instance-service';
import { INSTANCE_META_DIR } from './instance-store';

const SKIPPED_FOLDERS = new Set([INSTANCE_META_DIR, 'logs', 'crash-reports', 'backups']);
const CONTENT_INDEX_FILE = 'content.json';
const MAX_NAME_LENGTH = 48;

export class InstanceCopier {
  constructor(
    private readonly instances: InstanceService,
    private readonly tasks: TaskManager
  ) {}

  async start(instanceId: string, name: string): Promise<string> {
    const source = await this.instances.get(instanceId);
    const task = this.tasks.create({
      kind: 'instance-copy',
      title: { key: 'tasks.copyInstance', params: { name: source.name } },
      instanceId,
      steps: [{ id: 'copy', label: { key: 'tasks.step.copyFiles' } }]
    });
    return this.tasks.runInBackground(task, (handle) => this.copy(source, name.slice(0, MAX_NAME_LENGTH), handle));
  }

  private async copy(source: Instance, name: string, task: TaskHandle): Promise<void> {
    const copyId = createInstanceId();
    const target = await this.instances.reserveFolder(copyId, name);
    const sourceDir = this.instances.dir(source.id);
    task.startStep('copy');
    try {
      await copyTree(sourceDir, target, { exclude: SKIPPED_FOLDERS, signal: task.signal, onProgress: (fraction) => task.setStepProgress('copy', fraction) });
      await this.copyContentIndex(sourceDir, target);
      task.throwIfCancelled();
      await this.instances.create({ name, cover: source.cover, gameVersion: source.gameVersion, loader: source.loader }, copyId);
    } catch (error) {
      await fs.rm(target, { recursive: true, force: true });
      this.instances.releaseFolder(copyId);
      throw error;
    }
    if (source.installedVersionId) await this.instances.markInstalled(copyId, source.installedVersionId, source.loader.version);
  }

  private async copyContentIndex(sourceDir: string, target: string): Promise<void> {
    const index = path.join(sourceDir, INSTANCE_META_DIR, CONTENT_INDEX_FILE);
    if (!(await pathExists(index))) return;
    await fs.mkdir(path.join(target, INSTANCE_META_DIR), { recursive: true });
    await fs.copyFile(index, path.join(target, INSTANCE_META_DIR, CONTENT_INDEX_FILE));
  }
}
