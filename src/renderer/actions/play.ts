import type { Instance } from '../../shared/types/instances';
import { invoke } from '../api/launcher-api';
import { translate } from '../i18n/i18n';
import { accountsStore } from '../state/accounts-store';
import { launchGame } from '../state/game-store';
import { navigate } from '../state/navigation-store';
import { showError, showToast } from '../state/toast-store';
import { latestRelease, loadVersions, versionsStore } from '../state/versions-store';

async function defaultInstance(): Promise<Instance> {
  if (versionsStore.get().entries.length === 0) await loadVersions();
  const latest = latestRelease(versionsStore.get().entries);
  if (!latest) throw versionsStore.get().error ?? new Error('No versions available');
  return invoke('instances:ensureForVersion', latest, 'vanilla');
}

export async function playInstance(instance: Instance | null, server: string | null = null): Promise<void> {
  if (!accountsStore.get().activeId) {
    showToast(translate('errors.no-account'), 'info');
    navigate('account', { add: '1' });
    return;
  }
  try {
    const target = instance ?? (await defaultInstance());
    await launchGame(target.id, { server });
  } catch (error) {
    showError(error);
  }
}
