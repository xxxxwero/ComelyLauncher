import { clipboard, ClipboardItem, nativeImage, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { LauncherError } from '../../shared/errors';
import { mediaThumbnailUrl, mediaUrl } from '../../shared/media-url';
import type { Screenshot } from '../../shared/types/media';
import { isInside, listDirectory } from '../core/file-system';
import type { InstanceService } from '../instances/instance-service';
import type { SettingsService } from '../settings/settings-service';

const IMAGE_PATTERN = /\.(png|jpe?g)$/i;

export class ScreenshotService {
  constructor(
    private readonly settings: SettingsService,
    private readonly instances: InstanceService
  ) {}

  async list(): Promise<Screenshot[]> {
    const result: Screenshot[] = [];
    for (const instance of await this.instances.list()) {
      const dir = path.join(this.instances.dir(instance.id), 'screenshots');
      for (const name of await listDirectory(dir)) {
        if (!IMAGE_PATTERN.test(name)) continue;
        const file = path.join(dir, name);
        const stat = await fs.stat(file).catch(() => null);
        if (!stat?.isFile()) continue;
        result.push({
          path: file,
          url: mediaUrl(file, Math.round(stat.mtimeMs)),
          thumbUrl: mediaThumbnailUrl(file, Math.round(stat.mtimeMs)),
          fileName: name,
          instanceId: instance.id,
          instanceName: instance.name,
          createdAt: stat.mtimeMs,
          sizeBytes: stat.size
        });
      }
    }
    return result.sort((a, b) => b.createdAt - a.createdAt);
  }

  async copy(file: string): Promise<void> {
    const image = nativeImage.createFromPath(this.validate(file));
    if (image.isEmpty()) throw new LauncherError('invalid-input', 'Image cannot be read');
    const png = new Blob([new Uint8Array(image.toPNG())], { type: 'image/png' });
    await clipboard.write([new ClipboardItem({ 'image/png': png })]);
  }

  reveal(file: string): void {
    shell.showItemInFolder(this.validate(file));
  }

  async remove(file: string): Promise<Screenshot[]> {
    const target = this.validate(file);
    await shell.trashItem(target).catch(() => fs.rm(target, { force: true }));
    return this.list();
  }

  private validate(file: string): string {
    const resolved = path.resolve(file);
    if (!isInside(this.settings.gamePaths().profiles, resolved) || !IMAGE_PATTERN.test(resolved)) {
      throw new LauncherError('invalid-input', 'Screenshot path is not allowed');
    }
    return resolved;
  }
}
