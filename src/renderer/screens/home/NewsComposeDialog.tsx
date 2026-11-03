import { useState } from 'react';
import type { NewsItem } from '../../../shared/types/news';
import { invoke } from '../../api/launcher-api';
import { Button } from '../../components/ui/Button';
import { Field, TextInput } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useI18n } from '../../i18n/i18n';
import { showError, showToast } from '../../state/toast-store';
import supportStyles from '../support/SupportScreen.module.css';

const MAX_TITLE_LENGTH = 120;
const MAX_TEXT_LENGTH = 4000;
const WEB_LINK = /^https?:\/\/\S+$/i;

interface NewsComposeDialogProps {
  onClose: () => void;
  onCreated: (items: NewsItem[]) => void;
}

export function NewsComposeDialog({ onClose, onCreated }: NewsComposeDialogProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const linkValid = !link.trim() || WEB_LINK.test(link.trim());
  const valid = title.trim().length > 0 && text.trim().length > 0 && linkValid;

  const publish = async (): Promise<void> => {
    setBusy(true);
    try {
      onCreated(await invoke('news:create', { title, text, link: link.trim() || null }));
      showToast(t('home.newsPublished'));
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={t('home.newsCompose')}
      width={560}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={busy} disabled={!valid} onClick={() => void publish()}>
            {t('home.newsPublish')}
          </Button>
        </>
      }
    >
      <Field label={t('home.newsTitleField')}>{(id) => <TextInput id={id} value={title} maxLength={MAX_TITLE_LENGTH} onChange={(event) => setTitle(event.target.value)} />}</Field>
      <Field label={t('home.newsTextField')}>{(id) => <textarea id={id} className={supportStyles.textarea} rows={6} value={text} maxLength={MAX_TEXT_LENGTH} onChange={(event) => setText(event.target.value)} />}</Field>
      <Field label={t('home.newsLinkField')} hint={linkValid ? undefined : t('home.newsLinkInvalid')}>
        {(id) => <TextInput id={id} value={link} placeholder="https://" onChange={(event) => setLink(event.target.value)} />}
      </Field>
    </Modal>
  );
}
