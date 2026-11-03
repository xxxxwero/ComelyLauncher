import { useEffect, useRef, useState } from 'react';
import type { AppearanceSettings } from '../../../shared/types/settings';
import { resolveBackground, resolveEffect } from '../../assets/catalog';
import { ParticleLayer } from './ParticleLayer';
import styles from './Layout.module.css';

interface AppBackgroundProps {
  appearance: AppearanceSettings;
  variant: 'hero' | 'inner' | 'overlay';
}

interface Layer {
  key: number;
  src: string;
}

const MAX_SHIFT = 14;
const CROSSFADE_MS = 700;

export function AppBackground({ appearance, variant }: AppBackgroundProps) {
  const source = resolveBackground(appearance).image;
  const [layers, setLayers] = useState<Layer[]>([{ key: 0, src: source }]);
  const stack = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLayers((current) => (current[current.length - 1]?.src === source ? current : [...current.slice(-1), { key: Date.now(), src: source }]));
    const timer = setTimeout(() => setLayers((current) => current.slice(-1)), CROSSFADE_MS);
    return () => clearTimeout(timer);
  }, [source]);

  useEffect(() => {
    const target = stack.current;
    if (!appearance.parallax || !target) return;
    let frame: number | null = null;
    const onMove = (event: MouseEvent): void => {
      if (frame !== null || !document.hasFocus()) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        const x = (event.clientX / window.innerWidth - 0.5) * -MAX_SHIFT * 2;
        const y = (event.clientY / window.innerHeight - 0.5) * -MAX_SHIFT * 2;
        target.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (frame !== null) cancelAnimationFrame(frame);
      target.style.transform = '';
    };
  }, [appearance.parallax]);

  const blurred = variant !== 'hero' && appearance.blurInnerScreens;
  const effect = variant === 'hero' ? resolveEffect(appearance) : null;
  const dimBase = appearance.dimPercent / 100;
  const dim = variant === 'hero' ? dimBase * 0.35 : variant === 'overlay' ? Math.max(dimBase, 0.55) : dimBase;

  return (
    <>
      <div ref={stack} aria-hidden="true" className={styles.backgroundStack}>
        {layers.map((layer, index) => (
          <div
            key={layer.key}
            className={styles.backgroundLayer}
            style={{
              backgroundImage: `url("${layer.src}")`,
              filter: blurred ? 'blur(18px) saturate(1.1)' : 'none',
              transform: `scale(${blurred ? 1.06 : appearance.parallax ? 1.04 : 1})`,
              animation: index === layers.length - 1 && layers.length > 1 ? 'cl-fade 0.7s ease both' : undefined
            }}
          />
        ))}
      </div>
      <div aria-hidden="true" className={styles.backgroundDim} style={{ backgroundColor: `rgba(var(--ink-rgb), ${dim})` }} />
      <div aria-hidden="true" className={styles.homeGradient} style={{ opacity: variant === 'hero' ? 1 : 0 }} />
      <div aria-hidden="true" className={styles.homeBottom} style={{ opacity: variant === 'hero' ? 1 : 0 }} />
      {effect && <ParticleLayer effect={effect} />}
    </>
  );
}
