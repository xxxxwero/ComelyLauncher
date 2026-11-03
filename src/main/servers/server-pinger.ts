import { promises as dns } from 'node:dns';
import net from 'node:net';
import type { ServerStatus } from '../../shared/types/media';
import { parseServerAddress } from '../minecraft/launch/launch-arguments';
import { parseMotd } from './motd';

const TIMEOUT_MS = 5000;
const PROTOCOL_VERSION = 767;

interface Endpoint {
  host: string;
  port: number;
}

interface StatusResponse {
  version?: { name?: string };
  players?: { online?: number; max?: number };
  description?: unknown;
  favicon?: string;
}

function varInt(value: number): Buffer {
  const bytes: number[] = [];
  let remaining = value >>> 0;
  do {
    let byte = remaining & 0x7f;
    remaining >>>= 7;
    if (remaining !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (remaining !== 0);
  return Buffer.from(bytes);
}

function readVarInt(buffer: Buffer, offset: number): { value: number; size: number } | null {
  let value = 0;
  for (let index = 0; index < 5; index++) {
    if (offset + index >= buffer.length) return null;
    const byte = buffer[offset + index];
    value |= (byte & 0x7f) << (7 * index);
    if ((byte & 0x80) === 0) return { value, size: index + 1 };
  }
  throw new Error('VarInt is too long');
}

function packet(id: number, payload: Buffer): Buffer {
  const body = Buffer.concat([varInt(id), payload]);
  return Buffer.concat([varInt(body.length), body]);
}

function mcString(value: string): Buffer {
  const bytes = Buffer.from(value, 'utf8');
  return Buffer.concat([varInt(bytes.length), bytes]);
}

async function resolveEndpoint(address: string): Promise<Endpoint> {
  const parsed = parseServerAddress(address);
  const explicitPort = /:\d+$/.test(address.trim());
  if (explicitPort || net.isIP(parsed.host)) return parsed;
  try {
    const records = await dns.resolveSrv(`_minecraft._tcp.${parsed.host}`);
    if (records[0]) return { host: records[0].name, port: records[0].port };
  } catch {
    return parsed;
  }
  return parsed;
}

function connect(endpoint: Endpoint, onData: (socket: net.Socket, data: Buffer) => boolean, initial: (socket: net.Socket) => void): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: endpoint.host, port: endpoint.port });
    let buffer = Buffer.alloc(0);
    let sentAt = 0;
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('timeout'));
    }, TIMEOUT_MS);
    socket.on('connect', () => {
      sentAt = Date.now();
      initial(socket);
    });
    socket.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      try {
        if (onData(socket, buffer)) {
          clearTimeout(timer);
          socket.destroy();
          resolve(Date.now() - sentAt);
        }
      } catch (error) {
        clearTimeout(timer);
        socket.destroy();
        reject(error);
      }
    });
    socket.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    socket.on('close', () => {
      clearTimeout(timer);
      reject(new Error('closed'));
    });
  });
}

async function modernPing(endpoint: Endpoint): Promise<{ response: StatusResponse; latency: number }> {
  let response: StatusResponse | null = null;
  const latency = await connect(
    endpoint,
    (_socket, data) => {
      const length = readVarInt(data, 0);
      if (!length || data.length < length.size + length.value) return false;
      const id = readVarInt(data, length.size);
      if (!id) return false;
      const stringLength = readVarInt(data, length.size + id.size);
      if (!stringLength) return false;
      const start = length.size + id.size + stringLength.size;
      response = JSON.parse(data.toString('utf8', start, start + stringLength.value)) as StatusResponse;
      return true;
    },
    (socket) => {
      const port = Buffer.alloc(2);
      port.writeUInt16BE(endpoint.port);
      socket.write(packet(0x00, Buffer.concat([varInt(PROTOCOL_VERSION), mcString(endpoint.host), port, varInt(1)])));
      socket.write(packet(0x00, Buffer.alloc(0)));
    }
  );
  return { response: response ?? {}, latency };
}

async function legacyPing(endpoint: Endpoint): Promise<{ response: StatusResponse; latency: number }> {
  let response: StatusResponse = {};
  const latency = await connect(
    endpoint,
    (_socket, data) => {
      if (data.length < 3 || data[0] !== 0xff) throw new Error('invalid legacy response');
      const length = data.readUInt16BE(1);
      if (data.length < 3 + length * 2) return false;
      const text = data.subarray(3, 3 + length * 2).swap16().toString('utf16le');
      const parts = text.startsWith('§1') ? text.split('\u0000') : ['', '', '', ...text.split('§')];
      response = {
        version: { name: parts[2] },
        description: parts[3],
        players: { online: Number(parts[4]) || 0, max: Number(parts[5]) || 0 }
      };
      return true;
    },
    (socket) => socket.write(Buffer.from([0xfe, 0x01]))
  );
  return { response, latency };
}

export async function pingServer(address: string): Promise<ServerStatus> {
  const offline: ServerStatus = {
    address,
    online: false,
    motd: [],
    playersOnline: 0,
    playersMax: 0,
    versionName: null,
    latencyMs: null,
    iconDataUrl: null
  };
  if (!address.trim()) return offline;
  try {
    const endpoint = await resolveEndpoint(address);
    const { response, latency } = await modernPing(endpoint).catch(() => legacyPing(endpoint));
    return {
      address,
      online: true,
      motd: parseMotd(response.description),
      playersOnline: response.players?.online ?? 0,
      playersMax: response.players?.max ?? 0,
      versionName: response.version?.name ?? null,
      latencyMs: latency,
      iconDataUrl: response.favicon?.startsWith('data:image') ? response.favicon : null
    };
  } catch {
    return offline;
  }
}
