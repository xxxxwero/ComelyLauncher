import type { RendererEvents } from '../../core/renderer-events';
import { Log4jXmlParser } from './log4j-xml-parser';

const MAX_LINES = 5000;

export class GameLogBuffer {
  private lines: string[] = [];
  private pending: string[] = [];
  private partial = '';
  private parser = new Log4jXmlParser();
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly events: RendererEvents) {}

  private secrets: string[] = [];

  reset(secrets: string[] = []): void {
    this.lines = [];
    this.pending = [];
    this.partial = '';
    this.parser = new Log4jXmlParser();
    this.secrets = secrets.filter((secret) => secret.length >= 8);
  }

  setSecrets(secrets: string[]): void {
    this.secrets = secrets.filter((secret) => secret.length >= 8);
  }

  private mask(line: string): string {
    return this.secrets.reduce((result, secret) => result.split(secret).join('<hidden>'), line);
  }

  push(chunk: Buffer, onLine: (line: string) => void): void {
    const text = this.partial + chunk.toString('utf8');
    const parts = text.split(/\r?\n/);
    this.partial = parts.pop() ?? '';
    for (const raw of parts) {
      for (const line of this.parser.accept(raw)) this.append(line, onLine);
    }
  }

  append(raw: string, onLine?: (line: string) => void): void {
    if (!raw.trim()) return;
    const line = this.mask(raw);
    this.lines.push(line);
    if (this.lines.length > MAX_LINES) this.lines.splice(0, this.lines.length - MAX_LINES);
    this.pending.push(line);
    onLine?.(line);
    this.schedule();
  }

  flushPartial(onLine: (line: string) => void): void {
    if (this.partial) {
      for (const line of this.parser.accept(this.partial)) this.append(line, onLine);
    }
    this.partial = '';
  }

  all(): string[] {
    return [...this.lines];
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      const batch = this.pending;
      this.pending = [];
      if (batch.length > 0) this.events.emit('game:log', batch);
    }, 250);
  }
}
