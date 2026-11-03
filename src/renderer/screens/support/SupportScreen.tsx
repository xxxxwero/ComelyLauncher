import { useCallback, useEffect, useState } from 'react';
import type { SupportSession, SupportTicket, SupportTicketStatus } from '../../../shared/types/support';
import { invoke } from '../../api/launcher-api';
import { Panel, Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/Feedback';
import { formatRelative } from '../../i18n/format';
import { errorMessage, useI18n } from '../../i18n/i18n';
import { LauncherError } from '../../../shared/errors';
import { cx } from '../../utils/cx';
import { SupportComposeDialog } from './SupportComposeDialog';
import { PROVIDER_LABELS, SupportThreadView } from './SupportThreadView';
import styles from './SupportScreen.module.css';

const LIST_REFRESH_MS = 30000;

export function SupportScreen() {
  const { t, language } = useI18n();
  const [session, setSession] = useState<SupportSession | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [status, setStatus] = useState<SupportTicketStatus>('open');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  const connect = useCallback(() => {
    setFailure(null);
    invoke('support:session')
      .then(setSession)
      .catch((error: unknown) => setFailure(errorMessage(LauncherError.from(error))));
  }, []);

  const loadTickets = useCallback(() => {
    invoke('support:tickets', status)
      .then(setTickets)
      .catch((error: unknown) => setFailure(errorMessage(LauncherError.from(error))));
  }, [status]);

  useEffect(connect, [connect]);

  useEffect(() => {
    if (!session) return;
    loadTickets();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') loadTickets();
    }, LIST_REFRESH_MS);
    return () => clearInterval(timer);
  }, [session, loadTickets]);

  const actions = session && !session.isAdmin && (
    <Button variant="primary" icon="plus" onClick={() => setComposing(true)}>
      {t('support.newTicket')}
    </Button>
  );

  return (
    <Screen title={session?.isAdmin ? t('support.adminTitle') : t('support.title')} subtitle={session?.isAdmin ? t('support.adminSubtitle') : t('support.subtitle')} actions={actions}>
      {failure && !session ? (
        <EmptyState icon="warning" title={failure} action={<Button icon="refresh" onClick={connect}>{t('common.retry')}</Button>} />
      ) : !session ? (
        <div className={styles.placeholder}>{t('support.loading')}</div>
      ) : (
        <>
        {session.verificationFailed && (
          <div className={styles.notice}>
            <span>{t('support.notVerified')}</span>
            <Button size="sm" icon="refresh" onClick={connect}>
              {t('common.retry')}
            </Button>
          </div>
        )}
        <div className={styles.body}>
          <Panel className={styles.list} as="aside" label={t('support.title')}>
            <div role="tablist" className={styles.filters}>
              {(['open', 'closed'] as SupportTicketStatus[]).map((id) => (
                <button key={id} type="button" role="tab" aria-selected={status === id} className={cx(styles.filter, status === id && styles.filterActive)} onClick={() => setStatus(id)}>
                  {id === 'open' ? t('support.statusOpen') : t('support.statusClosed')}
                </button>
              ))}
            </div>
            <div className={styles.tickets}>
              {tickets.map((ticket) => (
                <button key={ticket.id} type="button" className={cx(styles.ticket, selected === ticket.id && styles.ticketActive)} onClick={() => setSelected(ticket.id)}>
                  <span className={styles.ticketTop}>
                    <span className={styles.ticketSubject}>{ticket.subject}</span>
                    {ticket.unread && selected !== ticket.id && <span className={styles.unreadDot} aria-label={t('support.unread')} />}
                  </span>
                  <span className={styles.ticketMeta}>
                    {session.isAdmin ? `${ticket.authorName} · ${t(PROVIDER_LABELS[ticket.authorProvider])} · ` : ''}
                    {formatRelative(ticket.updatedAt, language)}
                  </span>
                </button>
              ))}
              {tickets.length === 0 && <div className={styles.emptyList}>{session.isAdmin ? t('support.emptyAdmin') : t('support.empty')}</div>}
            </div>
          </Panel>
          <Panel className={styles.detail} label={t('support.threadLabel')}>
            {selected ? <SupportThreadView key={selected} ticketId={selected} session={session} onChanged={loadTickets} /> : <div className={styles.placeholder}>{session.isAdmin ? t('support.pickAdmin') : t('support.pick')}</div>}
          </Panel>
        </div>
        </>
      )}
      {composing && (
        <SupportComposeDialog
          onClose={() => setComposing(false)}
          onCreated={(ticket) => {
            setStatus('open');
            setSelected(ticket.id);
            loadTickets();
          }}
        />
      )}
    </Screen>
  );
}
