import type { AccountsState, AccountSummary } from '../../shared/types/accounts';
import { invoke } from '../api/launcher-api';
import { createStore, useStore } from './create-store';

export const accountsStore = createStore<AccountsState>({ accounts: [], activeId: null, restoreFailed: false });

export function useAccounts(): AccountsState {
  return useStore(accountsStore);
}

export function useActiveAccount(): AccountSummary | null {
  const state = useAccounts();
  return state.accounts.find((account) => account.id === state.activeId) ?? null;
}

export async function loadAccounts(): Promise<void> {
  accountsStore.set(await invoke('accounts:get'));
}

export function applyAccounts(state: AccountsState): void {
  accountsStore.set(state);
}
