import { useEffect, useState } from 'react';
import { SplashScreen, type SplashStage } from '../screens/splash/SplashScreen';
import { bootstrap } from '../state/bootstrap';
import { useStore } from '../state/create-store';
import { settingsStore, systemInfoStore } from '../state/settings-store';
import { showError } from '../state/toast-store';
import { LauncherShell } from './LauncherShell';

const MIN_SPLASH_MS = 2500;
const SPLASH_FADE_MS = 520;
const RESUMED_FROM_TRAY = window.location.hash === '#resume';

export function App() {
  const settings = useStore(settingsStore);
  const systemInfo = useStore(systemInfoStore);
  const [stage, setStage] = useState<SplashStage>('checking');
  const [ready, setReady] = useState(false);
  const [splashVisible, setSplashVisible] = useState(!RESUMED_FROM_TRAY);

  useEffect(() => {
    const startedAt = Date.now();
    bootstrap(setStage)
      .catch(showError)
      .finally(() => {
        if (RESUMED_FROM_TRAY) {
          setReady(true);
          return;
        }
        const remaining = Math.max(0, MIN_SPLASH_MS - (Date.now() - startedAt));
        setTimeout(() => {
          setReady(true);
          setTimeout(() => setSplashVisible(false), SPLASH_FADE_MS);
        }, remaining);
      });
  }, []);

  useEffect(() => {
    if (settings) document.documentElement.lang = settings.launcher.language;
  }, [settings]);

  return (
    <>
      {ready && settings && <LauncherShell />}
      {splashVisible && <SplashScreen stage={stage} leaving={ready} version={systemInfo?.launcherVersion ?? null} />}
    </>
  );
}
