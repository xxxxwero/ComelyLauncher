import type { AccountsState, ElyByCredentials, ElyByLoginResult } from '../types/accounts';
import type { ContentSearchQuery, ContentSearchResult, ContentProjectType } from '../types/content';
import type { GameSession, LaunchOptions } from '../types/game';
import type { ExternalProfile } from '../types/imports';
import type {
  ContentKind,
  InstalledContent,
  Instance,
  InstanceDraft,
  InstanceFolder,
  InstancePatch,
  LoaderType
} from '../types/instances';
import type { Screenshot, ServerDraft, ServerEntry, ServerStatus } from '../types/media';
import type { NewsDraft, NewsItem } from '../types/news';
import type { LauncherSettings, SettingsPatch } from '../types/settings';
import type { SkinLibraryEntry, SkinModel, SkinProfile } from '../types/skins';
import type { SupportSession, SupportThread, SupportTicket, SupportTicketDraft, SupportTicketStatus } from '../types/support';
import type { DriveInfo, GameDirectoryEstimate, JavaInstallation, SystemInfo, WindowState } from '../types/system';
import type { TaskSnapshot } from '../types/tasks';
import type { UpdateState } from '../types/updates';
import type { LoaderVersionEntry, MinecraftVersionEntry } from '../types/versions';
import type { WorldBackup, WorldInfo } from '../types/worlds';

export interface IpcContract {
  'settings:get': () => LauncherSettings;
  'settings:update': (patch: SettingsPatch) => LauncherSettings;
  'settings:reset': () => LauncherSettings;
  'settings:pickGameDirectory': () => string | null;
  'settings:pickJavaExecutable': () => string | null;
  'settings:addBackgrounds': () => LauncherSettings | null;
  'settings:removeBackground': (backgroundId: string) => LauncherSettings;
  'settings:drives': () => DriveInfo[];
  'settings:systemInfo': () => SystemInfo;

  'java:detect': () => JavaInstallation[];

  'accounts:get': () => AccountsState;
  'accounts:loginMicrosoft': () => AccountsState;
  'accounts:loginElyBy': (credentials: ElyByCredentials) => ElyByLoginResult;
  'accounts:addOffline': (username: string) => AccountsState;
  'accounts:select': (accountId: string) => AccountsState;
  'accounts:remove': (accountId: string) => AccountsState;
  'accounts:refresh': (accountId: string) => AccountsState;
  'accounts:setAvatar': (accountId: string, preset: number) => AccountsState;

  'skins:profile': (accountId: string) => SkinProfile;
  'skins:library': () => SkinLibraryEntry[];
  'skins:import': () => SkinLibraryEntry | null;
  'skins:remove': (skinId: string) => SkinLibraryEntry[];
  'skins:setModel': (skinId: string, model: SkinModel) => SkinLibraryEntry[];
  'skins:apply': (accountId: string, skinId: string) => SkinProfile;
  'skins:setCape': (accountId: string, capeId: string | null) => SkinProfile;

  'instances:list': () => Instance[];
  'instances:create': (draft: InstanceDraft) => Instance;
  'instances:update': (instanceId: string, patch: InstancePatch) => Instance;
  'instances:remove': (instanceId: string) => Instance[];
  'instances:ensureForVersion': (gameVersion: string, loader: LoaderType) => Instance;
  'instances:moveToDirectory': (gameDirectory: string) => string;
  'instances:moveEstimate': (gameDirectory: string) => GameDirectoryEstimate;
  'instances:openFolder': (instanceId: string, folder: InstanceFolder) => void;
  'instances:duplicate': (instanceId: string, name: string) => string;
  'instances:exportMrpack': (instanceId: string) => string | null;
  'instances:importModpack': () => string | null;
  'instances:importFolder': () => string | null;
  'instances:modrinthProfiles': () => ExternalProfile[];
  'instances:importModrinthProfile': (profileId: string) => string;
  'instances:content': (instanceId: string) => InstalledContent[];
  'instances:setContentEnabled': (instanceId: string, kind: ContentKind, fileNames: string[], enabled: boolean) => InstalledContent[];
  'instances:removeContent': (instanceId: string, kind: ContentKind, fileNames: string[]) => InstalledContent[];
  'instances:checkUpdates': (instanceId: string) => InstalledContent[];
  'instances:updateContent': (instanceId: string, fileNames: string[]) => string;
  'instances:revealContent': (instanceId: string, kind: ContentKind, fileName: string) => void;
  'instances:servers': (instanceId: string) => ServerEntry[];
  'instances:saveServer': (instanceId: string, index: number | null, draft: ServerDraft) => ServerEntry[];
  'instances:removeServer': (instanceId: string, index: number) => ServerEntry[];

