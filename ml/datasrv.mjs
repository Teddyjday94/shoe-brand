// dev-only: serves the repo (so ml/gen.html can import ../js/*) and saves generated
// training images + labels under ml/data/. Not part of the site. `node ml/datasrv.mjs`
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';

const root = normalize(join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '..'));
const dataRoot = join(root, 'ml', 'data');
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.hdr': 'image/vnd.radiance',
  '.onnx': 'application/octet-stream', '.json': 'application/json', '.mp4': 'video/mp4',
};

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'POST' && url.pathname === '/save') {
    // ?path=synth/images/train/000123.jpg — only under ml/data, only jpg/png/txt/json
    const rel = url.searchParams.get('path') || '';
    if (!/^[a-z0-9_\-/]+\.(jpg|png|txt|json)$/.test(rel) || rel.includes('..')) { res.writeHead(400).end(); return; }
    const file = normalize(join(dataRoot, rel));
    if (!file.startsWith(dataRoot)) { res.writeHead(403).end(); return; }
    const chunks = []; for await (const c of req) chunks.push(c);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, Buffer.concat(chunks));
    res.writeHead(201).end();
    return;
  }
  let path = decodeURIComponent(url.pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(root, path));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    // no-store: a cached generator page once produced a batch of data with already-fixed bugs
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Content-Length': body.length, 'Cache-Control': 'no-store' }).end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(5174, () => console.log('ml data server on http://localhost:5174'));
