import { APP_ICON } from '../../assets/catalog';
import { useI18n, type TranslationKey } from '../../i18n/i18n';
import { useActiveAccount } from '../../state/accounts-store';
import { isSessionActive, setOverlayHidden, useGame } from '../../state/game-store';
import { navigate, useRoute, type RouteId } from '../../state/navigation-store';
import { useSupportUnread } from '../../state/support-store';
import { cx } from '../../utils/cx';
import { AccountAvatar } from '../skin/AccountAvatar';
import { DownloadsDock } from '../tasks/DownloadsDock';
import { Icon, type IconName } from '../ui/Icon';
import { UpdateCard } from './UpdateCard';
import styles from './Layout.module.css';

interface NavEntry {
  id: RouteId;
  icon: IconName;
  label: TranslationKey;
  activeFor?: RouteId[];
}

const NAV_ITEM_STEP = 48;

const NAV: NavEntry[] = [
  { id: 'home', icon: 'home', label: 'nav.home' },
  { id: 'instances', icon: 'instances', label: 'nav.instances', activeFor: ['instance'] },
  { id: 'versions', icon: 'versions', label: 'nav.versions' },
  { id: 'content', icon: 'content', label: 'nav.content' },
  { id: 'skins', icon: 'skins', label: 'nav.skins' },
  { id: 'screenshots', icon: 'screenshots', label: 'nav.screenshots' },
  { id: 'account', icon: 'account', label: 'nav.account' },
  { id: 'settings', icon: 'settings', label: 'nav.settings' },
  { id: 'support', icon: 'support', label: 'nav.support' }
];

const TYPE_LABELS: Record<string, TranslationKey> = {
  microsoft: 'account.typeMicrosoft',
  elyby: 'account.typeElyby',
  offline: 'account.typeOffline'
};

export function Sidebar() {
  const { t } = useI18n();
  const route = useRoute();
  const account = useActiveAccount();
  const game = useGame();
  const gameActive = isSessionActive(game.session);
  const supportUnread = useSupportUnread();
  const activeIndex = NAV.findIndex((entry) => route.id === entry.id || entry.activeFor?.includes(route.id));

  return (
    <aside className={styles.sidebar}>
      <button type="button" className={styles.brand} onClick={() => navigate('home')}>
        <img src={APP_ICON} alt="" className={styles.brandIcon} />
        <span className={styles.brandName}>
          Comely<span className={styles.brandAccent}>Launcher</span>
        </span>
      </button>
      <nav aria-label={t('nav.sections')} className={styles.nav}>
        {activeIndex >= 0 && <span aria-hidden="true" className={styles.navIndicator} style={{ transform: `translateY(${activeIndex * NAV_ITEM_STEP}px)` }} />}
        {NAV.map((entry) => {
          const active = route.id === entry.id || entry.activeFor?.includes(route.id);
          return (
            <button
              key={entry.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              className={cx(styles.navItem, active && styles.navItemActive)}
              onClick={() => navigate(entry.id)}
            >
              <Icon name={entry.icon} color={active ? 'var(--accent-soft)' : 'currentColor'} />
              {t(entry.label)}
              {entry.id === 'home' && gameActive && game.overlayHidden && <span className={styles.navBadge} aria-hidden="true" />}
              {entry.id === 'support' && supportUnread > 0 && <span className={styles.navBadge} aria-label={t('support.unread')} />}
            </button>
          );
        })}
      </nav>
      <div style={{ flex: 1 }} />
      <UpdateCard />
      <DownloadsDock hiddenTaskId={game.session?.installTaskId ?? null} />
      {gameActive && game.overlayHidden && (
        <button type="button" className={cx('cl-hover', styles.sessionPill)} onClick={() => setOverlayHidden(false)}>
          <span className={styles.navBadge} aria-hidden="true" style={{ marginLeft: 0 }} />
          <span className={styles.accountText}>
            <span className={styles.accountName}>{game.session?.phase === 'running' ? t('game.runningPill') : t('game.installingPill')}</span>
            <span className={styles.accountType}>{t('game.show')}</span>
          </span>
          <Icon name="chevronRight" size={16} strokeWidth={2.4} color="rgba(255,255,255,0.6)" />
        </button>
      )}
      <button type="button" className={cx('cl-hover', styles.accountCard)} onClick={() => navigate('account')}>
        <AccountAvatar account={account} size={38} />
        <span className={styles.accountText}>
          <span className={styles.accountName}>{account?.username ?? t('nav.noAccount')}</span>
          <span className={styles.accountType}>{account ? t(TYPE_LABELS[account.type]) : t('nav.noAccountHint')}</span>
        </span>
        <Icon name="chevronRight" size={16} strokeWidth={2.4} color="rgba(255,255,255,0.6)" />
      </button>
    </aside>
  );
}
