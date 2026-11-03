import { useState } from 'react';
import { playInstance } from '../../actions/play';
import { invoke } from '../../api/launcher-api';
import type { ScreenProps } from '../../app/ScreenRouter';
import { coverImage } from '../../assets/catalog';
import { Screen } from '../../components/layout/Screen';
import { Button, IconButton } from '../../components/ui/Button';
import { Chip, EmptyState } from '../../components/ui/Feedback';
import { Icon } from '../../components/ui/Icon';
import { Menu } from '../../components/ui/Menu';
import { useInstanceServers } from '../../hooks/use-instance-servers';
import { useInstanceWorlds } from '../../hooks/use-instance-worlds';
import { formatPlayTime, formatRelative } from '../../i18n/format';
import { useI18n } from '../../i18n/i18n';
import { isSessionActive, useGame } from '../../state/game-store';
import { useInstance } from '../../state/instances-store';
import { navigate } from '../../state/navigation-store';
import { showError, showToast } from '../../state/toast-store';
import { cx } from '../../utils/cx';
import { LOADER_NAMES, loaderVersionLabel } from '../../utils/loader-names';
import { ContentTab } from './ContentTab';
import { InstanceSettingsDialog } from './InstanceSettingsDialog';
import { ServersTab } from './ServersTab';
import { WorldsTab } from './WorldsTab';
import styles from './InstanceScreen.module.css';

type Tab = 'content' | 'worlds' | 'servers';

export function InstanceScreen({ params }: ScreenProps) {
  const { t, count, language } = useI18n();
  const instance = useInstance(params.id);
  const game = useGame();
  const servers = useInstanceServers(instance?.id ?? null);
  const worlds = useInstanceWorlds(params.id ?? '');
  const [tab, setTab] = useState<Tab>(params.tab === 'servers' ? 'servers' : 'content');
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (!instance) {
    return (
      <Screen>
        <EmptyState icon="instances" title={t('instance.notFound')} action={<Button onClick={() => navigate('instances')}>{t('instance.back')}</Button>} />
      </Screen>
    );
  }

  const loaderLabel = instance.loader.version
    ? `${LOADER_NAMES[instance.loader.type]} ${loaderVersionLabel(instance.loader.type, instance.loader.version, instance.gameVersion)}`
    : LOADER_NAMES[instance.loader.type];

  const duplicate = (): void => {
    invoke('instances:duplicate', instance.id, t('instance.copyName', { name: instance.name }))
      .then(() => showToast(t('instance.copyStarted'), 'info'))
      .catch(showError);
  };

  const exportPack = (): void => {
    invoke('instances:exportMrpack', instance.id)
      .then((taskId) => {
        if (taskId) showToast(t('instance.exportStarted'), 'info');
      })
      .catch(showError);
  };

  return (
    <Screen gap={16}>
      <button type="button" className={styles.back} onClick={() => navigate('instances')}>
        <Icon name="chevronLeft" size={14} strokeWidth={2.6} />
        {t('instance.back')}
      </button>
      <div className={styles.header}>
        <img src={coverImage(instance.cover)} alt="" className={styles.cover} />
        <div className={styles.titles}>
          <h1 className={styles.title}>{instance.name}</h1>
          <div className={styles.chips}>
            <Chip>{instance.gameVersion}</Chip>
            <Chip>{loaderLabel}</Chip>
            <Chip>{t('instance.inInstance', { count: count('content', instance.contentCount) })}</Chip>
            <span className={styles.mutedChip}>
              {formatRelative(instance.lastPlayedAt, language)}
              {instance.totalPlayTimeMs > 0 ? ` · ${t('instance.playTime', { time: formatPlayTime(instance.totalPlayTimeMs, language) })}` : ''}
            </span>
          </div>
        </div>
        <IconButton icon="folder" label={t('instance.openFolder')} variant="secondary" size={48} onClick={() => invoke('instances:openFolder', instance.id, 'root').catch(showError)} />
        <IconButton icon="settings" label={t('instance.settings')} variant="secondary" size={48} onClick={() => setSettingsOpen(true)} />
        <Menu
          entries={[
            { label: t('instance.copyInstance'), icon: 'copy', onSelect: duplicate },
            { label: t('instance.exportInstance'), icon: 'upload', onSelect: exportPack }
          ]}
          trigger={(props) => <IconButton icon="more" label={t('instance.moreInstanceActions')} variant="secondary" size={48} {...props} />}
        />
        <Button variant="primary" size="lg" display icon="play" disabled={isSessionActive(game.session)} onClick={() => void playInstance(instance)}>
          {t('home.playButton')}
        </Button>
      </div>
      <div role="tablist" aria-label={instance.name} className={styles.tabs}>
        {(
          [
            ['content', t('instance.tabContent'), instance.contentCount],
            ['worlds', t('instance.tabWorlds'), worlds.worlds.length],
            ['servers', t('instance.tabServers'), servers.servers.length]
          ] as Array<[Tab, string, number]>
        ).map(([id, label, badge]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={cx(styles.tab, tab === id && styles.tabActive)} onClick={() => setTab(id)}>
            {label}
            <span className={styles.badge}>{badge}</span>
          </button>
        ))}
      </div>
      {tab === 'content' && <ContentTab instance={instance} />}
      {tab === 'worlds' && <WorldsTab instance={instance} worlds={worlds} />}
      {tab === 'servers' && <ServersTab instance={instance} servers={servers} />}
      {settingsOpen && <InstanceSettingsDialog instance={instance} onClose={() => setSettingsOpen(false)} />}
    </Screen>
  );
}
