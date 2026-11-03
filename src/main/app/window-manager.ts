import { app, BrowserWindow, Menu, shell, Tray, nativeImage, type Rectangle } from 'electron';
import path from 'node:path';
import type { WindowState } from '../../shared/types/system';
import { iconPath } from '../core/app-paths';
import type { RendererEvents } from '../core/renderer-events';
import type { GameWindowHooks } from '../minecraft/launch/game-session-service';
import type { SettingsService } from '../settings/settings-service';
import { trayLabels } from './tray-labels';

const HIDDEN_WINDOW_LIFETIME_MS = 20_000;
const RESUME_HASH = 'resume';

export class WindowManager implements GameWindowHooks {
  private window: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private quitting = false;
  private hiddenForGame = false;
  private releaseTimer: NodeJS.Timeout | null = null;
  private releasedBounds: Rectangle | null = null;
  private releasedMaximized = false;

  constructor(
    private readonly settings: SettingsService,
    private readonly events: RendererEvents
  ) {
    settings.onChange((current, previous) => {
      if (current.launcher.language !== previous.launcher.language) this.updateTrayMenu();
    });
  }

  get current(): BrowserWindow | null {
    return this.window && !this.window.isDestroyed() ? this.window : null;
  }

  create(): BrowserWindow {
    const resuming = this.releasedBounds !== null;
    const window = new BrowserWindow({
      ...(this.releasedBounds ?? { width: 1280, height: 720 }),
      minWidth: 1120,
      minHeight: 660,
      frame: false,
      show: !resuming,
      backgroundColor: '#120C09',
      title: 'ComelyLauncher',
      icon: iconPath('comelylauncher.ico'),
      webPreferences: {
        preload: path.join(__dirname, '..', '..', 'preload', 'index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        spellcheck: false
      }
    });
    this.window = window;
    this.events.attach(window);
    window.on('maximize', () => this.emitState());
    window.on('unmaximize', () => this.emitState());
    window.on('close', (event) => {
      if (this.quitting || !this.settings.get().launcher.minimizeToTray) return;
      event.preventDefault();
      this.hide(window);
    });
    window.on('closed', () => {
      if (this.window !== window) return;
      this.window = null;
      if (!this.quitting) this.quit();
    });
    window.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
      return { action: 'deny' };
    });
    window.webContents.on('will-navigate', (event, url) => {
      if (url !== window.webContents.getURL()) event.preventDefault();
    });
    if (resuming) {
      window.once('ready-to-show', () => {
        if (this.releasedMaximized) window.maximize();
        window.show();
        window.focus();
      });
    }
    const devServer = process.env.VITE_DEV_SERVER_URL;
    if (devServer) window.loadURL(resuming ? `${devServer}#${RESUME_HASH}` : devServer);
    else window.loadFile(path.join(__dirname, '..', '..', '..', 'renderer', 'index.html'), resuming ? { hash: RESUME_HASH } : {});
    this.createTray();
    return window;
  }

  state(): WindowState {
    return { maximized: Boolean(this.current?.isMaximized()) };
  }

  minimize(): void {
    this.current?.minimize();
  }

  toggleMaximize(): WindowState {
    const window = this.current;
    if (window?.isMaximized()) window.unmaximize();
    else window?.maximize();
    return this.state();
  }

  close(): void {
    this.current?.close();
  }

  hideToTray(): void {
    const window = this.current;
    if (window) this.hide(window);
  }

  show(): void {
    this.cancelRelease();
    const window = this.current;
    if (!window) {
      if (!this.quitting) this.create();
      return;
    }
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  }

  quit(): void {
    if (this.quitting) return;
    this.quitting = true;
    this.cancelRelease();
    this.tray?.destroy();
    this.tray = null;
    app.quit();
  }

  onGameStarted(): void {
    const window = this.current;
    if (!this.settings.get().launcher.hideOnLaunch || !window?.isVisible()) return;
    this.hiddenForGame = true;
    this.hide(window);
  }

  onGameExited(): void {
    if (!this.hiddenForGame) return;
    this.hiddenForGame = false;
    this.show();
  }

  private hide(window: BrowserWindow): void {
    window.hide();
    this.cancelRelease();
    this.releaseTimer = setTimeout(() => this.release(window), HIDDEN_WINDOW_LIFETIME_MS);
  }

  private release(window: BrowserWindow): void {
    this.releaseTimer = null;
    if (this.window !== window || window.isDestroyed() || window.isVisible()) return;
    this.releasedBounds = window.getNormalBounds();
    this.releasedMaximized = window.isMaximized();
    this.window = null;
    window.destroy();
  }

  private cancelRelease(): void {
    if (this.releaseTimer) clearTimeout(this.releaseTimer);
    this.releaseTimer = null;
  }

  private emitState(): void {
    this.events.emit('window:state', this.state());
  }

  private createTray(): void {
    if (this.tray) return;
    const image = nativeImage.createFromPath(iconPath('comelylauncher.ico'));
    this.tray = new Tray(image.isEmpty() ? nativeImage.createFromPath(iconPath('comelylauncher-icon-256.png')) : image);
    this.tray.on('double-click', () => this.show());
    this.tray.on('click', () => this.show());
    this.updateTrayMenu();
  }

  private updateTrayMenu(): void {
    if (!this.tray) return;
    const labels = trayLabels(this.settings.get().launcher.language);
    this.tray.setToolTip(labels.tooltip);
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: labels.open, click: () => this.show() },
        { type: 'separator' },
        { label: labels.quit, click: () => this.quit() }
      ])
    );
  }
}
