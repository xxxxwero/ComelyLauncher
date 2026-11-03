import { LauncherError } from '../../shared/errors';
import { errorMessage } from '../i18n/i18n';
import { createStore, useStore } from './create-store';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

const DURATION_MS: Record<ToastKind, number> = { success: 2200, info: 3200, error: 4800 };

export const toastStore = createStore<Toast[]>([]);
let nextId = 1;

export function useToasts(): Toast[] {
  return useStore(toastStore);
}

export function showToast(text: string, kind: ToastKind = 'success'): void {
  const toast: Toast = { id: nextId++, kind, text };
  toastStore.set((toasts) => [...toasts.slice(-2), toast]);
  setTimeout(() => dismissToast(toast.id), DURATION_MS[kind]);
}

export function showError(error: unknown): void {
  const launcherError = LauncherError.from(error);
  if (launcherError.code === 'cancelled' || launcherError.code === 'auth-cancelled') return;
  showToast(errorMessage(error), 'error');
}

export function dismissToast(id: number): void {
  toastStore.set((toasts) => toasts.filter((toast) => toast.id !== id));
}
