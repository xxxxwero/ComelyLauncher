import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Screenshot } from '../../../shared/types/media';
import { Button, IconButton } from '../../components/ui/Button';
import { formatBytes, formatDateTime } from '../../i18n/format';
import { useI18n } from '../../i18n/i18n';
import styles from './ScreenshotsScreen.module.css';

interface ScreenshotViewerProps {
  shots: Screenshot[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
  onCopy: (shot: Screenshot) => void;
  onReveal: (shot: Screenshot) => void;
  onDelete: (shot: Screenshot) => void;
}

export function ScreenshotViewer({ shots, index, onIndex, onClose, onCopy, onReveal, onDelete }: ScreenshotViewerProps) {
  const { t, language } = useI18n();
  const shot = shots[index];

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') onIndex((index - 1 + shots.length) % shots.length);
      if (event.key === 'ArrowRight') onIndex((index + 1) % shots.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, shots.length, onClose, onIndex]);

  if (!shot) return null;

  return createPortal(
    <div role="dialog" aria-label={t('screenshots.viewer')} className={styles.viewer} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={styles.viewerBar}>
        <span className={styles.viewerTitle}>
          <span className={styles.file} style={{ fontSize: 15 }}>
            {shot.fileName}
          </span>
          <span className={styles.meta} style={{ fontSize: 13 }}>
            {shot.instanceName} · {formatDateTime(shot.createdAt, language)} · {formatBytes(shot.sizeBytes, language)}
          </span>
        </span>
        <Button size="sm" icon="copy" style={{ height: 44 }} onClick={() => onCopy(shot)}>
          {t('screenshots.copy')}
        </Button>
        <Button size="sm" icon="folder" style={{ height: 44 }} onClick={() => onReveal(shot)}>
          {t('screenshots.reveal')}
        </Button>
        <Button size="sm" icon="trash" style={{ height: 44, color: 'var(--accent-light)' }} onClick={() => onDelete(shot)}>
          {t('screenshots.delete')}
        </Button>
        <IconButton icon="close" label={t('screenshots.closeViewer')} size={44} style={{ background: '#fff', color: '#1A120D', borderRadius: 11 }} onClick={onClose} />
      </div>
      <div className={styles.viewerStage}>
        <img key={shot.path} src={shot.url} alt={shot.fileName} className={styles.viewerImage} />
        {shots.length > 1 && (
          <>
            <IconButton icon="chevronLeft" label={t('screenshots.previous')} size={48} round className={`${styles.nav} ${styles.prev}`} onClick={() => onIndex((index - 1 + shots.length) % shots.length)} />
            <IconButton icon="chevronRight" label={t('screenshots.next')} size={48} round className={`${styles.nav} ${styles.next}`} onClick={() => onIndex((index + 1) % shots.length)} />
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
