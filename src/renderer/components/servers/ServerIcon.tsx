const PALETTE: Array<[string, string]> = [
  ['#F25C05', '#FFFFFF'],
  ['#FFFFFF', '#1A120D'],
  ['#FF8A3D', '#1A120D'],
  ['#2A1D15', '#FF8A3D'],
  ['#FFD9BF', '#1A120D']
];

function paletteFor(name: string): [string, string] {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

interface ServerIconProps {
  name: string;
  icon: string | null;
  size?: number;
}

export function ServerIcon({ name, icon, size = 44 }: ServerIconProps) {
  const [background, color] = paletteFor(name);
  if (icon) {
    return <img src={icon} alt="" aria-hidden="true" style={{ width: size, height: size, borderRadius: size / 4, flexShrink: 0, imageRendering: 'pixelated' }} />;
  }
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: size / 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background,
        color,
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: size * 0.38
      }}
    >
      {(name.trim().charAt(0) || '?').toUpperCase()}
    </span>
  );
}
