import type { MotdSegment } from '../../shared/types/media';

const NAMED_COLORS: Record<string, string> = {
  black: '#000000',
  dark_blue: '#0000AA',
  dark_green: '#00AA00',
  dark_aqua: '#00AAAA',
  dark_red: '#AA0000',
  dark_purple: '#AA00AA',
  gold: '#FFAA00',
  gray: '#AAAAAA',
  dark_gray: '#555555',
  blue: '#5555FF',
  green: '#55FF55',
  aqua: '#55FFFF',
  red: '#FF5555',
  light_purple: '#FF55FF',
  yellow: '#FFFF55',
  white: '#FFFFFF'
};

const CODE_COLORS: Record<string, string> = {
  '0': '#000000',
  '1': '#0000AA',
  '2': '#00AA00',
  '3': '#00AAAA',
  '4': '#AA0000',
  '5': '#AA00AA',
  '6': '#FFAA00',
  '7': '#AAAAAA',
  '8': '#555555',
  '9': '#5555FF',
  a: '#55FF55',
  b: '#55FFFF',
  c: '#FF5555',
  d: '#FF55FF',
  e: '#FFFF55',
  f: '#FFFFFF'
};

interface Style {
  color: string | null;
  bold: boolean;
  italic: boolean;
}

interface ChatComponent {
  text?: string;
  translate?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  extra?: Array<ChatComponent | string>;
}

function resolveColor(color: string | undefined, fallback: string | null): string | null {
  if (!color) return fallback;
  if (color.startsWith('#')) return color;
  return NAMED_COLORS[color] ?? fallback;
}

function parseLegacy(text: string, base: Style, output: MotdSegment[]): void {
  let style = { ...base };
  let buffer = '';
  const flush = (): void => {
    if (buffer) output.push({ text: buffer, ...style });
    buffer = '';
  };
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '§' && index + 1 < text.length) {
      flush();
      const code = text[++index].toLowerCase();
      if (CODE_COLORS[code]) style = { color: CODE_COLORS[code], bold: false, italic: false };
      else if (code === 'l') style.bold = true;
      else if (code === 'o') style.italic = true;
      else if (code === 'r') style = { ...base };
      continue;
    }
    buffer += char;
  }
  flush();
}

function walk(component: ChatComponent | string, inherited: Style, output: MotdSegment[]): void {
  if (typeof component === 'string') {
    parseLegacy(component, inherited, output);
    return;
  }
  const style: Style = {
    color: resolveColor(component.color, inherited.color),
    bold: component.bold ?? inherited.bold,
    italic: component.italic ?? inherited.italic
  };
  parseLegacy(component.text ?? component.translate ?? '', style, output);
  for (const child of component.extra ?? []) walk(child, style, output);
}

export function parseMotd(description: unknown): MotdSegment[][] {
  const segments: MotdSegment[] = [];
  walk((description ?? '') as ChatComponent | string, { color: null, bold: false, italic: false }, segments);
  const lines: MotdSegment[][] = [[]];
  for (const segment of segments) {
    const parts = segment.text.split('\n');
    parts.forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ ...segment, text: part });
    });
  }
  return lines.filter((line) => line.some((segment) => segment.text.trim().length > 0)).slice(0, 2);
}
