import { useState } from 'react';
import { invoke } from '../../api/launcher-api';
import { formatBytes } from '../../i18n/format';
import { useI18n } from '../../i18n/i18n';
import { showError } from '../../state/toast-store';
import { useUpdates } from '../../state/updates-store';
import { cx } from '../../utils/cx';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Modal, modalStyles } from '../ui/Modal';
import styles from './Layout.module.css';

export function UpdateCard() {
  const { t, language } = useI18n();
  const updates = useUpdates();
  const [open, setOpen] = useState(false);
  const info = updates?.available;
  if (!updates || !info || (updates.status !== 'available' && updates.status !== 'ready')) return null;
  const ready = updates.status === 'ready';

  const act = (): void => {
    setOpen(false);
    if (ready) invoke('updates:install').catch(showError);
    else invoke('updates:download').catch(showError);
  };

  return (
    <>
      <button type="button" className={cx('cl-hover', styles.updateCard)} onClick={() => setOpen(true)}>
        <Icon name="download" size={18} strokeWidth={2.4} color="var(--accent-soft)" />
        <span className={styles.accountText}>
          <span className={styles.accountName}>{ready ? t('updates.readyTitle') : t('updates.availableTitle')}</span>
          <span className={styles.accountType}>{t('updates.version', { version: info.version })}</span>
        </span>
      </button>
      {open && (
        <Modal
          title={t('updates.dialogTitle', { version: info.version })}
          width={520}
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button onClick={() => setOpen(false)}>{t('updates.later')}</Button>
              <Button variant="primary" icon={ready ? 'refresh' : 'download'} onClick={act}>
                {ready ? t('updates.restart') : t('updates.download', { size: formatBytes(info.sizeBytes, language) })}
              </Button>
            </>
          }
        >
          <p className={modalStyles.text}>{t('updates.current', { version: updates.currentVersion })}</p>
          {info.notes && (
            <p className={modalStyles.text} style={{ maxHeight: 240, overflowY: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {info.notes}
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
