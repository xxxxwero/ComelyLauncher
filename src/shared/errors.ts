export type LauncherErrorCode =
  | 'network'
  | 'cancelled'
  | 'invalid-input'
  | 'auth-cancelled'
  | 'auth-microsoft-failed'
  | 'auth-no-xbox'
  | 'auth-child-account'
  | 'auth-region-blocked'
  | 'auth-no-minecraft'
  | 'auth-elyby-invalid'
  | 'auth-expired'
  | 'no-account'
  | 'no-instance'
  | 'game-running'
  | 'java-not-found'
  | 'install-failed'
  | 'loader-unavailable'
  | 'hash-mismatch'
  | 'skin-invalid'
  | 'skin-upload-failed'
  | 'content-incompatible'
  | 'dependency-missing'
  | 'not-enough-disk-space'
  | 'game-files-busy'
  | 'game-directory-moving'
  | 'tasks-running'
  | 'export-needs-install'
  | 'backup-invalid'
  | 'support-unavailable'
  | 'support-rate-limited'
  | 'support-blocked'
  | 'support-ticket-closed'
  | 'instance-busy'
  | 'modpack-invalid'
  | 'modpack-curseforge'
  | 'log-unavailable'
  | 'unknown';

export interface SerializedLauncherError {
  code: LauncherErrorCode;
  message: string;
  params?: Record<string, string | number>;
}

export class LauncherError extends Error {
  readonly code: LauncherErrorCode;
  readonly params?: Record<string, string | number>;

  constructor(code: LauncherErrorCode, message?: string, params?: Record<string, string | number>) {
    super(message ?? code);
    this.name = 'LauncherError';
    this.code = code;
    this.params = params;
  }

  serialize(): SerializedLauncherError {
    return { code: this.code, message: this.message, params: this.params };
  }

  static from(error: unknown): LauncherError {
    if (error instanceof LauncherError) return error;
    if (error instanceof Error) {
      if (error.name === 'AbortError') return new LauncherError('cancelled', error.message);
      return new LauncherError('unknown', error.message);
    }
    return new LauncherError('unknown', String(error));
  }

  static fromSerialized(error: SerializedLauncherError): LauncherError {
    return new LauncherError(error.code, error.message, error.params);
  }
}

export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: SerializedLauncherError };
