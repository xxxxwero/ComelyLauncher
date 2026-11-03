import { useEffect, useState } from 'react';
import type { GameDirectoryEstimate } from '../../../shared/types/system';
import { invoke } from '../../api/launcher-api';
import { Button } from '../../components/ui/Button';
import { Modal, modalStyles } from '../../components/ui/Modal';
import { formatBytes } from '../../i18n/format';
import { useI18n } from '../../i18n/i18n';
import { updateSettings } from '../../state/settings-store';
import { showError, showToast } from '../../state/toast-store';

interface GameDirectoryDialogProps {
  directory: string;
  onClose: () => void;
}

const SPACE_RESERVE_BYTES = 200 * 1024 * 1024;

function hasEnoughSpace(estimate: GameDirectoryEstimate): boolean {
  return estimate.sameDrive || estimate.freeBytes === null || estimate.freeBytes >= estimate.totalBytes + SPACE_RESERVE_BYTES;
}

export function GameDirectoryDialog({ directory, onClose }: GameDirectoryDialogProps) {
  const { t, language } = useI18n();
  const [estimate, setEstimate] = useState<GameDirectoryEstimate | null>(null);

  const switchOnly = (): void => {
    updateSettings({ launcher: { gameDirectory: directory } }).catch(showError);
    onClose();
  };

  useEffect(() => {
    let active = true;
    invoke('instances:moveEstimate', directory)
      .then((result) => {
        if (!active) return;
        if (result.fileCount === 0) switchOnly();
        else setEstimate(result);
      })
      .catch((error: unknown) => {
        showError(error);
        if (active) onClose();
      });
    return () => {
      active = false;
    };
  }, [directory]);

  const move = (): void => {
    invoke('instances:moveToDirectory', directory)
      .then(() => showToast(t('settings.gameDirMoving'), 'info'))
      .catch(showError);
    onClose();
  };

  const enoughSpace = estimate !== null && hasEnoughSpace(estimate);

  return (
    <Modal
      title={t('settings.gameDirMoveTitle')}
      width={540}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button disabled={!estimate} onClick={switchOnly}>
            {t('settings.gameDirKeep')}
          </Button>
          <Button variant="primary" disabled={!enoughSpace} onClick={move}>
            {t('settings.gameDirMove')}
          </Button>
        </>
      }
    >
      {!estimate && <p className={modalStyles.text}>{t('settings.gameDirEstimating')}</p>}
      {estimate && (
        <>
          <p className={modalStyles.text}>{t('settings.gameDirMoveText', { directory, size: formatBytes(estimate.totalBytes, language), files: estimate.fileCount })}</p>
          {estimate.freeBytes !== null && <p className={modalStyles.text}>{t('settings.gameDirFreeSpace', { free: formatBytes(estimate.freeBytes, language) })}</p>}
          {!enoughSpace && <p className={modalStyles.text}>{t('settings.gameDirNoSpace')}</p>}
          <p className={modalStyles.text}>{t('settings.gameDirKeepHint')}</p>
        </>
      )}
    </Modal>
  );
}
