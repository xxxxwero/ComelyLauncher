import type { ServerEntry } from '../../../shared/types/media';
import { MotdText } from '../../components/servers/MotdText';
import { ServerIcon } from '../../components/servers/ServerIcon';
import { IconButton } from '../../components/ui/Button';
import { useI18n } from '../../i18n/i18n';
import { pingServer, useServerStatus } from '../../state/server-status-store';
import styles from './HomeScreen.module.css';

interface ServerRowProps {
  server: ServerEntry;
  onPlay: (address: string) => void;
}

export function ServerRow({ server, onPlay }: ServerRowProps) {
  const { t } = useI18n();
  const status = useServerStatus(server.address);
  const result = status?.status === 'done' ? status.result : null;
  const online = Boolean(result?.online);
  const name = server.name || server.address;

  return (
    <div className={styles.serverRow}>
      <ServerIcon name={name} icon={result?.iconDataUrl ?? server.iconDataUrl} />
      <span className={styles.serverText}>
        <span className={styles.serverName}>{name}</span>
        {result?.motd[0] ? <MotdText line={result.motd[0]} /> : <MotdText line={[{ text: server.address, color: 'rgba(255,255,255,0.7)', bold: false, italic: false }]} />}
        <span className={styles.serverMeta}>
          {!result ? (
            <span className={styles.mutedText}>{t('home.pinging')}</span>
          ) : online ? (
            <>
              <span className={styles.onlineDot} aria-hidden="true" />
              <span className={styles.onlineText}>{t('home.online', { count: result.playersOnline })}</span>
              <span className={styles.mutedText}>
                · {result.versionName ?? ''} {result.latencyMs !== null ? `· ${result.latencyMs} ms` : ''}
              </span>
            </>
          ) : (
            <span className={styles.offlineText}>{t('home.offline')}</span>
          )}
        </span>
      </span>
      {result && !online ? (
        <IconButton icon="refresh" label={t('home.retryPing', { name })} variant="secondary" size={44} onClick={() => void pingServer(server.address)} />
      ) : (
        <IconButton icon="play" label={t('home.playOn', { name })} variant="primary" size={44} iconSize={16} onClick={() => onPlay(server.address)} />
      )}
    </div>
  );
}
