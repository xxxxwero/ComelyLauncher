import type { CSSProperties, ReactElement } from 'react';

const STROKE_ICONS = {
  home: <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  instances: (
    <>
      <path d="M21 7.5l-9-4.5-9 4.5 9 4.5z" />
      <path d="M3 7.5v9l9 4.5 9-4.5v-9" />
      <path d="M12 12v9" />
    </>
  ),
  versions: (
    <>
      <path d="M12 3l9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  content: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <path d="M17.25 3v7.5M13.5 6.75H21" />
    </>
  ),
  skins: <path d="M8.5 3L3 6l2 5 2.5-1V21h9V10l2.5 1 2-5-5.5-3c-.6 1.5-2 2.5-3.5 2.5S9.1 4.5 8.5 3z" />,
  screenshots: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="2" />
      <path d="M21 15.5l-4.5-4.5L8 19.5" />
    </>
  ),
  account: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </>
  ),
  settings: (
    <>
      <path d="M4 6h9M19 6h1M4 12h3M13 12h7M4 18h11M21 18h-1" />
      <circle cx="16" cy="6" r="2.5" />
      <circle cx="10" cy="12" r="2.5" />
      <circle cx="17.5" cy="18" r="2.5" />
    </>
  ),
  chevronRight: <path d="M9 6l6 6-6 6" />,
  chevronLeft: <path d="M15 5l-7 7 7 7" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  download: (
    <>
      <path d="M12 4v11M7 10l5 5 5-5" />
      <path d="M4 19h16" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4M6.5 9.5L12 4l5.5 5.5" />
      <path d="M4 16v3a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-3" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M20 4v5h-5" />
    </>
  ),
  trash: <path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13" />,
  swap: <path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  warning: (
    <>
      <path d="M12 3.5L2.5 20h19z" />
      <path d="M12 10v4.5M12 17.2v.3" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </>
  ),
  arrows: <path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4" />,
  server: (
    <>
      <rect x="3" y="4" width="18" height="7" rx="2" />
      <rect x="3" y="13" width="18" height="7" rx="2" />
      <path d="M7 7.5h.01M7 16.5h.01" />
    </>
  ),
  world: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.500 5.500 12 3z" />
    </>
  ),
  support: <path d="M21 12a8 8 0 0 1-8 8H6l-3 2v-10a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  terminal: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <path d="M7 9.5l3 2.5-3 2.5M12.5 15H17" />
    </>
  ),
  minimizeTray: <path d="M5 19h14M12 4v11M7.5 10.5L12 15l4.5-4.5" />
} satisfies Record<string, ReactElement>;

const FILL_ICONS = {
  play: <path d="M7 4.5v15l12.5-7.5z" />,
  more: (
    <>
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </>
  )
} satisfies Record<string, ReactElement>;

export type IconName = keyof typeof STROKE_ICONS | keyof typeof FILL_ICONS;

function isFillIcon(name: IconName): name is keyof typeof FILL_ICONS {
  return name in FILL_ICONS;
}

interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}

export function Icon({ name, size = 20, strokeWidth = 2, color = 'currentColor', className, style }: IconProps) {
  const filled = isFillIcon(name) ? FILL_ICONS[name] : null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      style={{ flexShrink: 0, ...style }}
      fill={filled ? color : 'none'}
      stroke={filled ? 'none' : color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {filled ?? STROKE_ICONS[name as keyof typeof STROKE_ICONS]}
    </svg>
  );
}

export function WindowGlyph({ kind }: { kind: 'minimize' | 'maximize' | 'restore' | 'close' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
      {kind === 'minimize' && <path d="M2 7h10" />}
      {kind === 'maximize' && <rect x="2.5" y="2.5" width="9" height="9" rx="1.5" />}
      {kind === 'restore' && (
        <>
          <rect x="2.5" y="4.5" width="7" height="7" rx="1.2" />
          <path d="M5 4.5V3.7A1.2 1.2 0 0 1 6.2 2.5h4.1a1.2 1.2 0 0 1 1.2 1.2v4.1A1.2 1.2 0 0 1 10.3 9H9.5" />
        </>
      )}
      {kind === 'close' && <path d="M3 3l8 8M11 3l-8 8" />}
    </svg>
  );
}
