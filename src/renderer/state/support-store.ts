import { invoke } from '../api/launcher-api';
import { createStore, useStore } from './create-store';

export const supportUnreadStore = createStore<number>(0);

export function useSupportUnread(): number {
  return useStore(supportUnreadStore);
}

export function refreshSupportUnread(): void {
  invoke('support:unread')
    .then((count) => supportUnreadStore.set(count))
    .catch(() => undefined);
}
