import { APP_ICON, coverImage } from '../../assets/catalog';
import { dismissSession, launchGame, setOverlayHidden, stopGame, useGame } from '../../state/game-store';
import { useInstance } from '../../state/instances-store';
import { useTask } from '../../state/tasks-store';
import { showError } from '../../state/toast-store';
import { CrashView } from './CrashView';
import { InstallView } from './InstallView';
import { isSessionStarting } from './launch-progress';
import { LaunchStage } from './LaunchStage';
import { LaunchView } from './LaunchView';
import styles from './GameOverlay.module.css';

export function GameOverlay() {
  const { session, logs } = useGame();
  const instance = useInstance(session?.instanceId);
  const task = useTask(session?.installTaskId ?? null);
  if (!session) return null;

  const hide = (): void => setOverlayHidden(true);
  const stop = (): void => void stopGame().catch(showError);
  const dismiss = (): void => void dismissSession().catch(showError);
  const playAgain = (): void => void launchGame(session.instanceId, { server: session.server }).catch(showError);
  const showStage = isSessionStarting(session) || session.phase === 'running';
  const showInstall = session.phase === 'installing' && task !== null && (task.totalBytes > 0 || !instance?.installedVersionId);

  return (
    <div className={styles.overlay}>
      {instance && <div aria-hidden="true" className={styles.backdrop} style={{ backgroundImage: `url("${coverImage(instance.cover)}")` }} />}
      <div className={styles.brand}>
        <img src={APP_ICON} alt="" />
        <span className={styles.brandName}>
          Comely<span style={{ color: 'var(--accent-soft)' }}>Launcher</span>
        </span>
      </div>
      <div className={styles.overlayContent}>
        {showStage && <LaunchStage walking={isSessionStarting(session)} />}
        {showInstall && task ? (
          <InstallView instance={instance} task={task} onCancel={stop} onHide={hide} />
        ) : session.phase === 'crashed' ? (
          <CrashView session={session} instance={instance} logs={logs} onPlayAgain={playAgain} onDismiss={dismiss} />
        ) : (
          <LaunchView session={session} instance={instance} task={task} logs={logs} onStop={stop} onHide={hide} onPlayAgain={playAgain} onDismiss={dismiss} />
        )}
      </div>
    </div>
  );
}
