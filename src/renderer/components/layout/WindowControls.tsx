import { useEffect, useState } from 'react';
import { invoke, subscribe } from '../../api/launcher-api';
import { useI18n } from '../../i18n/i18n';
import { showError } from '../../state/toast-store';
import { cx } from '../../utils/cx';
import { WindowGlyph } from '../ui/Icon';
import styles from './Layout.module.css';

export function WindowControls() {
  const { t } = useI18n();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    invoke('window:state').then((state) => setMaximized(state.maximized)).catch(showError);
    return subscribe('window:state', (state) => setMaximized(state.maximized));
  }, []);

  return (
    <div className={styles.windowControls}>
      <button type="button" aria-label={t('window.minimize')} className={styles.windowButton} onClick={() => void invoke('window:minimize')}>
        <WindowGlyph kind="minimize" />
      </button>
      <button
        type="button"
        aria-label={maximized ? t('window.restore') : t('window.maximize')}
        className={styles.windowButton}
        onClick={() => invoke('window:toggleMaximize').then((state) => setMaximized(state.maximized)).catch(showError)}
      >
        <WindowGlyph kind={maximized ? 'restore' : 'maximize'} />
      </button>
      <button type="button" aria-label={t('window.close')} className={cx(styles.windowButton, styles.windowClose)} onClick={() => void invoke('window:close')}>
        <WindowGlyph kind="close" />
      </button>
    </div>
  );
}
