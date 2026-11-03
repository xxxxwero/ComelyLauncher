import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = join(root, 'src', 'renderer', 'assets', 'catalog.ts');
const PACKAGING_ASSETS = ['assets/icons/comelylauncher.ico', 'assets/icons/comelylauncher-icon-256.png'];
const ICON_COLOR = [96, 96, 104];
const IMAGE_COLOR = [38, 38, 44];
const IMAGE_SIZE = 64;
const ICON_SIZE = 256;

function pngChunk(type, data) {
  const typed = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, checksum]);
}

function solidPng(size, [red, green, blue]) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;
  const row = Buffer.alloc(1 + size * 3);
  for (let pixel = 0; pixel < size; pixel++) row.set([red, green, blue], 1 + pixel * 3);
  const pixels = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(pixels)),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function solidIco(size, color) {
  const png = solidPng(size, color);
  const directory = Buffer.alloc(22);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(1, 4);
  directory.writeUInt16LE(1, 10);
  directory.writeUInt16LE(32, 12);
  directory.writeUInt32LE(png.length, 14);
  directory.writeUInt32LE(directory.length, 18);
  return Buffer.concat([directory, png]);
}

function placeholderFor(relativePath) {
  if (relativePath.endsWith('.ico')) return solidIco(ICON_SIZE, ICON_COLOR);
  const iconSize = relativePath.match(/-icon-(\d+)\.png$/);
  if (iconSize) return solidPng(Number(iconSize[1]), ICON_COLOR);
  return solidPng(IMAGE_SIZE, IMAGE_COLOR);
}

const imported = [...readFileSync(catalog, 'utf8').matchAll(/assets\/[^'"]+/g)].map((match) => match[0]);
const missing = [...new Set([...imported, ...PACKAGING_ASSETS])].filter((file) => !existsSync(join(root, file)));

for (const file of missing) {
  const target = join(root, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, placeholderFor(file));
}

if (missing.length > 0) console.log(`Created ${missing.length} neutral placeholder images: the original artwork is not part of this repository`);
