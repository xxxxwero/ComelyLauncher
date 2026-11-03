import { useRef, type CSSProperties, type MouseEvent } from 'react';
import type { Instance } from '../../../shared/types/instances';
import { playInstance } from '../../actions/play';
import { coverGlow, coverImage } from '../../assets/catalog';
import { Icon } from '../../components/ui/Icon';
import { formatRelative } from '../../i18n/format';
import { useI18n } from '../../i18n/i18n';
import { navigate } from '../../state/navigation-store';
import { cx } from '../../utils/cx';
import { LOADER_NAMES } from '../../utils/loader-names';
import styles from './InstancesScreen.module.css';

const MAX_TILT_DEGREES = 5;

interface InstanceCardProps {
  instance: Instance;
  selected: boolean;
  busy: boolean;
}

export function InstanceCard({ instance, selected, busy }: InstanceCardProps) {
  const { t, count, language } = useI18n();
  const card = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);

  const tilt = (event: MouseEvent<HTMLDivElement>): void => {
    const element = card.current;
    if (!element || frame.current !== null) return;
    const { clientX, clientY } = event;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const box = element.getBoundingClientRect();
      const x = (clientX - box.left) / box.width - 0.5;
      const y = (clientY - box.top) / box.height - 0.5;
      element.style.setProperty('--tilt-x', `${(-y * MAX_TILT_DEGREES * 2).toFixed(2)}deg`);
      element.style.setProperty('--tilt-y', `${(x * MAX_TILT_DEGREES * 2).toFixed(2)}deg`);
      element.style.setProperty('--shine-x', `${((x + 0.5) * 100).toFixed(0)}%`);
    });
  };

  const reset = (): void => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    card.current?.style.removeProperty('--tilt-x');
    card.current?.style.removeProperty('--tilt-y');
  };

  return (
    <div ref={card} className={cx(styles.card, selected && styles.cardSelected)} style={{ '--cover-glow': coverGlow(instance.cover) } as CSSProperties} onMouseMove={tilt} onMouseLeave={reset}>
      <button type="button" className={styles.open} onClick={() => navigate('instance', { id: instance.id })}>
        <span className={styles.coverWrap}>
          <img src={coverImage(instance.cover)} alt="" className={styles.coverImage} />
          <span className={styles.coverShade} aria-hidden="true" />
          <span className={styles.coverShine} aria-hidden="true" />
          <span className={styles.loaderChip}>{LOADER_NAMES[instance.loader.type]}</span>
        </span>
        <span className={styles.body}>
          <span className={styles.name}>{instance.name}</span>
          <span className={styles.meta}>
            {instance.gameVersion} · {LOADER_NAMES[instance.loader.type]} · {instance.contentCount > 0 ? count('content', instance.contentCount) : t('instances.noContent')}
          </span>
          <span className={styles.played}>{instance.lastPlayedAt ? t('instances.playedPrefix', { when: formatRelative(instance.lastPlayedAt, language) }) : t('instances.neverPlayed')}</span>
        </span>
      </button>
      <button type="button" aria-label={t('instances.playAria', { name: instance.name })} className={cx('cl-hover', styles.play)} disabled={busy} onClick={() => void playInstance(instance)}>
        <Icon name="play" size={18} />
      </button>
    </div>
  );
}
