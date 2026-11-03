import { useEffect, useState } from 'react';
import type { LanguageCode } from '../../../shared/types/settings';
import type { DriveInfo } from '../../../shared/types/system';
import type { UpdateStatus } from '../../../shared/types/updates';
import { invoke } from '../../api/launcher-api';
import { APP_ICON } from '../../assets/catalog';
import { Button } from '../../components/ui/Button';
import { Field, SelectInput, TextInput } from '../../components/ui/Field';
import { ToggleRow } from '../../components/ui/Toggle';
import { formatBytes } from '../../i18n/format';
import { useI18n, type TranslationKey } from '../../i18n/i18n';
import { updateSettings, useSettings, useSystemInfo } from '../../state/settings-store';
import { useUpdates } from '../../state/updates-store';
import { showError } from '../../state/toast-store';
import { cx } from '../../utils/cx';
import { GameDirectoryDialog } from './GameDirectoryDialog';
import styles from './SettingsScreen.module.css';

const UPDATE_LABELS: Record<UpdateStatus, TranslationKey> = {
  disabled: 'settings.aboutHint',
  idle: 'settings.aboutHint',
  checking: 'updates.statusChecking',
  'up-to-date': 'updates.statusLatest',
  available: 'updates.statusAvailable',
  downloading: 'updates.statusDownloading',
  ready: 'updates.statusReady',
  failed: 'updates.statusFailed'
};

export function LauncherSettingsTab() {
  const { t, language } = useI18n();
  const settings = useSettings();
  const info = useSystemInfo();
  const updates = useUpdates();
  const [pendingDirectory, setPendingDirectory] = useState<string | null>(null);
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const save = (patch: Parameters<typeof updateSettings>[0]) => void updateSettings(patch).catch(showError);
  const launcher = settings.launcher;

  useEffect(() => {
    invoke('settings:drives').then(setDrives).catch(showError);
  }, [launcher.gameDirectory]);

  const changeDirectory = (directory: string): void => {
    if (directory !== launcher.gameDirectory) setPendingDirectory(directory);
  };

  const browse = async (): Promise<void> => {
    try {
      const directory = await invoke('settings:pickGameDirectory');
      if (directory) changeDirectory(directory);
    } catch (error) {
      showError(error);
    }
  };

  return (
    <div className={styles.scroll}>
      <div className={styles.about}>
        <img src={APP_ICON} alt="" className={styles.aboutIcon} />
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{t('settings.aboutTitle', { version: info?.launcherVersion ?? '' })}</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.66)' }}>{updates ? t(UPDATE_LABELS[updates.status]) : t('settings.aboutHint')}</span>
        </span>
        {updates?.sourceUrl && (
          <Button size="sm" icon="external" onClick={() => updates.sourceUrl && void invoke('shell:openExternal', updates.sourceUrl).catch(showError)}>
            {t('updates.sourceCode')}
          </Button>
        )}
        <Button size="sm" icon="refresh" disabled={updates?.status === 'checking' || updates?.status === 'downloading'} onClick={() => void invoke('updates:check').catch(showError)}>
          {t('updates.check')}
        </Button>
      </div>
      <Field label={t('settings.language')}>
        {(id) => (
          <SelectInput id={id} value={launcher.language} onChange={(event) => save({ launcher: { language: event.target.value as LanguageCode } })}>
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </SelectInput>
        )}
      </Field>
      <Field label={t('settings.gameDir')} hint={t('settings.gameDirHint')}>
        {(id) => (
          <div className={styles.inline}>
            <TextInput id={id} mono readOnly value={launcher.gameDirectory} title={launcher.gameDirectory} />
            <Button size="lg" style={{ height: 46 }} onClick={() => void browse()}>
              {t('settings.browse')}
            </Button>
            {info && launcher.gameDirectory !== info.defaultGameDirectory && (
              <Button size="lg" style={{ height: 46 }} onClick={() => changeDirectory(info.defaultGameDirectory)}>
                {t('settings.gameDirDefault')}
              </Button>
            )}
          </div>
        )}
      </Field>
      {drives.length > 1 && (
        <div className={styles.drives}>
          {drives.map((drive) => {
            const active = launcher.gameDirectory.toLowerCase().startsWith(drive.root.toLowerCase());
            const usedPercent = Math.round(((drive.totalBytes - drive.freeBytes) / drive.totalBytes) * 100);
            return (
              <button key={drive.root} type="button" aria-pressed={active} className={cx('cl-hover', styles.drive, active && styles.driveActive)} title={drive.gameDirectory} onClick={() => !active && changeDirectory(drive.gameDirectory)}>
                <span className={styles.driveName}>{t('settings.gameDirDrive', { drive: drive.root.slice(0, 2) })}</span>
                <span className={styles.driveMeter} aria-hidden="true">
                  <span style={{ width: `${usedPercent}%` }} />
                </span>
                <span className={styles.driveFree}>{t('settings.gameDirDriveFree', { free: formatBytes(drive.freeBytes, language) })}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className={styles.toggles}>
        <ToggleRow label={t('settings.hideOnLaunch')} checked={launcher.hideOnLaunch} onChange={(hideOnLaunch) => save({ launcher: { hideOnLaunch } })} />
        <ToggleRow label={t('settings.tray')} checked={launcher.minimizeToTray} onChange={(minimizeToTray) => save({ launcher: { minimizeToTray } })} />
        <ToggleRow label={t('settings.console')} checked={launcher.showGameConsole} onChange={(showGameConsole) => save({ launcher: { showGameConsole } })} />
        <ToggleRow label={t('settings.discordPresence')} checked={launcher.discordPresence} onChange={(discordPresence) => save({ launcher: { discordPresence } })} />
      </div>
      {pendingDirectory && <GameDirectoryDialog directory={pendingDirectory} onClose={() => setPendingDirectory(null)} />}
    </div>
  );
}
