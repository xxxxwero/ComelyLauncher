import { BrowserWindow } from 'electron';
import { LauncherError } from '../../../shared/errors';

export const MICROSOFT_CLIENT_ID = '00000000402b5328';
export const MICROSOFT_REDIRECT_URI = 'https://login.live.com/oauth20_desktop.srf';
export const MICROSOFT_SCOPE = 'service::user.auth.xboxlive.com::MBI_SSL';

function authorizeUrl(): string {
  const params = new URLSearchParams({
    client_id: MICROSOFT_CLIENT_ID,
    response_type: 'code',
    scope: MICROSOFT_SCOPE,
    redirect_uri: MICROSOFT_REDIRECT_URI,
    prompt: 'select_account'
  });
  return `https://login.live.com/oauth20_authorize.srf?${params.toString()}`;
}

export function requestMicrosoftAuthCode(parent: BrowserWindow | null): Promise<string> {
  return new Promise((resolve, reject) => {
    const window = new BrowserWindow({
      width: 520,
      height: 700,
      parent: parent ?? undefined,
      modal: Boolean(parent),
      title: 'Microsoft',
      autoHideMenuBar: true,
      backgroundColor: '#1A120D',
      webPreferences: {
        partition: `comely-microsoft-${Date.now()}`,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });
    let settled = false;
    const settle = (action: () => void): void => {
      if (settled) return;
      settled = true;
      action();
      if (!window.isDestroyed()) window.close();
    };
    const inspect = (url: string): void => {
      if (!url.startsWith(MICROSOFT_REDIRECT_URI)) return;
      const params = new URL(url).searchParams;
      const code = params.get('code');
      const error = params.get('error');
      if (code) settle(() => resolve(code));
      else if (error === 'access_denied') settle(() => reject(new LauncherError('auth-cancelled')));
      else if (error) settle(() => reject(new LauncherError('auth-microsoft-failed', params.get('error_description') ?? error)));
    };
    window.webContents.on('will-redirect', (_event, url) => inspect(url));
    window.webContents.on('will-navigate', (_event, url) => inspect(url));
    window.webContents.on('did-navigate', (_event, url) => inspect(url));
    window.webContents.on('did-redirect-navigation', (_event, url) => inspect(url));
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.on('closed', () => {
      if (!settled) {
        settled = true;
        reject(new LauncherError('auth-cancelled'));
      }
    });
    window.loadURL(authorizeUrl()).catch((error: Error) => settle(() => reject(new LauncherError('network', error.message))));
  });
}
