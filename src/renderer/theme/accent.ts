const STORED_ACCENT_KEY = 'comely-accent';

export const DEFAULT_ACCENT = '#F25C05';

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function toHsl(hex: string): Hsl {
  const value = parseInt(hex.slice(1), 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = d / (l > 0.5 ? 2 - max - min : max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

function toRgb({ h, s, l }: Hsl): string {
  const channel = (n: number): number => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return `${channel(0)}, ${channel(8)}, ${channel(4)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function accentPalette(hex: string): Record<string, string> {
  const source = toHsl(/^#[0-9a-f]{6}$/i.test(hex) ? hex : DEFAULT_ACCENT);
  const h = source.h;
  const s = source.s < 0.08 ? 0.08 : clamp(source.s, 0.55, 0.96);
  const l = clamp(source.l, 0.42, 0.56);
  const rgb: Record<string, string> = {
    '--accent-rgb': toRgb({ h, s, l }),
    '--accent-vivid-rgb': toRgb({ h, s, l: l + 0.04 }),
    '--accent-bright-rgb': toRgb({ h, s, l: l + 0.08 }),
    '--accent-soft-rgb': toRgb({ h, s, l: l + 0.14 }),
    '--accent-light-rgb': toRgb({ h, s: s * 0.9, l: Math.min(0.8, l + 0.26) }),
    '--accent-pale-rgb': toRgb({ h, s: s * 0.85, l: 0.88 }),
    '--accent-shade-rgb': toRgb({ h, s, l: l * 0.38 }),
    '--ink-rgb': toRgb({ h, s: Math.min(s, 0.34), l: 0.065 }),
    '--bg-rgb': toRgb({ h, s: Math.min(s, 0.34), l: 0.085 }),
    '--bg-deep-rgb': toRgb({ h, s: Math.min(s, 0.34), l: 0.055 }),
    '--dialog-rgb': toRgb({ h, s: Math.min(s, 0.3), l: 0.095 }),
    '--menu-rgb': toRgb({ h, s: Math.min(s, 0.3), l: 0.12 })
  };
  return rgb;
}

export function applyAccent(hex: string): void {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(accentPalette(hex))) root.style.setProperty(name, value);
  try {
    window.localStorage.setItem(STORED_ACCENT_KEY, hex);
  } catch {
    return;
  }
}

export function applyStoredAccent(): void {
  try {
    const stored = window.localStorage.getItem(STORED_ACCENT_KEY);
    if (stored) applyAccent(stored);
  } catch {
    return;
  }
}
