import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { presetSkinTexture } from '../../components/skin/preset-skin-texture';
import { useI18n, type TranslationKey } from '../../i18n/i18n';
import { useActiveAccount } from '../../state/accounts-store';
import { useSkinProfile } from '../../state/skin-profiles-store';
import styles from './GameOverlay.module.css';

const WalkingSkin = lazy(() => import('../../components/skin/WalkingSkin').then((module) => ({ default: module.WalkingSkin })));

const TIPS: TranslationKey[] = ['game.tip1', 'game.tip2', 'game.tip3', 'game.tip4', 'game.tip5', 'game.tip6', 'game.tip7', 'game.tip8'];
const TIP_INTERVAL_MS = 7000;
const FIGURE_WIDTH = 240;
const FIGURE_HEIGHT = 300;

export function LaunchStage({ walking }: { walking: boolean }) {
  const { t } = useI18n();
  const account = useActiveAccount();
  const online = Boolean(account) && account?.type !== 'offline';
  const entry = useSkinProfile(account?.id ?? null, online);
  const profile = entry?.status === 'ready' ? entry.profile : null;
  const fallback = useMemo(() => presetSkinTexture(account?.avatarPreset ?? 0), [account?.avatarPreset]);
  const waitingForSkin = online && (!entry || entry.status === 'loading');
  const [tip, setTip] = useState(() => Math.floor(Math.random() * TIPS.length));

  useEffect(() => {
    const timer = setInterval(() => setTip((value) => (value + 1) % TIPS.length), TIP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <aside className={styles.stage}>
      <div className={styles.figure}>
        {!waitingForSkin && (
          <Suspense fallback={null}>
            <WalkingSkin skin={profile?.skinDataUrl ?? fallback} model={profile?.model ?? 'classic'} walking={walking} width={FIGURE_WIDTH} height={FIGURE_HEIGHT} />
          </Suspense>
        )}
      </div>
      <p key={tip} className={styles.tip}>
        {t(TIPS[tip])}
      </p>
    </aside>
  );
}
