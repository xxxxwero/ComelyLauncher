import { APP_ICON_LARGE } from '../../assets/catalog';
import { useI18n } from '../../i18n/i18n';
import { cx } from '../../utils/cx';
import styles from './SplashScreen.module.css';

export type SplashStage = 'checking' | 'profile' | 'ready';

const CUBES: Array<[number, number]> = [
  [68, 36], [100, 36], [132, 36], [164, 36],
  [36, 68], [68, 68],
  [36, 100], [68, 100],
  [36, 132], [68, 132],
  [68, 164], [100, 164], [132, 164], [164, 164]
];

const PROGRESS: Record<SplashStage, number> = { checking: 34, profile: 72, ready: 100 };

interface SplashScreenProps {
  stage: SplashStage;
  leaving: boolean;
  version: string | null;
}

export function SplashScreen({ stage, leaving, version }: SplashScreenProps) {
  const { t } = useI18n();
  return (
    <div className={cx(styles.splash, leaving && styles.leaving)} aria-busy={!leaving}>
      <div className={styles.stage}>
        <div className={styles.glow} aria-hidden="true" />
        <div className={styles.plate} aria-hidden="true" />
        {CUBES.map(([x, y], index) => (
          <span key={`${x}-${y}`} aria-hidden="true" className={styles.cube} style={{ left: 184 + x, top: 184 + y, animationDelay: `${index * 0.03}s` }} />
        ))}
        <div className={styles.icon}>
          <img src={APP_ICON_LARGE} alt="ComelyLauncher" />
          <span className={styles.shine} aria-hidden="true" />
        </div>
        <div className={styles.word}>
          <h1 className={styles.title}>
            Comely<span className={styles.titleAccent}>Launcher</span>
          </h1>
          <div role="progressbar" aria-label="ComelyLauncher" aria-valuenow={PROGRESS[stage]} aria-valuemin={0} aria-valuemax={100} className={styles.progress}>
            <div className={styles.progressBar} style={{ width: `${PROGRESS[stage]}%` }} />
          </div>
          <span key={stage} className={styles.status}>
            {t(`splash.${stage}`)}
          </span>
        </div>
      </div>
      {version && <span className={styles.version}>v{version}</span>}
    </div>
  );
}
