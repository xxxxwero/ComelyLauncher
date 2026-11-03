import { useEffect, useRef } from 'react';
import { SkinViewer, WalkingAnimation } from 'skinview3d';
import type { SkinModel } from '../../../shared/types/skins';

interface WalkingSkinProps {
  skin: string;
  model: SkinModel;
  walking: boolean;
  width: number;
  height: number;
  className?: string;
}

const FRAME_INTERVAL_MS = 1000 / 30;
const FACING_ANGLE = -0.5;
const WALK_SPEED = 0.85;

export function WalkingSkin({ skin, model, walking, width, height, className }: WalkingSkinProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewer = useRef<SkinViewer | null>(null);
  const animation = useRef<WalkingAnimation | null>(null);

  useEffect(() => {
    if (!canvas.current) return;
    const instance = new SkinViewer({ canvas: canvas.current, width, height, zoom: 0.9, fov: 40, renderPaused: true });
    instance.controls.enabled = false;
    instance.playerObject.rotation.y = FACING_ANGLE;
    const walk = new WalkingAnimation();
    walk.speed = WALK_SPEED;
    walk.headBobbing = true;
    viewer.current = instance;
    animation.current = walk;
    walk.update(instance.playerObject, 0);
    instance.render();
    return () => {
      viewer.current = null;
      animation.current = null;
      instance.dispose();
    };
  }, [width, height]);

  useEffect(() => {
    const instance = viewer.current;
    if (!instance) return;
    instance.loadSkin(skin, { model: model === 'slim' ? 'slim' : 'default' })?.then(() => instance.render()).catch(() => undefined);
  }, [skin, model, width, height]);

  useEffect(() => {
    if (!walking) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number): void => {
      frame = requestAnimationFrame(tick);
      const instance = viewer.current;
      const walk = animation.current;
      if (!instance || !walk || now - last < FRAME_INTERVAL_MS) return;
      walk.update(instance.playerObject, Math.min(0.1, (now - last) / 1000));
      last = now;
      instance.render();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [walking, width, height]);

  return <canvas ref={canvas} aria-hidden="true" className={className} />;
}
