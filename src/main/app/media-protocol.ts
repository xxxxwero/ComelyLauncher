import { createHash } from 'node:crypto';
import { nativeImage, net, protocol } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { MEDIA_SCHEME, MEDIA_THUMBNAIL_PARAM } from '../../shared/media-url';
import { userDataPath } from '../core/app-paths';
import { isInside, pathExists, writeFileAtomic } from '../core/file-system';

const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const THUMBNAIL_SIZE = { width: 480, height: 270 };
const THUMBNAIL_QUALITY = 78;

async function thumbnailFile(filePath: string): Promise<string> {
  const { mtimeMs } = await fs.stat(filePath);
  const name = createHash('sha1').update(`${filePath}|${mtimeMs}`).digest('hex');
  const target = userDataPath('thumbnails', `${name}.jpg`);
  if (await pathExists(target)) return target;
  const image = await nativeImage.createThumbnailFromPath(filePath, THUMBNAIL_SIZE);
  await writeFileAtomic(target, image.toJPEG(THUMBNAIL_QUALITY));
  return target;
}

export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: MEDIA_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
  ]);
}

export function handleMediaProtocol(allowedRoots: () => string[]): void {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    const url = new URL(request.url);
    const filePath = path.resolve(decodeURIComponent(url.pathname.slice(1)));
    const allowed = ALLOWED_EXTENSIONS.has(path.extname(filePath).toLowerCase()) && allowedRoots().some((root) => isInside(root, filePath));
    if (!allowed) return new Response('Forbidden', { status: 403 });
    const wantsThumbnail = url.searchParams.has(MEDIA_THUMBNAIL_PARAM);
    const servedFile = wantsThumbnail ? await thumbnailFile(filePath).catch(() => filePath) : filePath;
    return net.fetch(pathToFileURL(servedFile).toString());
  });
}
