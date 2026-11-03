import type { Instance } from '../../../shared/types/instances';
import type { TaskSnapshot } from '../../../shared/types/tasks';
import { Button } from '../../components/ui/Button';
import { ProgressBar, StepList } from '../../components/ui/Feedback';
import { Icon } from '../../components/ui/Icon';
import { formatEta, formatMegabytes, formatSpeed } from '../../i18n/format';
import { useI18n, type TranslationKey } from '../../i18n/i18n';
import { instanceVersionLabel } from '../../utils/loader-names';
import styles from './GameOverlay.module.css';

interface InstallViewProps {
  instance: Instance | null;
  task: TaskSnapshot;
  onCancel: () => void;
  onHide: () => void;
}

export function InstallView({ instance, task, onCancel, onHide }: InstallViewProps) {
  const { t, language } = useI18n();
  const percent = Math.floor(task.progress * 100);
  const remainingBytes = Math.max(0, task.totalBytes - task.downloadedBytes);
  const eta = task.speedBytesPerSecond > 0 ? formatEta(remainingBytes / task.speedBytesPerSecond, language) : '—';
  const steps = task.steps.map((step) => ({
    id: step.id,
    label: t(step.label.key as TranslationKey, step.label.params),
    state: step.state,
    note: step.state === 'done' ? t('game.stepDone') : step.state === 'active' ? `${Math.floor(step.progress * 100)}%` : null
  }));

  return (
    <section aria-label={t('game.installLabel')} className={styles.card}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <span className={styles.overline}>{t('game.installLabel')}</span>
          <h1 className={styles.title}>{instance ? instanceVersionLabel(instance) : ''}</h1>
        </div>
        <span className={styles.bigPercent}>{percent}%</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <ProgressBar value={task.progress} label={t('game.installLabel')} height={12} />
        <div className={styles.fileLine}>
          <Icon name="download" size={14} strokeWidth={2.4} color="var(--accent-soft)" />
          <span className={styles.fileName}>{task.currentFile ?? t('tasks.preparing')}</span>
        </div>
      </div>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{t('game.speed')}</span>
          <span className={styles.statValue}>{formatSpeed(task.speedBytesPerSecond, language)}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{t('game.downloaded')}</span>
          <span className={styles.statValue}>
            {formatMegabytes(task.downloadedBytes, language)} / {formatMegabytes(task.totalBytes, language)}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{t('game.remaining')}</span>
          <span className={styles.statValue}>{eta}</span>
        </div>
      </div>
      <StepList steps={steps} />
      <div className={styles.actions}>
        <Button icon="chevronLeft" onClick={onHide}>
          {t('game.toLauncher')}
        </Button>
        <Button style={{ color: 'var(--accent-light)' }} onClick={onCancel}>
          {t('game.cancel')}
        </Button>
      </div>
    </section>
  );
}