  'servers:ping': (address: string) => ServerStatus;

  'worlds:list': (instanceId: string) => WorldInfo[];
  'worlds:backups': (instanceId: string) => WorldBackup[];
  'worlds:backup': (instanceId: string, folder: string) => string;
  'worlds:restore': (instanceId: string, fileName: string) => string;
  'worlds:remove': (instanceId: string, folder: string) => WorldInfo[];
  'worlds:removeBackup': (instanceId: string, fileName: string) => WorldBackup[];
  'worlds:revealBackup': (instanceId: string, fileName: string) => void;

  'updates:state': () => UpdateState;
  'updates:check': () => UpdateState;
  'updates:download': () => string;
  'updates:install': () => void;

  'news:list': () => NewsItem[];
  'news:canManage': () => boolean;
  'news:create': (draft: NewsDraft) => NewsItem[];
  'news:delete': (newsId: string, kind: NewsItem['kind']) => NewsItem[];

  'support:session': () => SupportSession;
  'support:unread': () => number;
  'support:tickets': (status: SupportTicketStatus) => SupportTicket[];
  'support:thread': (ticketId: string) => SupportThread;
  'support:create': (draft: SupportTicketDraft) => SupportTicket;
  'support:reply': (ticketId: string, text: string) => SupportThread;
  'support:setStatus': (ticketId: string, status: SupportTicketStatus) => SupportThread;
  'support:setBlocked': (ticketId: string, blocked: boolean) => SupportThread;
  'support:log': (ticketId: string) => string;

  'versions:list': (refresh: boolean) => MinecraftVersionEntry[];
  'versions:loaderVersions': (loader: LoaderType, gameVersion: string) => LoaderVersionEntry[];
  'versions:openFolder': (versionId: string) => void;

  'game:install': (instanceId: string) => string;
  'game:launch': (instanceId: string, options: LaunchOptions) => GameSession;
  'game:stop': () => void;
  'game:session': () => GameSession | null;
  'game:dismiss': () => void;
  'game:logs': () => string[];
  'game:openLogsFolder': () => void;
  'game:copyLog': () => void;

  'tasks:list': () => TaskSnapshot[];
  'tasks:cancel': (taskId: string) => void;
  'tasks:dismiss': (taskId: string) => TaskSnapshot[];

  'content:search': (query: ContentSearchQuery) => ContentSearchResult;
  'content:install': (instanceId: string, projectId: string, type: ContentProjectType) => string;
  'content:installModpack': (projectId: string) => string;

  'screenshots:list': () => Screenshot[];
  'screenshots:copy': (path: string) => void;
  'screenshots:reveal': (path: string) => void;
  'screenshots:delete': (path: string) => Screenshot[];

  'window:minimize': () => void;
  'window:toggleMaximize': () => WindowState;
  'window:close': () => void;
  'window:hideToTray': () => void;
  'window:state': () => WindowState;
  'shell:openExternal': (url: string) => void;
}

export interface IpcEvents {
  'settings:changed': LauncherSettings;
  'accounts:changed': AccountsState;
  'instances:changed': Instance[];
  'tasks:changed': TaskSnapshot[];
  'game:session': GameSession | null;
  'game:log': string[];
  'window:state': WindowState;
  'updates:changed': UpdateState;
}

export type IpcChannel = keyof IpcContract;
export type IpcEventName = keyof IpcEvents;

export type IpcArgs<C extends IpcChannel> = Parameters<IpcContract[C]>;
export type IpcReturn<C extends IpcChannel> = Awaited<ReturnType<IpcContract[C]>>;

export const IPC_DOMAINS = [
  'settings',
  'java',
  'accounts',
  'skins',
  'instances',
  'servers',
  'worlds',
  'news',
  'support',
  'updates',
  'versions',
  'game',
  'tasks',
  'content',
  'screenshots',
  'window',
  'shell'
] as const;

export const IPC_INVOKE_BRIDGE = 'comely:invoke';
export const IPC_EVENT_BRIDGE = 'comely:event';
