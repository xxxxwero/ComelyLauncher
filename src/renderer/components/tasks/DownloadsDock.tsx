import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LauncherError } from '../../../shared/errors';
import type { TaskSnapshot } from '../../../shared/types/tasks';
import { formatEta, formatMegabytes, formatSpeed } from '../../i18n/format';
import { errorMessage, useI18n, type TranslationKey } from '../../i18n/i18n';
import { cancelTask, dismissTask, useTasks } from '../../state/tasks-store';
import { cx } from '../../utils/cx';
import { IconButton } from '../ui/Button';
import { ProgressBar, Spinner } from '../ui/Feedback';
import { Icon } from '../ui/Icon';
import styles from './DownloadsDock.module.css';

const AUTO_DISMISS_MS = 5000;

function TaskItem({ task }: { task: TaskSnapshot }) {
  const { t, language } = useI18n();
  const title = t(task.title.key as TranslationKey, task.title.params);
  const running = task.state === 'running';
  const activeStep = task.steps.find((step) => step.state === 'active');
  const status =
    task.state === 'failed'
      ? `${t('tasks.stateFailed')}: ${task.error ? errorMessage(LauncherError.fromSerialized(task.error)) : ''}`
      : task.state === 'cancelled'
        ? t('tasks.stateCancelled')
        : task.state === 'done'
          ? t('tasks.stateDone')
          : activeStep?.id === 'dependencies'
            ? `${t(activeStep.label.key as TranslationKey)}${task.currentFile ? ` · ${task.currentFile}` : ''}`
            : task.totalBytes > 0
              ? t('tasks.downloading', { done: formatMegabytes(task.downloadedBytes, language), total: formatMegabytes(task.totalBytes, language) })
              : activeStep
                ? t(activeStep.label.key as TranslationKey)
                : t('tasks.preparing');

  return (
    <div className={styles.item}>
      <span className={styles.letter} aria-hidden="true">
        {title.replace(/[^\p{L}\p{N}]/gu, '').charAt(0).toUpperCase() || '•'}
      </span>
      <span className={styles.itemBody}>
        <span className={styles.itemTop}>
          <span className={styles.itemName}>{title}</span>
          <span className={styles.itemPercent} style={{ color: running ? '#fff' : 'var(--accent-light)' }}>
            {running ? `${Math.floor(task.progress * 100)}%` : ''}
          </span>
        </span>
        <ProgressBar value={task.state === 'done' ? 1 : task.progress} label={title} height={5} striped={running} />
        <span className={cx(styles.itemStatus, task.state === 'failed' && styles.itemFailed)} title={status}>
          {status}
        </span>
      </span>
      {running ? (
        <IconButton icon="close" label={t('tasks.cancel')} size={30} iconSize={13} onClick={() => void cancelTask(task.id)} />
      ) : (
        <IconButton icon="close" label={t('tasks.dismiss')} size={30} iconSize={13} onClick={() => void dismissTask(task.id)} />
      )}
    </div>
  );
}

interface DownloadsDockProps {
  hiddenTaskId: string | null;
  floating?: boolean;
}

export function DownloadsDock({ hiddenTaskId, floating = false }: DownloadsDockProps) {
  const { t, language } = useI18n();
  const tasks = useTasks().filter((task) => task.id !== hiddenTaskId);
  const [open, setOpen] = useState(false);
  const pill = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const failedCount = tasks.filter((task) => task.state === 'failed').length;
  const seenFailures = useRef(0);

  useEffect(() => {
    const timers = tasks
      .filter((task) => task.state === 'done' && task.finishedAt)
      .map((task) => setTimeout(() => void dismissTask(task.id), Math.max(0, AUTO_DISMISS_MS - (Date.now() - (task.finishedAt ?? 0)))));
    return () => timers.forEach(clearTimeout);
  }, [tasks]);

  useEffect(() => {
    if (failedCount > seenFailures.current) setOpen(true);
    seenFailures.current = failedCount;
  }, [failedCount]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !pill.current?.contains(target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (tasks.length === 0) setOpen(false);
  }, [tasks.length]);

  if (tasks.length === 0) return null;
  const running = tasks.filter((task) => task.state === 'running');
  const hasFailed = failedCount > 0;
  const done = tasks.length - running.length;
  const total = tasks.reduce((sum, task) => sum + (task.state === 'running' ? task.progress : 1), 0) / tasks.length;
  const speed = running.reduce((sum, task) => sum + task.speedBytesPerSecond, 0);
  const remainingBytes = running.reduce((sum, task) => sum + Math.max(0, task.totalBytes - task.downloadedBytes), 0);
  const title = running.length > 0 ? t('tasks.dockTitle', { done, total: tasks.length }) : hasFailed ? t('tasks.someFailed') : t('tasks.allDone');
  const detail =
    running.length > 0 && speed > 0
      ? t('tasks.dockSpeed', { speed: formatSpeed(speed, language), eta: formatEta(remainingBytes / speed, language) })
      : running.length > 0
        ? t('tasks.preparing')
        : hasFailed
          ? t('tasks.someFailedHint')
          : t('tasks.allDoneHint');

  return (
    <>
      <button
        ref={pill}
        type="button"
        aria-expanded={open}
        aria-label={`${title}. ${open ? t('tasks.collapse') : t('tasks.expand')}`}
        className={cx('cl-hover', styles.pill, floating && styles.pillFloating, hasFailed && styles.pillFailed)}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.pillIcon} aria-hidden="true">
          {running.length > 0 ? <Spinner size={16} /> : <Icon name={hasFailed ? 'warning' : 'check'} size={16} strokeWidth={2.6} />}
        </span>
        <span className={styles.pillText}>
          <span className={styles.pillTitle}>{title}</span>
          <span className={styles.pillDetail}>{running.length > 0 ? `${Math.floor(total * 100)}%` : detail}</span>
        </span>
        <span aria-hidden="true" className={styles.pillBar} style={{ transform: `scaleX(${total})` }} />
      </button>
      {open &&
        createPortal(
          <section ref={panel} aria-label={title} aria-live="polite" className={cx(styles.panel, floating && styles.panelFloating)}>
            <div className={styles.header}>
              <span className={styles.headerText}>
                <span className={styles.title}>{title}</span>
                <span className={styles.subtitle}>{detail}</span>
              </span>
              <IconButton icon="close" label={t('tasks.collapse')} variant="secondary" size={32} iconSize={13} onClick={() => setOpen(false)} />
            </div>
            <ProgressBar value={total} label={title} height={4} />
            <div className={styles.list}>
              {[...tasks].reverse().map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          </section>,
          document.body
        )}
    </>
  );
}
