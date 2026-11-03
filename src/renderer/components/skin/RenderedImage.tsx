import { useEffect, useState, type CSSProperties } from 'react';

interface RenderedImageProps {
  source: string | null;
  render: (source: string) => Promise<string>;
  style?: CSSProperties;
  className?: string;
}

export function RenderedImage({ source, render, style, className }: RenderedImageProps) {
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    if (!source) return;
    render(source)
      .then((image) => !cancelled && setResult(image))
      .catch(() => !cancelled && setResult(null));
    return () => {
      cancelled = true;
    };
  }, [source, render]);

  if (!result) return <span className={className} style={style} aria-hidden="true" />;
  return <img src={result} alt="" draggable={false} className={className} style={{ imageRendering: 'pixelated', ...style }} />;
}
