import { useState } from 'react';
import type { Instance } from '../../../shared/types/instances';
import type { ServerEntry } from '../../../shared/types/media';
import { playInstance } from '../../actions/play';
import { MotdText } from '../../components/servers/MotdText';
import { ServerIcon } from '../../components/servers/ServerIcon';
import { Button, IconButton } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/Feedback';
import { Menu } from '../../components/ui/Menu';
import type { InstanceServers } from '../../hooks/use-instance-servers';
import { useI18n } from '../../i18n/i18n';
import { pingServer, useServerStatus } from '../../state/server-status-store';
import { showError, showToast } from '../../state/toast-store';
import { cx } from '../../utils/cx';
import { ServerDialog } from './ServerDialog';
import styles from './InstanceScreen.module.css';

interface ServerItemProps {
  instance: Instance;
  server: ServerEntry;
  onEdit: () => void;
  onRemove: () => void;
}

function ServerItem({ instance, server, onEdit, onRemove }: ServerItemProps) {
  const { t } = useI18n();
  const status = useServerStatus(server.address);
  const result = status?.status === 'done' ? status.result : null;
  const online = Boolean(result?.online);
  const name = server.name || server.address;

  const copyAddress = (): void => {
    navigator.clipboard
      .writeText(server.address)
      .then(() => showToast(t('instance.addressCopied', { address: server.address })))
      .catch(showError);
  };

  return (
    <div className={styles.serverRow}>
      <ServerIcon name={name} icon={result?.iconDataUrl ?? server.iconDataUrl} size={52} />
      <span className={styles.serverInfo}>
        <span className={styles.serverTitle}>
          <span className={styles.serverName}>{name}</span>
          <span className={cx(styles.serverStatus, result && !online && styles.serverOffline)}>
            {!result ? t('home.pinging') : online ? `${result.playersOnline} / ${result.playersMax}` : t('home.offline')}
          </span>
        </span>
        <span className={styles.serverAddress}>
          {server.address}
          {result?.versionName ? ` · ${result.versionName}` : ''}
          {result?.latencyMs !== null && result?.latencyMs !== undefined ? ` · ${result.latencyMs} ms` : ''}
        </span>
      </span>
      <span className={styles.motd}>
        {(result?.motd ?? []).map((line, index) => (
          <MotdText key={index} line={line} style={{ fontSize: 13, maxWidth: '100%' }} />
        ))}
      </span>
      {result && !online ? (
        <Button icon="refresh" onClick={() => void pingServer(server.address)}>
          {t('instance.serverRetry')}
        </Button>
      ) : (
        <Button variant="primary" icon="play" onClick={() => void playInstance(instance, server.address)}>
          {t('instance.serverPlay')}
        </Button>
      )}
      <Menu
        entries={[
          { label: t('instance.serverEdit'), icon: 'edit', onSelect: onEdit },
          { label: t('instance.copyAddress'), icon: 'copy', onSelect: copyAddress },
          { label: t('instance.refreshStatus'), icon: 'refresh', onSelect: () => void pingServer(server.address) },
          'separator',
          { label: t('instance.removeServer'), icon: 'trash', danger: true, onSelect: onRemove }
        ]}
        trigger={(props) => <IconButton icon="more" label={t('instance.moreActions', { name })} size={36} {...props} />}
      />
    </div>
  );
}

export function ServersTab({ instance, servers }: { instance: Instance; servers: InstanceServers }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<ServerEntry | 'new' | null>(null);

  return (
    <div className={styles.tabBody}>
      <div className={styles.toolbar} style={{ justifyContent: 'space-between' }}>
        <span className={styles.hint}>{t('instance.serversHint')}</span>
        <Button variant="primary" icon="plus" onClick={() => setEditing('new')}>
          {t('instance.addServer')}
        </Button>
      </div>
      {servers.servers.length === 0 ? (
        <EmptyState icon="server" title={t('instance.serversEmpty')} />
      ) : (
        <div className={cx(styles.servers, 'cl-stagger')}>
          {servers.servers.map((server) => (
            <ServerItem
              key={`${server.index}-${server.address}`}
              instance={instance}
              server={server}
              onEdit={() => setEditing(server)}
              onRemove={() => void servers.remove(server.index)}
            />
          ))}
        </div>
      )}
      {editing && (
        <ServerDialog
          initial={editing === 'new' ? null : { name: editing.name, address: editing.address }}
          onClose={() => setEditing(null)}
          onSave={async (draft) => {
            const saved = await servers.save(editing === 'new' ? null : editing.index, draft);
            if (saved) showToast(editing === 'new' ? t('instance.serverAdded') : t('instance.serverSaved'));
            return saved;
          }}
        />
      )}
    </div>
  );
}
