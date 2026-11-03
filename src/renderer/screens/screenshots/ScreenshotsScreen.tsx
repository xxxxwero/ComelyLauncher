import { useCallback, useEffect, useState } from 'react';
import type { Screenshot } from '../../../shared/types/media';
import { playInstance } from '../../actions/play';
import { invoke } from '../../api/launcher-api';
import type { ScreenProps } from '../../app/ScreenRouter';
import { Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { EmptyState, Spinner } from '../../components/ui/Feedback';
import { ConfirmDialog } from '../../components/ui/Modal';
import { formatDateTime } from '../../i18n/format';
import { useI18n } from '../../i18n/i18n';
import { useSelectedInstance } from '../../state/instances-store';
import { showError, showToast } from '../../state/toast-store';
import { cx } from '../../utils/cx';
import { ScreenshotViewer } from './ScreenshotViewer';
import styles from './ScreenshotsScreen.module.css';

export function ScreenshotsScreen(_props: ScreenProps) {
  const { t, plural, language } = useI18n();
  const instance = useSelectedInstance();
  const [shots, setShots] = useState<Screenshot[] | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<Screenshot | null>(null);

  useEffect(() => {
    invoke('screenshots:list').then(setShots).catch((error) => {
      setShots([]);
      showError(error);
    });
  }, []);

  const close = useCallback(() => setViewing(null), []);

  const copy = (shot: Screenshot): void => {
    invoke('screenshots:copy', shot.path).then(() => showToast(t('screenshots.copied'))).catch(showError);
  };

  const reveal = (shot: Screenshot): void => {
    invoke('screenshots:reveal', shot.path).catch(showError);
  };

  const confirmDelete = async (): Promise<void> => {
    if (!deleting) return;
    try {
      const remaining = await invoke('screenshots:delete', deleting.path);
      setShots(remaining);
      setViewing((current) => (current === null || remaining.length === 0 ? null : Math.min(current, remaining.length - 1)));
      showToast(t('screenshots.deleted'));
    } catch (error) {
      showError(error);
    } finally {
      setDeleting(null);
    }
  };

  const total = shots?.length ?? 0;

  return (
    <Screen
      title={t('screenshots.title')}
      subtitle={t('screenshots.subtitle', { count: total, unit: plural('screenshots', total) })}
      actions={
        instance && (
          <Button icon="folder" onClick={() => invoke('instances:openFolder', instance.id, 'screenshots').catch(showError)}>
            {t('screenshots.openFolder')}
          </Button>
        )
      }
    >
      {shots === null ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Spinner size={28} />
        </div>
      ) : shots.length === 0 ? (
        <EmptyState
          icon="screenshots"
          title={t('screenshots.emptyTitle')}
          text={t('screenshots.emptyText')}
          action={
            <Button variant="primary" size="lg" icon="play" onClick={() => void playInstance(instance)}>
              {t('common.play')}
            </Button>
          }
        />
      ) : (
        <div className={cx(styles.grid, 'cl-stagger')}>
          {shots.map((shot, index) => (
            <button key={shot.path} type="button" aria-label={t('screenshots.open', { file: shot.fileName })} className={styles.card} onClick={() => setViewing(index)}>
              <span className={styles.thumbWrap}>
                <img src={shot.thumbUrl} alt="" loading="lazy" decoding="async" className={styles.thumb} />
              </span>
              <span className={styles.caption}>
                <span className={styles.file}>{shot.fileName}</span>
                <span className={styles.meta}>
                  {shot.instanceName} · {formatDateTime(shot.createdAt, language)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      {viewing !== null && shots && (
        <ScreenshotViewer shots={shots} index={viewing} onIndex={setViewing} onClose={close} onCopy={copy} onReveal={reveal} onDelete={setDeleting} />
      )}
      {deleting && (
        <ConfirmDialog
          title={t('screenshots.deleteTitle')}
          text={t('screenshots.deleteText', { file: deleting.fileName })}
          confirmLabel={t('screenshots.delete')}
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
        />
      )}
    </Screen>
  );
}
