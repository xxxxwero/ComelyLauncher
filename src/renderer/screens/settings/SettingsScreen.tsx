import { useState, type ComponentType } from 'react';
import type { ScreenProps } from '../../app/ScreenRouter';
import { Panel, Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { ConfirmDialog } from '../../components/ui/Modal';
import { useI18n, type TranslationKey } from '../../i18n/i18n';
import { resetSettings } from '../../state/settings-store';
import { showError, showToast } from '../../state/toast-store';
import { cx } from '../../utils/cx';
import { AppearanceSettingsTab } from './AppearanceSettingsTab';
import { GameSettingsTab } from './GameSettingsTab';
import { JavaSettingsTab } from './JavaSettingsTab';
import { LauncherSettingsTab } from './LauncherSettingsTab';
import styles from './SettingsScreen.module.css';

type TabId = 'game' | 'java' | 'look' | 'launcher';

const TABS: Array<{ id: TabId; label: TranslationKey; component: ComponentType }> = [
  { id: 'game', label: 'settings.tabGame', component: GameSettingsTab },
  { id: 'java', label: 'settings.tabJava', component: JavaSettingsTab },
  { id: 'look', label: 'settings.tabLook', component: AppearanceSettingsTab },
  { id: 'launcher', label: 'settings.tabLauncher', component: LauncherSettingsTab }
];

function isTab(value: string | undefined): value is TabId {
  return TABS.some((tab) => tab.id === value);
}

export function SettingsScreen({ params }: ScreenProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<TabId>(isTab(params.tab) ? params.tab : 'game');
  const [confirmReset, setConfirmReset] = useState(false);
  const Active = (TABS.find((entry) => entry.id === tab) ?? TABS[0]).component;

  const reset = async (): Promise<void> => {
    try {
      await resetSettings();
      showToast(t('settings.resetDone'));
    } catch (error) {
      showError(error);
    } finally {
      setConfirmReset(false);
    }
  };

  return (
    <Screen title={t('settings.title')} subtitle={t('settings.subtitle')}>
      <div className={styles.body}>
        <Panel as="nav" label={t('settings.sections')} className={styles.tabs}>
          {TABS.map((entry) => (
            <button key={entry.id} type="button" aria-pressed={tab === entry.id} className={cx(styles.tab, tab === entry.id && styles.tabActive)} onClick={() => setTab(entry.id)}>
              {t(entry.label)}
            </button>
          ))}
        </Panel>
        <Panel className={styles.content}>
          <Active key={tab} />
          <div className={styles.footer}>
            <span className={styles.autosave}>
              <Icon name="check" size={14} strokeWidth={3} color="var(--accent-soft)" />
              {t('settings.autosave')}
            </span>
            <Button onClick={() => setConfirmReset(true)}>{t('settings.reset')}</Button>
          </div>
        </Panel>
      </div>
      {confirmReset && <ConfirmDialog title={t('settings.resetTitle')} text={t('settings.resetText')} confirmLabel={t('settings.reset')} onCancel={() => setConfirmReset(false)} onConfirm={reset} />}
    </Screen>
  );
}
