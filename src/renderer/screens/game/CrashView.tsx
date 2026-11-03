import { useState } from 'react';
import type { CrashCause, GameSession } from '../../../shared/types/game';
import type { Instance } from '../../../shared/types/instances';
import { invoke } from '../../api/launcher-api';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { formatGigabytes } from '../../i18n/format';
import { useI18n, type TranslationKey } from '../../i18n/i18n';
import { navigate } from '../../state/navigation-store';
import { showError, showToast } from '../../state/toast-store';
import { instanceVersionLabel } from '../../utils/loader-names';
import { SupportComposeDialog } from '../support/SupportComposeDialog';
import { GameConsole } from './GameConsole';
import styles from './GameOverlay.module.css';

const CAUSE_TEXT: Record<CrashCause, TranslationKey> = {
  'out-of-memory': 'game.causeOutOfMemory',
  'wrong-java': 'game.causeWrongJava',
  'mod-conflict': 'game.causeModConflict',
  'missing-dependency': 'game.causeMissingDependency',
  'graphics-driver': 'game.causeGraphicsDriver',
  unknown: 'game.causeUnknown'
};

interface CrashViewProps {
  session: GameSession;
  instance: Instance | null;
  logs: string[];
  onPlayAgain: () => void;
  onDismiss: () => void;
}

export function CrashView({ session, instance, logs, onPlayAgain, onDismiss }: CrashViewProps) {
  const { t } = useI18n();
  const [reporting, setReporting] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const crash = session.crash;
  const cause = crash?.cause ?? 'unknown';
  const opensSettings = cause === 'out-of-memory' || cause === 'wrong-java';
  const opensInstance = cause === 'mod-conflict' || cause === 'missing-dependency';

  const goTo = (): void => {
    void invoke('game:dismiss');
    if (opensSettings) navigate('settings', { tab: cause === 'wrong-java' ? 'java' : 'game' });
    else navigate('instance', { id: session.instanceId });
  };

  return (
    <section role="alertdialog" aria-label={t('game.crashTitle')} className={`${styles.card} ${styles.wide}`}>
      <div className={styles.head}>
        <span className={styles.warningIcon} aria-hidden="true">
          <Icon name="warning" size={26} strokeWidth={2.2} color="var(--accent-soft)" />
        </span>
        <div className={styles.headText}>
          <h1 className={styles.title} style={{ fontSize: 22 }}>
            {t('game.crashTitle')}
          </h1>
          <span className={styles.meta}>{t('game.crashMeta', { name: instance ? instanceVersionLabel(instance) : '', code: crash?.exitCode ?? '—' })}</span>
        </div>
      </div>
      {crash?.excerpt && <pre className={styles.excerpt}>{crash.excerpt}</pre>}
      <div className={styles.cause}>
        <span className={styles.causeText}>{t(CAUSE_TEXT[cause], { memory: t('common.gb', { value: formatGigabytes(session.memoryMb) }) })}</span>
        {(opensSettings || opensInstance) && (
          <Button variant="light" size="sm" style={{ height: 40 }} onClick={goTo}>
            {opensSettings ? t('game.openSettings') : t('game.openInstance')}
          </Button>
        )}
      </div>
      {consoleOpen && <GameConsole lines={logs} />}
      <div className={styles.actions} style={{ justifyContent: 'stretch' }}>
        <Button variant="primary" size="lg" icon="support" style={{ flex: 1 }} onClick={() => setReporting(true)}>
          {t('game.reportToDeveloper')}
        </Button>
        <Button size="lg" icon="copy" onClick={() => invoke('game:copyLog').then(() => showToast(t('game.logCopied'))).catch(showError)}>
          {t('game.copyLog')}
        </Button>
        <Button size="lg" icon="terminal" aria-expanded={consoleOpen} onClick={() => setConsoleOpen((value) => !value)}>
          {t('game.console')}
        </Button>
      </div>
      <div className={styles.actions}>
        <Button icon="folder" onClick={() => invoke('game:openLogsFolder').catch(showError)}>
          {t('game.logsFolder')}
        </Button>
        <Button icon="refresh" onClick={onPlayAgain}>
          {t('common.retry')}
        </Button>
        <Button onClick={onDismiss}>{t('common.close')}</Button>
      </div>
      {reporting && <SupportComposeDialog initialSubject={t('game.reportSubject', { name: instance ? instanceVersionLabel(instance) : '' })} onClose={() => setReporting(false)} />}
    </section>
  );
}
