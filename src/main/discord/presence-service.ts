import type { Instance } from '../../shared/types/instances';
import type { WindowManager } from '../app/window-manager';
import { createLogger } from '../core/logger';
import type { InstanceService } from '../instances/instance-service';
import type { GameSessionService } from '../minecraft/launch/game-session-service';
import type { SettingsService } from '../settings/settings-service';
import { DISCORD_APPLICATION_ID } from './discord-config';
import { DiscordIpcClient } from './discord-ipc-client';
import { buildActivity, isSessionActive } from './presence-activity';

const RECONNECT_DELAY_MS = 30000;

const log = createLogger('discord');

export class PresenceService {
  private client: DiscordIpcClient | null = null;
  private lastSent: string | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private syncing = false;
  private syncAgain = false;

  constructor(
    private readonly settings: SettingsService,
    private readonly instances: InstanceService,
    private readonly sessions: GameSessionService,
    private readonly windows: WindowManager
  ) {}

  start(): void {
    const sync = (): void => this.sync();
    this.settings.onChange(sync);
    this.sessions.onChange(sync);
    this.windows.onVisibilityChange(sync);
    this.sync();
  }

  private sync(): void {
    if (this.syncing) {
      this.syncAgain = true;
      return;
    }
    this.syncing = true;
    this.apply()
      .catch((error: unknown) => log.warn('Could not update Discord activity', error))
      .finally(() => {
        this.syncing = false;
        if (!this.syncAgain) return;
        this.syncAgain = false;
        this.sync();
      });
  }

  private async apply(): Promise<void> {
    if (!DISCORD_APPLICATION_ID || !this.settings.get().launcher.discordPresence) {
      this.disconnect();
      return;
    }
    const client = this.client ?? (await this.connect());
    if (!client) return;
    const session = this.sessions.current();
    const instance = isSessionActive(session) ? await this.findInstance(session.instanceId) : null;
    const activity = buildActivity(session, instance, this.windows.isVisible(), this.settings.get().launcher.language);
    const serialized = JSON.stringify(activity);
    if (serialized === this.lastSent) return;
    client.setActivity(activity);
    this.lastSent = serialized;
  }

  private async connect(): Promise<DiscordIpcClient | null> {
    const client = new DiscordIpcClient(DISCORD_APPLICATION_ID, () => this.handleDisconnected());
    if (!(await client.connect())) {
      this.scheduleReconnect();
      return null;
    }
    this.client = client;
    this.lastSent = null;
    return client;
  }

  private findInstance(instanceId: string): Promise<Instance | null> {
    return this.instances.get(instanceId).catch(() => null);
  }

  private disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.client?.close();
    this.client = null;
    this.lastSent = null;
  }

  private handleDisconnected(): void {
    this.client = null;
    this.lastSent = null;
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.sync();
    }, RECONNECT_DELAY_MS);
    this.reconnectTimer.unref();
  }
}
