import { useState, type CSSProperties } from 'react';
import { playInstance } from '../../actions/play';
import { coverGlow, coverImage } from '../../assets/catalog';
import { Icon, type IconName } from '../../components/ui/Icon';
import { Menu, type MenuEntry } from '../../components/ui/Menu';
import { formatPlayTime, formatRelative } from '../../i18n/format';
import { useI18n, type TranslationKey } from '../../i18n/i18n';
import { useInstanceServers } from '../../hooks/use-instance-servers';
import { useActiveAccount } from '../../state/accounts-store';
import { isSessionActive, setOverlayHidden, useGame } from '../../state/game-store';
import { selectInstance, useInstances, useSelectedInstance } from '../../state/instances-store';
import { navigate, type RouteId } from '../../state/navigation-store';
import { useTask } from '../../state/tasks-store';
import { showError } from '../../state/toast-store';
import { cx } from '../../utils/cx';
import { instanceVersionLabel } from '../../utils/loader-names';
import { isSessionStarting, launchProgress, STEP_LABELS } from '../game/launch-progress';
import { NewsList } from './NewsList';
import { ServerRow } from './ServerRow';
import styles from './HomeScreen.module.css';

interface QuickLink {
  route: RouteId;
  icon: IconName;
  title: TranslationKey;
  hint: TranslationKey;
}

const QUICK_LINKS: QuickLink[] = [
  { route: 'content', icon: 'content', title: 'home.quickContent', hint: 'home.quickContentHint' },
  { route: 'skins', icon: 'skins', title: 'home.quickSkins', hint: 'home.quickSkinsHint' },
  { route: 'screenshots', icon: 'screenshots', title: 'home.quickShots', hint: 'home.quickShotsHint' }
];

const MAX_SERVERS = 5;

type SidePanel = 'servers' | 'news';

