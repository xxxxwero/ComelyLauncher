import { useEffect, useState } from 'react';
import type { ExternalProfile } from '../../../shared/types/imports';
import { invoke } from '../../api/launcher-api';
import formStyles from '../../components/instances/InstanceForms.module.css';
import { ServerIcon } from '../../components/servers/ServerIcon';
import { Button } from '../../components/ui/Button';
import { useI18n } from '../../i18n/i18n';
import { showError, showToast } from '../../state/toast-store';
import { LOADER_NAMES } from '../../utils/loader-names';

export function ModrinthProfilesList({ onStarted }: { onStarted: () => void }) {
  const { t, count } = useI18n();
  const [profiles, setProfiles] = useState<ExternalProfile[]>([]);

  useEffect(() => {
    invoke('instances:modrinthProfiles').then(setProfiles).catch(showError);
  }, []);

  const start = async (profile: ExternalProfile): Promise<void> => {
    try {
      await invoke('instances:importModrinthProfile', profile.id);
      showToast(t('instances.importStarted'), 'info');
      onStarted();
    } catch (error) {
      showError(error);
    }
  };

  if (profiles.length === 0) return null;

  return (
    <section aria-label={t('instances.modrinthProfiles')} className={formStyles.profiles}>
      <span className={formStyles.profilesTitle}>{t('instances.modrinthProfiles')}</span>
      <div className={formStyles.profileList}>
        {profiles.map((profile) => (
          <div key={profile.id} className={formStyles.profileRow}>
            <ServerIcon name={profile.name} icon={null} size={40} />
            <span className={formStyles.optionText} style={{ minWidth: 0 }}>
              <span className={formStyles.profileName}>{profile.name}</span>
              <span className={formStyles.optionHint}>
                {profile.gameVersion} · {LOADER_NAMES[profile.loader.type]} · {count('mods', profile.modCount)} · {count('worlds', profile.worldCount)}
              </span>
            </span>
            <Button size="sm" style={{ height: 38 }} onClick={() => void start(profile)}>
              {t('instances.importProfile')}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
