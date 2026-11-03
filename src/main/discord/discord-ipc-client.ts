import net from 'node:net';
import { createLogger } from '../core/logger';

const OP_HANDSHAKE = 0;
const OP_FRAME = 1;
const OP_CLOSE = 2;
const OP_PING = 3;
const OP_PONG = 4;
const HEADER_BYTES = 8;
const PROTOCOL_VERSION = 1;
const PIPE_COUNT = 10;
const PIPE_PREFIX = process.env.COMELY_DISCORD_PIPE ?? 'discord-ipc-';
const READY_TIMEOUT_MS = 5000;

const log = createLogger('discord');

export interface DiscordActivity {
  details: string;
  state?: string;
  timestamps?: { start: number };
  assets: { large_image: string; large_text: string };
  buttons: Array<{ label: string; url: string }>;
}

interface DiscordMessage {
  cmd?: string;
  evt?: string;
  data?: { message?: string };
}

function openPipe(index: number): Promise<net.Socket | null> {
  return new Promise((resolve) => {
    const socket = net.connect(`\\\\.\\pipe\\${PIPE_PREFIX}${index}`);
    socket.once('connect', () => {
      socket.removeAllListeners('error');
      resolve(socket);
    });
    socket.once('error', () => resolve(null));
  });
}

export class DiscordIpcClient {
  private socket: net.Socket | null = null;
  private received = Buffer.alloc(0);
  private nonce = 0;
  private onReady: (() => void) | null = null;

  constructor(
    private readonly applicationId: string,
    private readonly onClosed: () => void
  ) {}

  async connect(): Promise<boolean> {
    for (let index = 0; index < PIPE_COUNT; index++) {
      const socket = await openPipe(index);
      if (!socket) continue;
      if (await this.handshake(socket)) return true;
      socket.destroy();
    }
    return false;
  }

  setActivity(activity: DiscordActivity | null): void {
    this.nonce += 1;
    this.send(OP_FRAME, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity }, nonce: String(this.nonce) });
  }

  close(): void {
    const socket = this.socket;
    this.socket = null;
    socket?.removeAllListeners('close');
    socket?.destroy();
  }

  private handshake(socket: net.Socket): Promise<boolean> {
    this.received = Buffer.alloc(0);
    this.socket = socket;
    return new Promise((resolve) => {
      const settle = (ready: boolean): void => {
        clearTimeout(timeout);
        this.onReady = null;
        socket.removeListener('close', onEarlyClose);
        if (ready) {
          socket.on('close', () => this.handleClosed());
        } else {
          this.socket = null;
        }
        resolve(ready);
      };
      const onEarlyClose = (): void => settle(false);
      const timeout = setTimeout(() => settle(false), READY_TIMEOUT_MS);
      this.onReady = () => settle(true);
      socket.on('error', (error) => log.warn('Discord connection error', error));
      socket.on('data', (chunk: Buffer) => this.handleData(chunk));
      socket.once('close', onEarlyClose);
      this.send(OP_HANDSHAKE, { v: PROTOCOL_VERSION, client_id: this.applicationId });
    });
  }

  private handleClosed(): void {
    if (!this.socket) return;
    this.socket = null;
    this.onClosed();
  }

  private handleData(chunk: Buffer): void {
    this.received = Buffer.concat([this.received, chunk]);
    while (this.received.length >= HEADER_BYTES) {
      const opcode = this.received.readUInt32LE(0);
      const length = this.received.readUInt32LE(4);
      if (this.received.length < HEADER_BYTES + length) return;
      const payload = this.received.subarray(HEADER_BYTES, HEADER_BYTES + length);
      this.received = this.received.subarray(HEADER_BYTES + length);
      this.handleFrame(opcode, payload);
    }
  }

  private handleFrame(opcode: number, payload: Buffer): void {
    if (opcode === OP_PING) {
      this.write(OP_PONG, payload);
      return;
    }
    if (opcode === OP_CLOSE) {
      log.warn(`Discord closed the connection: ${payload.toString('utf8').slice(0, 200)}`);
      this.socket?.destroy();
      return;
    }
    if (opcode !== OP_FRAME) return;
    let message: DiscordMessage;
    try {
      message = JSON.parse(payload.toString('utf8')) as DiscordMessage;
    } catch {
      return;
    }
    if (message.evt === 'READY') this.onReady?.();
    if (message.evt === 'ERROR') log.warn(`Discord rejected a request: ${message.data?.message ?? 'unknown error'}`);
  }

  private send(opcode: number, message: unknown): void {
    this.write(opcode, Buffer.from(JSON.stringify(message), 'utf8'));
  }

  private write(opcode: number, payload: Buffer): void {
    const socket = this.socket;
    if (!socket || socket.destroyed) return;
    const header = Buffer.alloc(HEADER_BYTES);
    header.writeUInt32LE(opcode, 0);
    header.writeUInt32LE(payload.length, 4);
    socket.write(Buffer.concat([header, payload]));
  }
}
