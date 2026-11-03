import { useState } from 'react';
import type { SupportTicket } from '../../../shared/types/support';
import { invoke } from '../../api/launcher-api';
import { Button } from '../../components/ui/Button';
import { Checkbox, Field, TextInput } from '../../components/ui/Field';
import { Modal, modalStyles } from '../../components/ui/Modal';
import { useI18n } from '../../i18n/i18n';
import { showError, showToast } from '../../state/toast-store';
import styles from './SupportScreen.module.css';

interface SupportComposeDialogProps {
  initialSubject?: string;
  onClose: () => void;
  onCreated?: (ticket: SupportTicket) => void;
}

const MAX_SUBJECT_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 4000;

export function SupportComposeDialog({ initialSubject = '', onClose, onCreated }: SupportComposeDialogProps) {
  const { t } = useI18n();
  const [subject, setSubject] = useState(initialSubject);
  const [message, setMessage] = useState('');
  const [attachLog, setAttachLog] = useState(true);
  const [busy, setBusy] = useState(false);
  const valid = subject.trim().length > 0 && message.trim().length > 0;

  const send = async (): Promise<void> => {
    setBusy(true);
    try {
      const ticket = await invoke('support:create', { subject, message, attachLog });
      showToast(t('support.sent'));
      onCreated?.(ticket);
      onClose();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={t('support.composeTitle')}
      width={560}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" icon="upload" loading={busy} disabled={!valid} onClick={() => void send()}>
            {t('support.send')}
          </Button>
        </>
      }
    >
      <Field label={t('support.subject')}>{(id) => <TextInput id={id} value={subject} maxLength={MAX_SUBJECT_LENGTH} placeholder={t('support.subjectHint')} onChange={(event) => setSubject(event.target.value)} />}</Field>
      <Field label={t('support.message')}>
        {(id) => <textarea id={id} className={styles.textarea} rows={6} value={message} maxLength={MAX_MESSAGE_LENGTH} placeholder={t('support.messageHint')} onChange={(event) => setMessage(event.target.value)} />}
      </Field>
      <Checkbox checked={attachLog} onChange={setAttachLog} label={t('support.attachLog')} />
      <p className={modalStyles.text} style={{ fontSize: 12.5 }}>
        {t('support.privacyHint')}
      </p>
    </Modal>
  );
}
