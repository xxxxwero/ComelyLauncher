import { useEffect, useRef, type ReactNode } from 'react';
import { SkinViewer } from 'skinview3d';
import type { SkinModel } from '../../../shared/types/skins';
import { useI18n } from '../../i18n/i18n';
import { cx } from '../../utils/cx';
import { IconButton } from '../ui/Button';
import { Icon } from '../ui/Icon';
import styles from './SkinStage.module.css';

interface SkinViewer3DProps {
  skin: string;
  model: SkinModel;
  cape: string | null;
  autoRotate: boolean;
  onToggleAutoRotate?: () => void;
  badge?: ReactNode;
}

const ROTATE_STEP = Math.PI / 6;

export function SkinViewer3D({ skin, model, cape, autoRotate, onToggleAutoRotate, badge }: SkinViewer3DProps) {
  const { t } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewer = useRef<SkinViewer | null>(null);

  useEffect(() => {
    if (!canvas.current || !container.current) return;
    const instance = new SkinViewer({
      canvas: canvas.current,
      width: container.current.clientWidth,
      height: container.current.clientHeight,
      zoom: 0.82,
      fov: 50,
      renderPaused: true
    });
    instance.controls.enableZoom = false;
    instance.controls.enablePan = false;
    instance.autoRotateSpeed = 1.4;
    viewer.current = instance;
    const redraw = (): void => instance.render();
    instance.controls.addEventListener('change', redraw);
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width <= 0 || height <= 0) return;
      instance.setSize(width, height);
      instance.render();
    });
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      instance.controls.removeEventListener('change', redraw);
      instance.dispose();
      viewer.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = viewer.current;
    if (!instance) return;
    instance.loadSkin(skin, { model: model === 'slim' ? 'slim' : 'default' })?.then(() => instance.render()).catch(() => undefined);
  }, [skin, model]);

  useEffect(() => {
    const instance = viewer.current;
    if (!instance) return;
    if (cape) instance.loadCape(cape)?.then(() => instance.render()).catch(() => undefined);
    else {
      instance.loadCape(null);
      instance.render();
    }
  }, [cape]);

  useEffect(() => {
    const instance = viewer.current;
    if (!instance) return;
    instance.autoRotate = autoRotate;
    instance.renderPaused = !autoRotate;
    if (!autoRotate) instance.render();
  }, [autoRotate]);

  const rotate = (direction: number): void => {
    const instance = viewer.current;
    if (!instance) return;
    instance.playerObject.rotation.y += direction * ROTATE_STEP;
    instance.render();
  };

  return (
    <div className={styles.stage}>
      <div className={styles.shadow} aria-hidden="true" />
      <div ref={container} className={styles.canvasWrap} style={{ cursor: 'grab' }}>
        <canvas ref={canvas} />
      </div>
      <span className={styles.hint}>
        <Icon name="arrows" size={13} strokeWidth={2.4} />
        {t('skins.dragHint')}
      </span>
      {badge}
      <div className={styles.controls}>
        {onToggleAutoRotate && (
          <IconButton icon="refresh" label={t('skins.autoRotate')} round aria-pressed={autoRotate} className={cx(styles.control, autoRotate && styles.controlActive)} onClick={onToggleAutoRotate} />
        )}
        <IconButton icon="chevronLeft" label={t('skins.rotateLeft')} round className={styles.control} onClick={() => rotate(-1)} />
        <IconButton icon="chevronRight" label={t('skins.rotateRight')} round className={styles.control} onClick={() => rotate(1)} />
      </div>
    </div>
  );
}
