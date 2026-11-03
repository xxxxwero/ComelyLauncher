const INVALID_CHARACTERS = /[<>:"/\\|?*\u0000-\u001f]/g;
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
const MAX_LENGTH = 48;
const FALLBACK_NAME = 'instance';

export function sanitizeFolderName(name: string): string {
  const cleaned = name
    .replace(INVALID_CHARACTERS, '_')
    .slice(0, MAX_LENGTH)
    .replace(/^[\s.]+|[\s.]+$/g, '');
  if (!cleaned) return FALLBACK_NAME;
  return RESERVED_NAMES.test(cleaned) ? `_${cleaned}` : cleaned;
}

export function uniqueFolderName(name: string, taken: Set<string>): string {
  const base = sanitizeFolderName(name);
  let candidate = base;
  for (let suffix = 2; taken.has(candidate.toLowerCase()); suffix++) candidate = `${base} (${suffix})`;
  taken.add(candidate.toLowerCase());
  return candidate;
}
