import { subscribe } from '../api/launcher-api';
import { applyAccounts, loadAccounts } from './accounts-store';
import { appendLogs, applySession, loadGameSession } from './game-store';
import { instancesStore, loadInstances } from './instances-store';
import { loadSettings, settingsStore } from './settings-store';
import { loadTasks, tasksStore } from './tasks-store';
import { loadUpdates, updatesStore } from './updates-store';

let subscribed = false;

function subscribeToEvents(): void {
  if (subscribed) return;
  subscribed = true;
  subscribe('settings:changed', (settings) => settingsStore.set(settings));
  subscribe('accounts:changed', applyAccounts);
  subscribe('instances:changed', (instances) => instancesStore.set(instances));
  subscribe('tasks:changed', (tasks) => tasksStore.set(tasks));
  subscribe('game:session', applySession);
  subscribe('game:log', appendLogs);
  subscribe('updates:changed', (state) => updatesStore.set(state));
}

export async function bootstrap(onStage: (stage: 'checking' | 'profile' | 'ready') => void): Promise<void> {
  subscribeToEvents();
  onStage('checking');
  await loadSettings();
  onStage('profile');
  await Promise.all([loadAccounts(), loadInstances(), loadTasks(), loadGameSession(), loadUpdates()]);
  onStage('ready');
}
