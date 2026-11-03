import { useEffect } from 'react';
import { resolveAccent } from '../assets/catalog';
import { applyAccent } from '../theme/accent';
import { AppBackground } from '../components/layout/AppBackground';
import { Sidebar } from '../components/layout/Sidebar';
import { WindowControls } from '../components/layout/WindowControls';
import layout from '../components/layout/Layout.module.css';
import { DownloadsDock } from '../components/tasks/DownloadsDock';
import { ToastHost } from '../components/ui/Feedback';
import { translate } from '../i18n/i18n';
import { GameOverlay } from '../screens/game/GameOverlay';
import { accountsStore } from '../state/accounts-store';
import { useGame } from '../state/game-store';
import { useRoute } from '../state/navigation-store';
import { useSettings } from '../state/settings-store';
import { refreshSupportUnread } from '../state/support-store';
import { showToast } from '../state/toast-store';
import { cx } from '../utils/cx';
import { ScreenRouter } from './ScreenRouter';

const SUPPORT_UNREAD_REFRESH_MS = 5 * 60 * 1000;

export function LauncherShell() {
  const settings = useSettings();
  const route = useRoute();
  const game = useGame();
  const overlayVisible = Boolean(game.session) && !game.overlayHidden;
  const accent = resolveAccent(settings.appearance);

  useEffect(() => applyAccent(accent), [accent]);
  const variant = overlayVisible ? 'overlay' : route.id === 'home' ? 'hero' : 'inner';

  useEffect(() => {
    if (accountsStore.get().restoreFailed) showToast(translate('account.restoreFailed'), 'error');
  }, []);

  useEffect(() => {
    refreshSupportUnread();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refreshSupportUnread();
    }, SUPPORT_UNREAD_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={layout.shell}>
      <AppBackground appearance={settings.appearance} variant={variant} />
      {overlayVisible ? (
        <GameOverlay />
      ) : (
        <>
          <Sidebar />
          <main className={layout.main} data-direction={route.direction}>
            <ScreenRouter route={route} />
          </main>
        </>
      )}
      <div className={cx(layout.dragRegion, overlayVisible && layout.dragRegionFull)} aria-hidden="true" />
      <WindowControls />
      {overlayVisible && <DownloadsDock hiddenTaskId={game.session?.installTaskId ?? null} floating />}
      <ToastHost />
    </div>
  );
}
