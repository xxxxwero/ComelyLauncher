import { createStore, useStore } from './create-store';

export type RouteId = 'home' | 'instances' | 'instance' | 'versions' | 'content' | 'skins' | 'screenshots' | 'account' | 'settings' | 'support';

export type NavigationDirection = 'up' | 'down';

export interface Route {
  id: RouteId;
  params: Record<string, string>;
  direction: NavigationDirection;
}

const ROUTE_ORDER: RouteId[] = ['home', 'instances', 'instance', 'versions', 'content', 'skins', 'screenshots', 'account', 'settings', 'support'];

export const navigationStore = createStore<Route>({ id: 'home', params: {}, direction: 'up' });

export function useRoute(): Route {
  return useStore(navigationStore);
}

export function navigate(id: RouteId, params: Record<string, string> = {}): void {
  const direction = ROUTE_ORDER.indexOf(id) >= ROUTE_ORDER.indexOf(navigationStore.get().id) ? 'up' : 'down';
  navigationStore.set({ id, params, direction });
}
