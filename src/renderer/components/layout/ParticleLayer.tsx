import { useEffect, useRef } from 'react';
import type { ParticleEffect } from '../../../shared/types/settings';
import styles from './Layout.module.css';

interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  sway: number;
  swaySpeed: number;
  phase: number;
  spin: number;
  angle: number;
  color: string;
  alpha: number;
}

interface EffectStyle {
  colors: string[];
  count: number;
  sizes: [number, number];
  speed: [number, number];
  sway: number;
  spin: number;
}

const EFFECTS: Record<ParticleEffect, EffectStyle> = {
  petals: { colors: ['#FFB7D0', '#FF8FB3', '#FFD3E2', '#F2709C'], count: 34, sizes: [4, 8], speed: [26, 58], sway: 34, spin: 1.4 },
  leaves: { colors: ['#F28A1E', '#E0561B', '#F7B733', '#B8391A'], count: 26, sizes: [5, 9], speed: [32, 70], sway: 44, spin: 1.8 },
  snow: { colors: ['#FFFFFF', '#E3F1FF', '#CFE6FF'], count: 46, sizes: [2, 5], speed: [18, 46], sway: 16, spin: 0 }
};

const FRAME_INTERVAL_MS = 1000 / 30;
const MAX_STEP_SECONDS = 0.1;
const REFERENCE_WIDTH = 1280;

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function createParticle(style: EffectStyle, width: number, height: number, anywhere: boolean): Particle {
  return {
    x: Math.random() * width,
    y: anywhere ? Math.random() * height : -20,
    size: Math.round(randomBetween(style.sizes[0], style.sizes[1])),
    speed: randomBetween(style.speed[0], style.speed[1]),
    sway: randomBetween(style.sway * 0.4, style.sway),
    swaySpeed: randomBetween(0.5, 1.3),
    phase: Math.random() * Math.PI * 2,
    spin: randomBetween(-style.spin, style.spin),
    angle: Math.random() * Math.PI,
    color: style.colors[Math.floor(Math.random() * style.colors.length)],
    alpha: randomBetween(0.55, 0.95)
  };
}

export function ParticleLayer({ effect }: { effect: ParticleEffect }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const style = EFFECTS[effect];
    let particles: Particle[] = [];
    let frame = 0;
    let lastDraw = 0;

    const resize = (): void => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      const count = Math.round((style.count * canvas.width) / REFERENCE_WIDTH);
      particles = Array.from({ length: count }, () => createParticle(style, canvas.width, canvas.height, true));
    };

    const draw = (now: number): void => {
      frame = requestAnimationFrame(draw);
      if (now - lastDraw < FRAME_INTERVAL_MS) return;
      const step = Math.min(MAX_STEP_SECONDS, (now - lastDraw) / 1000);
      lastDraw = now;
      context.clearRect(0, 0, canvas.width, canvas.height);
      for (let index = 0; index < particles.length; index++) {
        const particle = particles[index];
        particle.y += particle.speed * step;
        particle.phase += particle.swaySpeed * step;
        particle.angle += particle.spin * step;
        if (particle.y > canvas.height + 20) {
          particles[index] = createParticle(style, canvas.width, canvas.height, false);
          continue;
        }
        const half = particle.size / 2;
        context.globalAlpha = particle.alpha;
        context.fillStyle = particle.color;
        if (style.spin === 0) {
          context.setTransform(1, 0, 0, 1, 0, 0);
          context.fillRect(Math.round(particle.x + Math.sin(particle.phase) * particle.sway), Math.round(particle.y), particle.size, particle.size);
        } else {
          const cos = Math.cos(particle.angle);
          const sin = Math.sin(particle.angle);
          context.setTransform(cos, sin, -sin, cos, particle.x + Math.sin(particle.phase) * particle.sway, particle.y);
          context.fillRect(-half, -half, particle.size, particle.size * 0.7);
        }
      }
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.globalAlpha = 1;
    };

    resize();
    frame = requestAnimationFrame(draw);
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [effect]);

  return <canvas ref={canvasRef} aria-hidden="true" className={styles.particles} />;
}
