import { build } from '../frontend/node_modules/esbuild/lib/main.js';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';

const folder = 'frontend/dist';
const types = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

const assets = {};
for (const file of await readdir(folder, { recursive: true, withFileTypes: true })) {
  if (!file.isFile()) continue;
  const full = join(file.parentPath, file.name);
  const extension = extname(file.name);
  const type = types[extension];
  if (!type) throw new Error('Unsupported asset type: ' + full);
  const binary = extension.startsWith('.woff');
  const path = file.name === 'index.html' ? '/' : '/' + full.slice(folder.length + 1);
  assets[path] = { content: await readFile(full, binary ? 'base64' : 'utf8'), type, binary };
}

if (!assets['/']) throw new Error('Frontend build is missing index.html');

await build({
  entryPoints: ['frontend/worker/index.ts'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  outfile: 'dist/server/index.js',
  plugins: [{
    name: 'inline-vite-assets',
    setup(builder) {
      builder.onResolve({ filter: /assets\.generated$/ }, () => ({ path: 'assets', namespace: 'talentalign' }));
      builder.onLoad({ filter: /.*/, namespace: 'talentalign' }, () => ({
        contents: 'const assets=' + JSON.stringify(assets) + ';export function serveAsset(path){' +
          'const asset=Object.hasOwn(assets,path)?assets[path]:null;' +
          'return asset?{body:asset.binary?Uint8Array.from(atob(asset.content), c=>c.charCodeAt(0)):asset.content,type:asset.type}:null}',
        loader: 'js',
      }));
    },
  }],
});
