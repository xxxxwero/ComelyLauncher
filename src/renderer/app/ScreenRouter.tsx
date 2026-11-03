import type { ComponentType } from 'react';
import { AccountScreen } from '../screens/account/AccountScreen';
import { ContentScreen } from '../screens/content/ContentScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { InstanceScreen } from '../screens/instance/InstanceScreen';
import { InstancesScreen } from '../screens/instances/InstancesScreen';
import { ScreenshotsScreen } from '../screens/screenshots/ScreenshotsScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { SkinsScreen } from '../screens/skins/SkinsScreen';
import { SupportScreen } from '../screens/support/SupportScreen';
import { VersionsScreen } from '../screens/versions/VersionsScreen';
import type { Route, RouteId } from '../state/navigation-store';

export interface ScreenProps {
  params: Record<string, string>;
}

const SCREENS: Record<RouteId, ComponentType<ScreenProps>> = {
  home: HomeScreen,
  instances: InstancesScreen,
  instance: InstanceScreen,
  versions: VersionsScreen,
  content: ContentScreen,
  skins: SkinsScreen,
  screenshots: ScreenshotsScreen,
  account: AccountScreen,
  settings: SettingsScreen,
  support: SupportScreen
};

export function ScreenRouter({ route }: { route: Route }) {
  const Screen = SCREENS[route.id];
  return <Screen key={`${route.id}:${JSON.stringify(route.params)}`} params={route.params} />;
}
