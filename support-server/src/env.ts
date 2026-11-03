export interface D1Result<T> {
  results: T[];
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<D1Result<T>>;
  run(): Promise<unknown>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown>;
}

export interface Env {
  DB: D1Database;
  ADMIN_UUID: string;
  SESSION_SECRET: string;
  ELYBY_SESSION_URL?: string;
  MOJANG_KEYS?: string;
}

export type Provider = 'microsoft' | 'elyby' | 'offline';

export interface Session {
  sub: string;
  name: string;
  provider: Provider;
  admin: boolean;
  exp: number;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super(code);
  }
}
