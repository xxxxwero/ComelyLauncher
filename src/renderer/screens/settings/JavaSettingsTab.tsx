import { useEffect, useState } from 'react';
import type { JavaInstallation } from '../../../shared/types/system';
import { invoke } from '../../api/launcher-api';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Feedback';
import { Field, TextInput, formStyles } from '../../components/ui/Field';
import { ToggleRow } from '../../components/ui/Toggle';
import { useDraft } from '../../hooks/use-draft';
import { useI18n } from '../../i18n/i18n';
import { updateSettings, useSettings } from '../../state/settings-store';
import { showError } from '../../state/toast-store';
import { cx } from '../../utils/cx';
import styles from './SettingsScreen.module.css';

export function JavaSettingsTab() {
  const { t } = useI18n();
  const settings = useSettings();
  const [installations, setInstallations] = useState<JavaInstallation[] | null>(null);
  const save = (patch: Parameters<typeof updateSettings>[0]) => void updateSettings(patch).catch(showError);
  const [jvmArgs, setJvmArgs] = useDraft(settings.java.jvmArguments, (jvmArguments) => save({ java: { jvmArguments } }), 700);
  const customPath = settings.java.customPath;

  useEffect(() => {
    invoke('java:detect').then(setInstallations).catch((error) => {
      setInstallations([]);
      showError(error);
    });
  }, []);

  const browse = async (): Promise<void> => {
    try {
      const file = await invoke('settings:pickJavaExecutable');
      if (file) save({ java: { customPath: file } });
    } catch (error) {
      showError(error);
    }
  };

  return (
    <div className={styles.scroll}>
      <Field label={t('settings.javaPath')} hint={t('settings.javaHint')}>
        {(id) => (
          <div className={styles.inline}>
            <TextInput id={id} mono readOnly value={customPath || t('settings.javaAuto')} />
            <Button size="lg" style={{ height: 46 }} onClick={() => void browse()}>
              {t('settings.browse')}
            </Button>
            {customPath && (
              <Button size="lg" style={{ height: 46 }} onClick={() => save({ java: { customPath: '' } })}>
                {t('settings.useAuto')}
              </Button>
            )}
          </div>
        )}
      </Field>
      <div className={styles.toggles}>
        <ToggleRow label={t('settings.autoDownload')} checked={settings.java.autoDownload} disabled={Boolean(customPath)} onChange={(autoDownload) => save({ java: { autoDownload } })} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className={formStyles.label}>{t('settings.detected')}</span>
        {installations === null ? (
          <span className={formStyles.hint} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Spinner size={14} />
            {t('settings.detecting')}
          </span>
        ) : installations.length === 0 ? (
          <span className={formStyles.hint}>{t('settings.noneDetected')}</span>
        ) : (
          <div className={styles.javaList}>
            {installations.map((java) => {
              const active = java.path.toLowerCase() === customPath.toLowerCase();
              return (
                <div key={java.path} className={cx(styles.javaRow, active && styles.javaRowActive)}>
                  <span className={styles.javaBadge}>{java.majorVersion}</span>
                  <span className={styles.javaText}>
                    <span className={styles.javaTitle}>
                      Java {java.version}
                      {java.vendor ? ` · ${java.vendor}` : ''}
                      {java.managed ? ` · ${t('settings.managedJava')}` : ''}
                    </span>
                    <span className={styles.javaPath} title={java.path}>
                      {java.path}
                    </span>
                  </span>
                  {!active && (
                    <Button size="sm" onClick={() => save({ java: { customPath: java.path } })}>
                      {t('settings.selectJava')}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Field label={t('settings.jvmArgs')}>{(id) => <TextInput id={id} mono value={jvmArgs} onChange={(event) => setJvmArgs(event.target.value)} />}</Field>
    </div>
  );
}
