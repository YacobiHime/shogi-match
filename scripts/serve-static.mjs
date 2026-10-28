// ブラウザでの確認用の静的サーバー。WASMエンジンのためのCOOP/COEPを返し、キャッシュさせない。
// 使い方: node scripts/serve-static.mjs [ポート(既定8766)] [置き場所(既定はリポジトリ)]
// game.htmlはdist/を読むので、先にnpm run buildする。Viteの開発サーバーと違い、ビルドし直してもすぐ新しいJSが届く。

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.argv[2] ?? 8766);
const root = resolve(process.argv[3] ?? join(fileURLToPath(import.meta.url), '../..'));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
};

createServer(async (request, response) => {
  const headers = {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cache-Control': 'no-store',
  };
  try {
    const path = normalize(decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname));
    let file = join(root, path);
    if (!file.startsWith(root)) throw new Error('outside');
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    response.writeHead(200, { ...headers, 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404, headers);
    response.end('not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`http://127.0.0.1:${port}/game.html (${root})`);
});
