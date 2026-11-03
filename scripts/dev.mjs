import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const electronBinary = require('electron');

const compile = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.main.json'], { stdio: 'inherit' });
if (compile.status !== 0) process.exit(compile.status ?? 1);

const server = await createServer({ configFile: 'vite.config.ts' });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? 'http://localhost:5173/';

const electron = spawn(electronBinary, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: url }
});

electron.on('close', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
