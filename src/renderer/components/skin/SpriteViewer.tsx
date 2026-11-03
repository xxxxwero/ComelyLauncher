import { useEffect, useRef, useState } from 'react';
import { SPRITE_FRAME_RATIO, SPRITE_FRAMES } from '../../assets/catalog';
import { useI18n } from '../../i18n/i18n';
import { IconButton } from '../ui/Button';
import { Icon } from '../ui/Icon';
import styles from './SkinStage.module.css';

interface SpriteViewerProps {
  sprite: string;
  width: number;
  autoRotate?: boolean;
}

const PIXELS_PER_FRAME = 22;

export function SpriteViewer({ sprite, width, autoRotate = false }: SpriteViewerProps) {
  const { t } = useI18n();
  const [frame, setFrame] = useState(0);
  const drag = useRef<{ x: number; frame: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const height = width * SPRITE_FRAME_RATIO;

  useEffect(() => {
    if (!autoRotate) return;
    const timer = setInterval(() => {
      if (!drag.current) setFrame((value) => (value + 1) % SPRITE_FRAMES);
    }, 140);
    return () => clearInterval(timer);
  }, [autoRotate]);

  const step = (delta: number) => setFrame((value) => (value + delta + SPRITE_FRAMES) % SPRITE_FRAMES);

  return (
    <div
      className={styles.stage}
      style={{ cursor: dragging ? 'grabbing' : 'grab' }}
      onPointerDown={(event) => {
        drag.current = { x: event.clientX, frame };
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (!start) return;
        const next = (((start.frame - Math.round((event.clientX - start.x) / PIXELS_PER_FRAME)) % SPRITE_FRAMES) + SPRITE_FRAMES) % SPRITE_FRAMES;
        setFrame(next);
      }}
      onPointerUp={() => {
        drag.current = null;
        setDragging(false);
      }}
    >
      <div className={styles.shadow} aria-hidden="true" />
      <div role="img" aria-label={t('account.rotation', { angle: frame * 30 })} className={styles.spriteWindow} style={{ width, height, marginLeft: -width / 2 }}>
        <img
          src={sprite}
          alt=""
          draggable={false}
          style={{ display: 'block', width: width * SPRITE_FRAMES, height, maxWidth: 'none', transform: `translateX(-${frame * width}px)`, pointerEvents: 'none' }}
        />
      </div>
      <span className={styles.hint}>
        <Icon name="arrows" size={13} strokeWidth={2.4} />
        {t('account.dragHint')}
      </span>
      <div className={styles.controls}>
        <IconButton icon="chevronLeft" label={t('skins.rotateLeft')} round className={styles.control} onClick={() => step(1)} />
        <IconButton icon="chevronRight" label={t('skins.rotateRight')} round className={styles.control} onClick={() => step(-1)} />
      </div>
    </div>
  );
}
