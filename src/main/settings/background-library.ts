import { randomBytes } from 'node:crypto';
import { nativeImage, type NativeImage } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { CustomBackground, LauncherSettings } from '../../shared/types/settings';
import { userDataPath } from '../core/app-paths';
import { createLogger } from '../core/logger';
import type { SettingsService } from './settings-service';

const MAX_BACKGROUND_WIDTH = 2560;
const THUMBNAIL_WIDTH = 480;
const BACKGROUND_QUALITY = 90;
const THUMBNAIL_QUALITY = 78;
const ANIMATED_EXTENSION = '.gif';
const DEFAULT_BACKGROUND = 'sakura';
const COLOR_SAMPLE_WIDTH = 32;
const MIN_COLOR_BRIGHTNESS = 50;

const log = createLogger('backgrounds');

function loadStillImage(file: string): NativeImage | null {
  if (path.extname(file).toLowerCase() === ANIMATED_EXTENSION) return null;
  const image = nativeImage.createFromPath(file);
  return image.isEmpty() ? null : image;
}

function dominantColor(image: NativeImage): string | null {
  const small = image.resize({ width: COLOR_SAMPLE_WIDTH, quality: 'good' });
  const pixels = small.toBitmap();
  const bins = new Map<number, { weight: number; r: number; g: number; b: number }>();
  for (let index = 0; index + 3 < pixels.length; index += 4) {
    const b = pixels[index];
    const g = pixels[index + 1];
    const r = pixels[index + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max < MIN_COLOR_BRIGHTNESS || max === 0) continue;
    const saturation = (max - min) / max;
    const weight = saturation * saturation * (max / 255);
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bin = bins.get(key) ?? { weight: 0, r: 0, g: 0, b: 0 };
    bin.weight += weight;
    bin.r += r * weight;
    bin.g += g * weight;
    bin.b += b * weight;
    bins.set(key, bin);
  }
  const top = [...bins.values()].sort((left, right) => right.weight - left.weight)[0];
  if (!top || top.weight <= 0) return null;
  const hex = (value: number): string => Math.round(value / top.weight).toString(16).padStart(2, '0');
  return `#${hex(top.r)}${hex(top.g)}${hex(top.b)}`;
}

function scaleToWidth(image: NativeImage, width: number): NativeImage {
  return image.getSize().width > width ? image.resize({ width, quality: 'good' }) : image;
}

export class BackgroundLibrary {
  private readonly dir = userDataPath('backgrounds');

  constructor(private readonly settings: SettingsService) {}

  async add(files: string[]): Promise<LauncherSettings> {
    await fs.mkdir(this.dir, { recursive: true });
    const added: CustomBackground[] = [];
    for (const file of files) added.push(await this.store(file));
    const { customBackgrounds } = this.settings.get().appearance;
    return this.settings.update({ appearance: { customBackgrounds: [...customBackgrounds, ...added], background: added[added.length - 1].id } });
  }

  async remove(backgroundId: string): Promise<LauncherSettings> {
    const { customBackgrounds, background } = this.settings.get().appearance;
    const removed = customBackgrounds.find((entry) => entry.id === backgroundId);
    const updated = await this.settings.update({
      appearance: {
        customBackgrounds: customBackgrounds.filter((entry) => entry.id !== backgroundId),
        background: background === backgroundId ? DEFAULT_BACKGROUND : background
      }
    });
    if (removed) await Promise.all([removed.path, removed.thumbPath].map((file) => fs.rm(file, { force: true }).catch(() => undefined)));
    return updated;
  }

  async createMissingThumbnails(): Promise<void> {
    const { customBackgrounds } = this.settings.get().appearance;
    let changed = false;
    const next = await Promise.all(
      customBackgrounds.map(async (entry) => {
        const needsThumbnail = entry.thumbPath === entry.path;
        const needsAccent = entry.accent === undefined;
        const image = needsThumbnail || needsAccent ? loadStillImage(entry.path) : null;
        if (!image) {
          if (!needsAccent) return entry;
          changed = true;
          return { ...entry, accent: null };
        }
        changed = true;
        const thumbPath = needsThumbnail ? await this.writeJpeg(scaleToWidth(image, THUMBNAIL_WIDTH), entry.id, 'thumb', THUMBNAIL_QUALITY) : entry.thumbPath;
        return { ...entry, thumbPath, accent: needsAccent ? dominantColor(image) : entry.accent };
      })
    ).catch((error: unknown) => {
      log.warn('Could not create background thumbnails', error);
      return customBackgrounds;
    });
    if (changed) await this.settings.update({ appearance: { customBackgrounds: next } });
  }

  private async store(file: string): Promise<CustomBackground> {
    const id = `custom-${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;
    const name = path.basename(file, path.extname(file));
    const image = loadStillImage(file);
    if (!image) {
      const target = path.join(this.dir, `${id}${path.extname(file).toLowerCase()}`);
      await fs.copyFile(file, target);
      return { id, name, path: target, thumbPath: target, accent: null };
    }
    return {
      id,
      name,
      path: await this.writeJpeg(scaleToWidth(image, MAX_BACKGROUND_WIDTH), id, 'full', BACKGROUND_QUALITY),
      thumbPath: await this.writeJpeg(scaleToWidth(image, THUMBNAIL_WIDTH), id, 'thumb', THUMBNAIL_QUALITY),
      accent: dominantColor(image)
    };
  }

  private async writeJpeg(image: NativeImage, id: string, suffix: string, quality: number): Promise<string> {
    await fs.mkdir(this.dir, { recursive: true });
    const target = path.join(this.dir, `${id}-${suffix}.jpg`);
    await fs.writeFile(target, image.toJPEG(quality));
    return target;
  }
}
