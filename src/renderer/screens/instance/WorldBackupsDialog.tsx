import { useEffect, useState } from 'react';
import type { WorldBackup, WorldInfo } from '../../../shared/types/worlds';
import { invoke } from '../../api/launcher-api';
import { Button, IconButton } from '../../components/ui/Button';
import { ConfirmDialog, Modal, modalStyles } from '../../components/ui/Modal';
import { formatBytes } from '../../i18n/format';
import { useI18n } from '../../i18n/i18n';
import { showError, showToast } from '../../state/toast-store';
import styles from './InstanceScreen.module.css';

interface WorldBackupsDialogProps {
  instanceId: string;
  world: WorldInfo;
  revision: string;
  onClose: () => void;
}

type PendingAction = { type: 'restore' | 'delete'; backup: WorldBackup };

export function WorldBackupsDialog({ instanceId, world, revision, onClose }: WorldBackupsDialogProps) {
  const { t, language } = useI18n();
  const [backups, setBackups] = useState<WorldBackup[]>([]);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const formatDate = (timestamp: number): string => new Date(timestamp).toLocaleString(language, { dateStyle: 'medium', timeStyle: 'short' });
  const mine = backups.filter((backup) => backup.worldFolder === world.folder);

  useEffect(() => {
    invoke('worlds:backups', instanceId).then(setBackups).catch(showError);
  }, [instanceId, revision]);

  const confirm = async (): Promise<void> => {
    if (!pending) return;
    try {
      if (pending.type === 'restore') {
        await invoke('worlds:restore', instanceId, pending.backup.fileName);
        showToast(t('instance.backupRestoreStarted'), 'info');
        onClose();
      } else {
        setBackups(await invoke('worlds:removeBackup', instanceId, pending.backup.fileName));
      }
    } catch (error) {
      showError(error);
    }
    setPending(null);
  };

  return (
    <>
      <Modal title={t('instance.backupsTitle', { name: world.name })} width={560} onClose={onClose} footer={<Button onClick={onClose}>{t('common.close')}</Button>}>
        {mine.length === 0 && <p className={modalStyles.text}>{t('instance.backupsEmpty')}</p>}
        {mine.length > 0 && (
          <div className={styles.backupList}>
            {mine.map((backup) => (
              <div key={backup.fileName} className={styles.backupRow}>
                <span className={styles.backupInfo}>
                  <span className={styles.serverName}>{formatDate(backup.createdAt)}</span>
                  <span className={styles.worldMeta}>{formatBytes(backup.sizeBytes, language)}</span>
                </span>
                <Button icon="refresh" onClick={() => setPending({ type: 'restore', backup })}>
                  {t('instance.backupRestore')}
                </Button>
                <IconButton icon="folder" label={t('instance.backupReveal')} size={40} variant="secondary" onClick={() => invoke('worlds:revealBackup', instanceId, backup.fileName).catch(showError)} />
                <IconButton icon="trash" label={t('instance.backupDelete')} size={40} variant="secondary" onClick={() => setPending({ type: 'delete', backup })} />
              </div>
            ))}
          </div>
        )}
      </Modal>
      {pending && (
        <ConfirmDialog
          title={pending.type === 'restore' ? t('instance.backupRestoreTitle') : t('instance.backupDeleteTitle')}
          text={t(pending.type === 'restore' ? 'instance.backupRestoreText' : 'instance.backupDeleteText', { date: formatDate(pending.backup.createdAt) })}
          confirmLabel={pending.type === 'restore' ? t('instance.backupRestore') : t('common.delete')}
          onCancel={() => setPending(null)}
          onConfirm={confirm}
        />
      )}
    </>
  );
}
