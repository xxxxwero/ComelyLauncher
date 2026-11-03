import type { CSSProperties } from 'react';
import type { MotdSegment } from '../../../shared/types/media';

interface MotdTextProps {
  line: MotdSegment[];
  style?: CSSProperties;
}

export function MotdText({ line, style }: MotdTextProps) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        fontSize: 12,
        letterSpacing: -0.2,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        ...style
      }}
    >
      {line.map((segment, index) => (
        <span key={index} style={{ color: segment.color ?? '#FFFFFF', fontWeight: segment.bold ? 800 : undefined, fontStyle: segment.italic ? 'italic' : undefined }}>
          {segment.text}
        </span>
      ))}
    </span>
  );
}
