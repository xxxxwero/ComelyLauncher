import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { relative, resolve } from 'node:path';

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: comely-media: https:",
  "font-src 'self' data:",
  "connect-src 'self' data: blob:"
].join('; ');

const GLOBAL_KEYFRAMES_PREFIX = 'cl-';

function scopedCssName(name: string, filename: string): string {
  if (name.startsWith(GLOBAL_KEYFRAMES_PREFIX)) return name;
  const scope = createHash('sha1').update(relative(__dirname, filename)).digest('hex').slice(0, 6);
  return `_${name}_${scope}`;
}

function contentSecurityPolicy(): Plugin {
  return {
    name: 'comely-content-security-policy',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`)
  };
}

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  plugins: [react(), contentSecurityPolicy()],
  css: {
    modules: { generateScopedName: scopedCssName }
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: { allow: [resolve(__dirname)] }
  },
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500
  }
});
