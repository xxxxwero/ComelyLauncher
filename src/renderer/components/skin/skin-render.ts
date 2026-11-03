export type Region = [x: number, y: number, width: number, height: number];

interface Part {
  base: Region;
  overlay: Region | null;
  target: [x: number, y: number];
  mirrorOf?: Region;
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

function drawRegion(context: CanvasRenderingContext2D, image: HTMLImageElement, region: Region, target: [number, number], scale: number, mirror = false): void {
  const [x, y, width, height] = region;
  context.save();
  if (mirror) {
    context.translate((target[0] + width) * scale, target[1] * scale);
    context.scale(-1, 1);
    context.drawImage(image, x, y, width, height, 0, 0, width * scale, height * scale);
  } else {
    context.drawImage(image, x, y, width, height, target[0] * scale, target[1] * scale, width * scale, height * scale);
  }
  context.restore();
}

export async function renderFace(source: string, size: number): Promise<string> {
  const image = await loadImage(source);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return source;
  context.imageSmoothingEnabled = false;
  const scale = size / 8;
  drawRegion(context, image, [8, 8, 8, 8], [0, 0], scale);
  drawRegion(context, image, [40, 8, 8, 8], [0, 0], scale);
  return canvas.toDataURL('image/png');
}

export async function renderCape(source: string, scale = 6): Promise<string> {
  const image = await loadImage(source);
  const unit = image.width / 64;
  const canvas = document.createElement('canvas');
  canvas.width = 10 * scale;
  canvas.height = 16 * scale;
  const context = canvas.getContext('2d');
  if (!context) return source;
  context.imageSmoothingEnabled = false;
  context.drawImage(image, unit, unit, 10 * unit, 16 * unit, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

export async function renderFront(source: string, slim: boolean, scale = 8): Promise<string> {
  const image = await loadImage(source);
  const modern = image.height >= 64;
  const armWidth = slim ? 3 : 4;
  const canvas = document.createElement('canvas');
  canvas.width = 16 * scale;
  canvas.height = 32 * scale;
  const context = canvas.getContext('2d');
  if (!context) return source;
  context.imageSmoothingEnabled = false;
  const rightArm: Region = [44, 20, armWidth, 12];
  const rightLeg: Region = [4, 20, 4, 12];
  const parts: Part[] = [
    { base: [8, 8, 8, 8], overlay: [40, 8, 8, 8], target: [4, 0] },
    { base: [20, 20, 8, 12], overlay: modern ? [20, 36, 8, 12] : null, target: [4, 8] },
    { base: rightArm, overlay: modern ? [44, 36, armWidth, 12] : null, target: [4 - armWidth, 8] },
    { base: modern ? [36, 52, armWidth, 12] : rightArm, overlay: modern ? [52, 52, armWidth, 12] : null, target: [12, 8], mirrorOf: modern ? undefined : rightArm },
    { base: rightLeg, overlay: modern ? [4, 36, 4, 12] : null, target: [4, 20] },
    { base: modern ? [20, 52, 4, 12] : rightLeg, overlay: modern ? [4, 52, 4, 12] : null, target: [8, 20], mirrorOf: modern ? undefined : rightLeg }
  ];
  for (const part of parts) {
    drawRegion(context, image, part.base, part.target, scale, Boolean(part.mirrorOf));
    if (part.overlay) drawRegion(context, image, part.overlay, part.target, scale);
  }
  return canvas.toDataURL('image/png');
}
