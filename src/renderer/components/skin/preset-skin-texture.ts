type Region = [x: number, y: number, width: number, height: number];

interface PresetPalette {
  hair: string;
  skin: string;
  shirt: string;
  shirtShade: string;
  pants: string;
  shoes: string;
  eyes: string;
}

const PALETTES: PresetPalette[] = [
  { hair: '#B8430F', skin: '#E8A87C', shirt: '#F25C05', shirtShade: '#C94A04', pants: '#F5D4B0', shoes: '#2A1D15', eyes: '#3A2A20' },
  { hair: '#2A1A12', skin: '#E8A87C', shirt: '#2A2F3A', shirtShade: '#20242D', pants: '#3A2A20', shoes: '#1A120D', eyes: '#2A1A12' },
  { hair: '#1E120C', skin: '#8A5030', shirt: '#F5D9BC', shirtShade: '#DFC09E', pants: '#F25C05', shoes: '#3A2214', eyes: '#1E120C' },
  { hair: '#D9A84E', skin: '#E8A87C', shirt: '#3E7D46', shirtShade: '#316439', pants: '#5E3F28', shoes: '#2A1D15', eyes: '#3A2A20' },
  { hair: '#6A3A8C', skin: '#EBB08A', shirt: '#241A1E', shirtShade: '#1B1316', pants: '#1E181C', shoes: '#151012', eyes: '#2A1A12' },
  { hair: '#4A2C1A', skin: '#B87650', shirt: '#C83A22', shirtShade: '#A32E1A', pants: '#2A2F3A', shoes: '#1A120D', eyes: '#2A1A12' }
];

const TEXTURE_SIZE = 64;

const LIMB_FACES = (x: number, y: number): Region[] => [
  [x + 4, y, 4, 4],
  [x + 8, y, 4, 4],
  [x, y + 4, 4, 12],
  [x + 4, y + 4, 4, 12],
  [x + 8, y + 4, 4, 12],
  [x + 12, y + 4, 4, 12]
];

function fill(context: CanvasRenderingContext2D, color: string, regions: Region[]): void {
  context.fillStyle = color;
  for (const [x, y, width, height] of regions) context.fillRect(x, y, width, height);
}

function drawHead(context: CanvasRenderingContext2D, palette: PresetPalette): void {
  fill(context, palette.skin, [[8, 8, 8, 8], [0, 8, 8, 8], [16, 8, 8, 8], [16, 0, 8, 8]]);
  fill(context, palette.hair, [[8, 0, 8, 8], [24, 8, 8, 8], [8, 8, 8, 2], [0, 8, 8, 4], [16, 8, 8, 4]]);
  fill(context, '#FFFFFF', [[9, 12, 2, 1], [13, 12, 2, 1]]);
  fill(context, palette.eyes, [[10, 12, 1, 1], [13, 12, 1, 1]]);
  fill(context, palette.shirtShade === palette.skin ? palette.hair : '#00000033', [[11, 14, 2, 1]]);
}

function drawBody(context: CanvasRenderingContext2D, palette: PresetPalette): void {
  fill(context, palette.shirt, [[20, 16, 8, 4], [28, 16, 8, 4], [16, 20, 4, 12], [20, 20, 8, 12], [28, 20, 4, 12], [32, 20, 8, 12]]);
  fill(context, palette.shirtShade, [[20, 28, 8, 1], [23, 20, 2, 5]]);
  fill(context, palette.pants, [[20, 30, 8, 2]]);
}

function drawArm(context: CanvasRenderingContext2D, palette: PresetPalette, x: number, y: number): void {
  fill(context, palette.shirt, LIMB_FACES(x, y));
  fill(context, palette.skin, [[x + 8, y, 4, 4], [x, y + 14, 16, 2]]);
}

function drawLeg(context: CanvasRenderingContext2D, palette: PresetPalette, x: number, y: number): void {
  fill(context, palette.pants, LIMB_FACES(x, y));
  fill(context, palette.shoes, [[x + 8, y, 4, 4], [x, y + 14, 16, 2]]);
}

export function presetSkinTexture(preset: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const context = canvas.getContext('2d');
  if (!context) return '';
  const palette = PALETTES[Math.abs(preset) % PALETTES.length];
  drawHead(context, palette);
  drawBody(context, palette);
  drawArm(context, palette, 40, 16);
  drawArm(context, palette, 32, 48);
  drawLeg(context, palette, 0, 16);
  drawLeg(context, palette, 16, 48);
  return canvas.toDataURL('image/png');
}
