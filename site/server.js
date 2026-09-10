#!/usr/bin/env node
/* 零依赖本地服务器：静态托管 site/ + 本地实现原站 5 个 API。
 * 数据存储在 api-data/（ performances.json 元数据 + full.json 含事件）。
 * 用法: node server.js [端口]   默认 8080 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.argv[2]) || 8080;
const DB_DIR = path.join(ROOT, 'api-data');
const FULL = path.join(DB_DIR, 'full.json');
const META = path.join(DB_DIR, 'performances.json');

function readDb() { return JSON.parse(fs.readFileSync(FULL, 'utf8')); }
function writeDb(db) {
  fs.writeFileSync(FULL, JSON.stringify(db));
  fs.writeFileSync(META, JSON.stringify({
    performances: db.map(({ events, ...meta }) => meta)
  }, null, 1));
}

function send(res, code, body, type) {
  res.writeHead(code, { 'content-type': type || 'application/json; charset=utf-8', 'access-control-allow-origin': '*' });
  res.end(body);
}
function json(res, code, obj) { send(res, code, JSON.stringify(obj)); }

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  let file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) return json(res, 403, { error: 'forbidden' });
  if (!path.extname(rel) && !fs.existsSync(file) && fs.existsSync(file + '.html')) file += '.html';
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, '404 Not Found: ' + rel, 'text/plain; charset=utf-8');
    const ext = path.extname(file).toLowerCase();
    const types = {
      '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8', '.json': 'application/json',
      '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
      '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
      '.ico': 'image/x-icon', '.woff2': 'font/woff2'
    };
    res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(buf);
  });
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const p = u.pathname;

  if (p === '/api/performances') {
    if (req.method === 'GET') {
      const db = readDb();
      const id = u.searchParams.get('id');
      if (id) {
        const one = db.find(x => x.id === id);
        return one ? json(res, 200, { performance: one }) : json(res, 404, { error: 'not found' });
      }
      const limit = Number(u.searchParams.get('limit')) || 800;
      const meta = JSON.parse(fs.readFileSync(META, 'utf8'));
      meta.performances = meta.performances.slice(0, limit);
      return json(res, 200, meta);
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          const db = readDb();
          const perf = payload.performance || payload;
          perf.id = perf.id || require('crypto').randomUUID();
          perf.userId = perf.userId || 'local-user-00000000';
          perf.nickname = perf.nickname || '本地演奏';
          perf.location = perf.location || { country: 'LOCAL', region: '', city: 'Local', latitude: 0, longitude: 0 };
          perf.likeCount = 0; perf.playCount = 0;
          perf.appVersion = perf.appVersion || 'local';
          db.unshift(perf);
          writeDb(db);
          json(res, 200, { ok: true, id: perf.id });
        } catch (e) { json(res, 400, { error: String(e) }); }
      });
      return;
    }
  }

  if (p === '/api/likes' || p === '/api/plays') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const { id } = JSON.parse(body);
          const db = readDb();
          const one = db.find(x => x.id === id);
          if (one) {
            if (p === '/api/likes') one.likeCount = (one.likeCount || 0) + 1;
            else one.playCount = (one.playCount || 0) + 1;
            writeDb(db);
          }
          json(res, 200, { ok: true });
        } catch (e) { json(res, 400, { error: String(e) }); }
      });
      return;
    }
  }

  if (p === '/api/viewer-region') {
    return json(res, 200, { country: 'LOCAL', domesticBasemap: true });
  }

  serveStatic(req, res, p);
});

server.listen(PORT, () => {
  console.log(`虚拟古琴本地镜像已启动: http://localhost:${PORT}/guqin/?entry=free&lang=zh`);
  console.log(`世界古琴地图:         http://localhost:${PORT}/world-map?lang=zh`);
});