export function HomeScreen() {
  const { t, count, language } = useI18n();
  const account = useActiveAccount();
  const instances = useInstances();
  const instance = useSelectedInstance();
  const game = useGame();
  const { servers } = useInstanceServers(instance?.id ?? null);
  const [starting, setStarting] = useState(false);
  const [chosenPanel, setChosenPanel] = useState<SidePanel | null>(null);
  const panel = chosenPanel ?? (servers.length > 0 ? 'servers' : 'news');
  const gameActive = isSessionActive(game.session);
  const launchTask = useTask(game.session?.installTaskId ?? null);
  const launching = isSessionStarting(game.session);
  const progress = game.session ? launchProgress(game.session, launchTask) : 0;
  const activeStep = game.session?.steps.find((step) => step.state === 'active');

  const play = async (server: string | null = null): Promise<void> => {
    if (gameActive) {
      setOverlayHidden(false);
      return;
    }
    setStarting(true);
    await playInstance(instance, server);
    setStarting(false);
  };

  const lead = !account ? t('home.noAccountText') : !instance ? t('home.noInstanceText') : instance.installedVersionId ? t('home.readyText') : t('home.firstLaunchText');

  const instanceMenu: MenuEntry[] = [
    { heading: t('home.pickInstance') },
    ...instances.slice(0, 8).map((entry) => ({
      label: entry.name,
      hint: instanceVersionLabel(entry),
      active: entry.id === instance?.id,
      onSelect: () => void selectInstance(entry.id).catch(showError)
    })),
    'separator',
    { label: t('home.manageInstances'), icon: 'instances', onSelect: () => navigate('instances') }
  ];

  return (
    <div className={styles.home}>
      <div className={styles.top}>
        <section className={cx(styles.hero, 'cl-stagger')}>
          {instance && (
            <span className={styles.badge}>
              <span className={styles.badgeDot} aria-hidden="true" />
              {instance.lastPlayedAt ? t('home.lastLaunch', { name: instanceVersionLabel(instance) }) : t('home.newInstance', { name: instanceVersionLabel(instance) })}
            </span>
          )}
          <h1 className={styles.greeting}>
            {t('home.greeting')} <span className={styles.greetingName}>{account?.username ?? t('home.guest')}</span>
          </h1>
          <p className={styles.lead}>{lead}</p>
        </section>

        <section aria-label={panel === 'news' ? t('home.tabNews') : t('home.serversTitle')} className={styles.servers} style={{ animation: 'cl-rise 0.5s 0.1s var(--ease-out) both' }}>
          <div className={styles.serversHeader}>
            <div role="tablist" className={styles.panelTabs}>
              {(['news', 'servers'] as SidePanel[]).map((id) => (
                <button key={id} type="button" role="tab" aria-selected={panel === id} className={cx(styles.panelTab, panel === id && styles.panelTabActive)} onClick={() => setChosenPanel(id)}>
                  {id === 'news' ? t('home.tabNews') : t('home.tabServers')}
                </button>
              ))}
            </div>
            {panel === 'servers' && instance && (
              <button type="button" className={styles.linkButton} onClick={() => navigate('instance', { id: instance.id, tab: 'servers' })}>
                {servers.length > 0 ? t('home.serversAll') : t('home.serversAdd')}
              </button>
            )}
          </div>
          {panel === 'news' ? (
            <NewsList />
          ) : (
            <div className={styles.serverList}>
              {servers.slice(0, MAX_SERVERS).map((server) => (
                <ServerRow key={`${server.index}-${server.address}`} server={server} onPlay={(address) => void play(address)} />
              ))}
              {servers.length === 0 && <div className={styles.serversEmpty}>{t('home.serversEmpty')}</div>}
            </div>
          )}
        </section>
      </div>

      <div className={styles.bottom} style={{ animation: 'cl-rise 0.5s 0.16s var(--ease-out) both' }}>
        <div className={styles.playBar}>
          <Menu
            entries={instanceMenu}
            width={300}
            placement="above"
            trigger={(props) => (
              <button type="button" className={cx('cl-hover', styles.instanceCard)} style={instance ? ({ '--cover-glow': coverGlow(instance.cover) } as CSSProperties) : undefined} {...props}>
                {instance && <img src={coverImage(instance.cover)} alt="" className={styles.instanceCover} />}
                <span className={styles.instanceShade} aria-hidden="true" />
                <span className={styles.instanceInfo}>
                  <span className={styles.instanceEyebrow}>
                    {t('home.changeInstance')}
                    <Icon name="chevronDown" size={13} strokeWidth={2.6} />
                  </span>
                  <span className={styles.instanceName}>{instance?.name ?? t('home.noInstance')}</span>
                  {instance && (
                    <span className={styles.instanceStats}>
                      <span>{instanceVersionLabel(instance)}</span>
                      {instance.contentCount > 0 && <span>{count('content', instance.contentCount)}</span>}
                      {instance.totalPlayTimeMs > 0 && <span>{t('instance.playTime', { time: formatPlayTime(instance.totalPlayTimeMs, language) })}</span>}
                      {instance.lastPlayedAt && <span>{formatRelative(instance.lastPlayedAt, language)}</span>}
                    </span>
                  )}
                </span>
              </button>
            )}
          />
          <button type="button" className={cx('cl-hover', styles.playButton, gameActive && styles.playButtonBusy)} disabled={starting} onClick={() => void play()}>
            {launching && <span aria-hidden="true" className={styles.playFill} style={{ transform: `scaleX(${progress})` }} />}
            {launching ? (
              <span className={styles.playProgress}>
                <span className={styles.playPercent}>{Math.floor(progress * 100)}%</span>
                <span className={styles.playStep}>{activeStep ? t(STEP_LABELS[activeStep.id], { server: game.session?.server ?? '' }) : t('tasks.preparing')}</span>
              </span>
            ) : (
              <>
                <Icon name="play" size={22} />
                {gameActive ? t('home.inGameButton') : t('home.playButton')}
              </>
            )}
          </button>
        </div>
        <nav aria-label={t('home.quickAccess')} className={styles.quick}>
          {QUICK_LINKS.map((link) => (
            <button key={link.route} type="button" className={cx('cl-hover', styles.glassCard, styles.quickCard)} onClick={() => navigate(link.route)}>
              <Icon name={link.icon} size={22} color="var(--accent-soft)" />
              <span className={styles.cardText}>
                <span className={styles.cardTitle} style={{ fontSize: 13.5 }}>
                  {t(link.title)}
                </span>
              </span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
