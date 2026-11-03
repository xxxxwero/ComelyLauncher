import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupportProvider, SupportSession, SupportThread } from '../../../shared/types/support';
import { invoke } from '../../api/launcher-api';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Feedback';
import { Modal } from '../../components/ui/Modal';
import { useI18n, type TranslationKey } from '../../i18n/i18n';
import { refreshSupportUnread } from '../../state/support-store';
import { showError } from '../../state/toast-store';
import { cx } from '../../utils/cx';
import styles from './SupportScreen.module.css';

const THREAD_REFRESH_MS = 15000;
const MAX_MESSAGE_LENGTH = 4000;

export const PROVIDER_LABELS: Record<SupportProvider, TranslationKey> = {
  microsoft: 'support.providerMicrosoft',
  elyby: 'support.providerElyby',
  offline: 'support.providerOffline'
};

interface SupportThreadViewProps {
  ticketId: string;
  session: SupportSession;
  onChanged: () => void;
}

export function SupportThreadView({ ticketId, session, onChanged }: SupportThreadViewProps) {
  const { t, language } = useI18n();
  const [thread, setThread] = useState<SupportThread | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [logText, setLogText] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const messageCount = thread?.messages.length ?? 0;
  const metaLine = thread ? Object.entries(thread.meta).filter(([, value]) => value).map(([key, value]) => `${key}: ${value}`).join(' · ') : '';

  const load = useCallback(() => {
    invoke('support:thread', ticketId)
      .then((result) => {
        setThread(result);
        refreshSupportUnread();
      })
      .catch(showError);
  }, [ticketId]);

  useEffect(() => {
    setThread(null);
    setText('');
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, THREAD_REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [messageCount]);

  const apply = async (action: () => Promise<SupportThread>): Promise<void> => {
    setBusy(true);
    try {
      setThread(await action());
      onChanged();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  const send = async (): Promise<void> => {
    await apply(() => invoke('support:reply', ticketId, text));
    setText('');
  };

  const openLog = (): void => {
    invoke('support:log', ticketId).then(setLogText).catch(showError);
  };

  if (!thread) return <div className={styles.placeholder}>{t('support.loading')}</div>;
  const { ticket } = thread;
  const closed = ticket.status === 'closed';
  const canReply = session.isAdmin || !closed;

  return (
    <div className={styles.thread}>
      <header className={styles.threadHeader}>
        <div className={styles.threadTitles}>
          <h2 className={styles.threadTitle}>{ticket.subject}</h2>
          <div className={styles.threadChips}>
            <Chip>{ticket.authorName}</Chip>
            <Chip>{t(PROVIDER_LABELS[ticket.authorProvider])}</Chip>
            {closed && <Chip>{t('support.statusClosed')}</Chip>}
            {ticket.authorBlocked && <Chip>{t('support.authorBlocked')}</Chip>}
          </div>
        </div>
        <div className={styles.threadActions}>
          {ticket.hasLog && (
            <Button size="sm" icon="terminal" onClick={openLog}>
              {t('support.viewLog')}
            </Button>
          )}
          {session.isAdmin && (
            <Button size="sm" variant="danger" disabled={busy} onClick={() => void apply(() => invoke('support:setBlocked', ticketId, !ticket.authorBlocked))}>
              {ticket.authorBlocked ? t('support.unblock') : t('support.block')}
            </Button>
          )}
          {(session.isAdmin || !closed) && (
            <Button size="sm" disabled={busy} onClick={() => void apply(() => invoke('support:setStatus', ticketId, closed ? 'open' : 'closed'))}>
              {closed ? t('support.reopen') : t('support.close')}
            </Button>
          )}
        </div>
      </header>
      {metaLine && <div className={styles.meta}>{metaLine}</div>}
      <div ref={list} className={styles.messages}>
        {thread.messages.map((message) => (
          <div key={message.id} className={cx(styles.message, message.fromAdmin && styles.messageAdmin)}>
            <span className={styles.messageAuthor}>
              {message.fromAdmin ? t('support.developer') : message.authorName} · {new Date(message.createdAt).toLocaleString(language, { dateStyle: 'short', timeStyle: 'short' })}
            </span>
            <span className={styles.messageText}>{message.text}</span>
          </div>
        ))}
      </div>
      {canReply && (
        <div className={styles.composer}>
          <textarea className={styles.textarea} rows={2} value={text} maxLength={MAX_MESSAGE_LENGTH} placeholder={t('support.replyHint')} aria-label={t('support.replyHint')} onChange={(event) => setText(event.target.value)} />
          <Button variant="primary" loading={busy} disabled={!text.trim()} onClick={() => void send()}>
            {t('support.send')}
          </Button>
        </div>
      )}
      {logText !== null && (
        <Modal title={t('support.logTitle')} width={860} onClose={() => setLogText(null)}>
          <pre className={styles.log}>{logText}</pre>
        </Modal>
      )}
    </div>
  );
}
