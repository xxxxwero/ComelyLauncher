import { useEffect, useState } from 'react';
import { LauncherError } from '../../../shared/errors';
import type { GameSession } from '../../../shared/types/game';
import type { Instance } from '../../../shared/types/instances';
import type { TaskSnapshot } from '../../../shared/types/tasks';
import { invoke } from '../../api/launcher-api';
import { coverImage } from '../../assets/catalog';
import { Button } from '../../components/ui/Button';
import { ProgressBar, StepList, type StepItem } from '../../components/ui/Feedback';
import { Icon } from '../../components/ui/Icon';
import { formatClock, formatGigabytes } from '../../i18n/format';
import { errorMessage, useI18n } from '../../i18n/i18n';
import { useSettings } from '../../state/settings-store';
import { cx } from '../../utils/cx';
import { instanceVersionLabel } from '../../utils/loader-names';
import { GameConsole } from './GameConsole';
import { isSessionStarting, launchProgress, STEP_LABELS } from './launch-progress';
import styles from './GameOverlay.module.css';

interface LaunchViewProps {
  session: GameSession;
  instance: Instance | null;
  task: TaskSnapshot | null;
  logs: string[];
  onStop: () => void;
  onHide: () => void;
  onPlayAgain: () => void;
  onDismiss: () => void;
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

export function LaunchView({ session, instance, task, logs, onStop, onHide, onPlayAgain, onDismiss }: LaunchViewProps) {
  const { t, count } = useI18n();
  const settings = useSettings();
  const [consoleOpen, setConsoleOpen] = useState(settings.launcher.showGameConsole);
  const [stopping, setStopping] = useState(false);
  const running = session.phase === 'running';
  const starting = isSessionStarting(session);
  const now = useNow(running);

  const progress = launchProgress(session, task);

  const steps: StepItem[] = session.steps.map((step) => ({
    id: step.id,
    label: t(STEP_LABELS[step.id], { server: session.server ?? '' }),
    state: step.state,
    note:
      step.id === 'files' && step.state === 'active' && task
        ? `${Math.floor(task.progress * 100)}%`
        : step.state === 'done'
          ? step.note ?? t('game.stepDone')
          : step.note
  }));

  const chip = starting ? t('game.chipStarting') : running ? t('game.chipRunning') : t('game.chipClosed');
  const sessionTime = session.runningSince ? (session.endedAt ?? now) - session.runningSince : 0;
  const meta = instance
    ? [instanceVersionLabel(instance), instance.loader.type !== 'vanilla' ? count('mods', instance.contentCount) : null, t('home.chipMemory', { value: formatGigabytes(session.memoryMb) })]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <section aria-label={t('game.startingTitle')} aria-live="polite" className={styles.card}>
      <div className={styles.head}>
        {instance && <img src={coverImage(instance.cover)} alt="" className={styles.cover} />}
        <div className={styles.headText}>
          <span className={styles.instanceName}>{instance?.name ?? ''}</span>
          <span className={styles.meta}>{meta}</span>
        </div>
        <span className={styles.statusChip}>
          <span aria-hidden="true" className={cx(styles.statusDot, (starting || running) && styles.statusDotLive)} style={!starting && !running ? { background: 'rgba(255,255,255,0.5)' } : undefined} />
          {chip}
        </span>
      </div>

      {starting && (
        <div className={styles.section}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{t('game.startingTitle')}</h1>
            <span className={styles.percent}>{Math.floor(progress * 100)}%</span>
          </div>
          <ProgressBar value={progress} label={t('game.startingTitle')} />
          <StepList steps={steps} />
          <div className={styles.logLine}>{session.lastLogLine ?? task?.currentFile ?? '…'}</div>
          <div className={styles.actions}>
            <Button icon="chevronLeft" onClick={onHide}>
              {t('game.toLauncher')}
            </Button>
            <Button onClick={onStop}>{t('game.cancel')}</Button>
          </div>
        </div>
      )}

      {running && (
        <div className={styles.section}>
          <div className={styles.runningHead}>
            <span className={styles.pulse} aria-hidden="true">
              <Icon name="play" size={22} color="#fff" />
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <h1 className={styles.title}>{t('game.runningTitle')}</h1>
              <span className={styles.subtitle}>{session.server ? t('game.runningServer', { server: session.server }) : t('game.runningText')}</span>
            </div>
          </div>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>{t('game.inGame')}</span>
              <span className={cx(styles.statValue, styles.statMono)}>{formatClock(sessionTime)}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>{t('game.memory')}</span>
              <span className={styles.statValue}>{t('common.gb', { value: formatGigabytes(session.memoryMb) })}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>{t('game.launchTook')}</span>
              <span className={styles.statValue}>{t('game.seconds', { value: ((session.launchDurationMs ?? 0) / 1000).toFixed(1) })}</span>
            </div>
          </div>
          <div className={styles.actions} style={{ justifyContent: 'stretch' }}>
            <Button icon="minimizeTray" onClick={() => void invoke('window:hideToTray')}>
              {t('game.toTray')}
            </Button>
            <Button icon="terminal" aria-expanded={consoleOpen} onClick={() => setConsoleOpen((value) => !value)}>
              {t('game.console')}
            </Button>
            <Button icon="chevronLeft" onClick={onHide}>
              {t('game.toLauncher')}
            </Button>
            <Button
              variant="danger"
              icon="stop"
              loading={stopping}
              style={{ marginLeft: 'auto' }}
              onClick={() => {
                setStopping(true);
                onStop();
              }}
            >
              {stopping ? t('game.stopping') : t('game.stop')}
            </Button>
          </div>
          {consoleOpen && <GameConsole lines={logs} />}
        </div>
      )}

      {session.phase === 'stopped' && (
        <div className={styles.section}>
          <h1 className={styles.title}>{t('game.closedTitle')}</h1>
          <span className={styles.subtitle}>{t('game.closedText', { time: formatClock(sessionTime) })}</span>
          <div className={styles.actions} style={{ justifyContent: 'stretch' }}>
            <Button variant="primary" size="lg" display icon="play" style={{ flex: 1 }} onClick={onPlayAgain}>
              {t('game.playAgain')}
            </Button>
            <Button size="lg" onClick={onDismiss}>
              {t('game.toLauncher')}
            </Button>
          </div>
        </div>
      )}

      {session.phase === 'failed' && (
        <div className={styles.section}>
          <h1 className={styles.title}>{t('game.failedTitle')}</h1>
          <div className={styles.cause}>
            <Icon name="warning" size={22} color="var(--accent-soft)" />
            <span className={styles.causeText}>{session.error ? errorMessage(LauncherError.fromSerialized(session.error)) : t('errors.unknown')}</span>
          </div>
          {session.error?.message && <pre className={styles.excerpt}>{session.error.message}</pre>}
          <div className={styles.actions}>
            <Button variant="primary" icon="refresh" onClick={onPlayAgain}>
              {t('common.retry')}
            </Button>
            <Button onClick={onDismiss}>{t('game.toLauncher')}</Button>
          </div>
        </div>
      )}
    </section>
  );
}
