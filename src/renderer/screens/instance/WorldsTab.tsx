import { useState } from 'react';
import type { Instance } from '../../../shared/types/instances';
import type { WorldGameMode, WorldInfo } from '../../../shared/types/worlds';
import { invoke } from '../../api/launcher-api';
import { Button, IconButton } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/Feedback';
import { Icon } from '../../components/ui/Icon';
import { Menu } from '../../components/ui/Menu';
import { ConfirmDialog } from '../../components/ui/Modal';
import type { InstanceWorlds } from '../../hooks/use-instance-worlds';
import { formatBytes, formatRelative } from '../../i18n/format';
import { useI18n, type TranslationKey } from '../../i18n/i18n';
import { showError, showToast } from '../../state/toast-store';
import { cx } from '../../utils/cx';
import { WorldBackupsDialog } from './WorldBackupsDialog';
import styles from './InstanceScreen.module.css';

const MODE_LABELS: Record<WorldGameMode, TranslationKey> = {
  survival: 'instance.modeSurvival',
  creative: 'instance.modeCreative',
  adventure: 'instance.modeAdventure',
  spectator: 'instance.modeSpectator',
  hardcore: 'instance.modeHardcore'
};

export function WorldsTab({ instance, worlds }: { instance: Instance; worlds: InstanceWorlds }) {
  const { t, language } = useI18n();
  const [backupsFor, setBackupsFor] = useState<WorldInfo | null>(null);
  const [deleting, setDeleting] = useState<WorldInfo | null>(null);

  const meta = (world: WorldInfo): string =>
    [
      world.gameMode ? t(MODE_LABELS[world.gameMode]) : null,
      world.gameVersion,
      world.lastPlayedAt ? formatRelative(world.lastPlayedAt, language) : t('instance.worldNeverPlayed'),
      formatBytes(world.sizeBytes, language)
    ]
      .filter(Boolean)
      .join(' · ');

  const backup = (world: WorldInfo): void => {
    invoke('worlds:backup', instance.id, world.folder)
      .then(() => showToast(t('instance.worldBackupStarted'), 'info'))
      .catch(showError);
  };

  const remove = async (): Promise<void> => {
    if (!deleting) return;
    try {
      await invoke('worlds:remove', instance.id, deleting.folder);
      showToast(t('instance.worldDeleted'));
      worlds.reload();
    } catch (error) {
      showError(error);
    }
    setDeleting(null);
  };

  return (
    <div className={styles.tabBody}>
      <div className={styles.toolbar} style={{ justifyContent: 'space-between' }}>
        <span className={styles.hint}>{t('instance.worldsHint')}</span>
        <Button icon="folder" onClick={() => invoke('instances:openFolder', instance.id, 'saves').catch(showError)}>
          {t('instance.worldsOpenFolder')}
        </Button>
      </div>
      {worlds.worlds.length === 0 ? (
        <EmptyState icon="world" title={worlds.loading ? t('instance.worldsLoading') : t('instance.worldsEmpty')} />
      ) : (
        <div className={cx(styles.servers, 'cl-stagger')}>
          {worlds.worlds.map((world) => (
            <div key={world.folder} className={styles.serverRow}>
              <span className={styles.worldIcon}>{world.iconUrl ? <img src={world.iconUrl} alt="" decoding="async" /> : <Icon name="world" size={24} color="var(--accent-soft)" />}</span>
              <span className={styles.worldInfo}>
                <span className={styles.serverName}>{world.name}</span>
                <span className={styles.worldMeta}>{meta(world)}</span>
              </span>
              <Button icon="download" onClick={() => backup(world)}>
                {t('instance.worldBackup')}
              </Button>
              <Menu
                entries={[
                  { label: t('instance.worldBackups', { count: world.backupCount }), icon: 'refresh', onSelect: () => setBackupsFor(world) },
                  'separator',
                  { label: t('instance.worldDelete'), icon: 'trash', danger: true, onSelect: () => setDeleting(world) }
                ]}
                trigger={(props) => <IconButton icon="more" label={t('instance.moreActions', { name: world.name })} size={36} {...props} />}
              />
            </div>
          ))}
        </div>
      )}
      {backupsFor && <WorldBackupsDialog instanceId={instance.id} world={backupsFor} revision={worlds.backupsRevision} onClose={() => setBackupsFor(null)} />}
      {deleting && (
        <ConfirmDialog
          title={t('instance.worldDeleteTitle', { name: deleting.name })}
          text={t('instance.worldDeleteText')}
          confirmLabel={t('common.delete')}
          onCancel={() => setDeleting(null)}
          onConfirm={remove}
        />
      )}
    </div>
  );
}
