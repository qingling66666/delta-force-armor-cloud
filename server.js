/* ============================================================
 * 《三角洲行动》护甲数据库 — 云服务端
 * 纯 Node 实现，零依赖：静态托管 + 用户认证 + 云端收藏
 * 数据落盘 data/db.json（云端持久存储）
 * ============================================================ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const DB_PATH = path.join(ROOT, 'data', 'db.json');
const COOKIE = 'dfa_sid';
const SESSION_MS = 30 * 24 * 3600 * 1000; // 会话 30 天

/* ---------------- 云数据库（JSON 落盘） ---------------- */
let db = { users: {}, sessions: {} };

function loadDb() {
  try {
    const raw = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    if (raw && typeof raw === 'object' && raw.users) db = raw;
  } catch (e) { /* 首次启动无文件 */ }
}
function saveDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_PATH);
}
loadDb();

/* ---------------- 密码与会话 ---------------- */
function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString('hex');
}
function verifyPassword(password, salt, hash) {
  const a = Buffer.from(hashPassword(password, salt), 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function newToken() { return crypto.randomBytes(24).toString('hex'); }
function pruneSessions() {
  const now = Date.now();
  let dirty = false;
  for (const t of Object.keys(db.sessions)) {
    if (!db.sessions[t] || db.sessions[t].exp < now) { delete db.sessions[t]; dirty = true; }
  }
  return dirty;
}

/* ---------------- 工具 ---------------- */
function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie;
  if (!raw) return out;
  raw.split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function sendJson(res, code, obj, extraHeaders) {
  const body = JSON.stringify(obj);
  res.writeHead(code, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  }, extraHeaders || {}));
  res.end(body);
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (e) { reject(new Error('bad json')); }
    });
    req.on('error', reject);
  });
}
function sessionUser(req) {
  const sid = parseCookies(req)[COOKIE];
  if (!sid) return null;
  const s = db.sessions[sid];
  if (!s || s.exp < Date.now()) return null;
  const u = db.users[s.user];
  return u ? { key: s.user, name: u.name, sid, favs: u.favs } : null;
}
function sessionCookie(token) {
  return COOKIE + '=' + token + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + (SESSION_MS / 1000);
}
function clearCookie() { return COOKIE + '=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'; }

/* 简单防爆破：每 IP 每 10 分钟最多 20 次失败 */
const fails = new Map();
function tooManyFails(ip) {
  const now = Date.now();
  const rec = fails.get(ip) || { n: 0, t: now };
  if (now - rec.t > 10 * 60 * 1000) { rec.n = 0; rec.t = now; }
  fails.set(ip, rec);
  return rec.n >= 20;
}
function addFail(ip) {
  const rec = fails.get(ip);
  if (rec) rec.n++;
}

/* ---------------- 认证 API ---------------- */
const NAME_RE = /^[\u4e00-\u9fa5A-Za-z0-9_]{2,16}$/;

async function handleApi(req, res, pathname, ip) {
  const route = pathname;

  /* 注册 */
  if (route === '/api/register' && req.method === 'POST') {
    const body = await readBody(req, 4096);
    const name = String(body.username || '').trim();
    const pass = String(body.password || '');
    if (!NAME_RE.test(name)) return sendJson(res, 400, { error: '用户名需为 2-16 位中文、字母、数字或下划线' });
    if (pass.length < 6 || pass.length > 32) return sendJson(res, 400, { error: '密码需为 6-32 位' });
    const key = name.toLowerCase();
    if (db.users[key]) return sendJson(res, 400, { error: '这个用户名已经被注册了，换一个试试' });
    const salt = crypto.randomBytes(16).toString('hex');
    db.users[key] = { name, salt, hash: hashPassword(pass, salt), favs: [], created: Date.now() };
    const token = newToken();
    db.sessions[token] = { user: key, exp: Date.now() + SESSION_MS };
    if (pruneSessions()) { /* 顺手清理 */ }
    saveDb();
    return sendJson(res, 200, { user: name, favs: [] }, { 'Set-Cookie': sessionCookie(token) });
  }

  /* 登录 */
  if (route === '/api/login' && req.method === 'POST') {
    if (tooManyFails(ip)) return sendJson(res, 429, { error: '尝试次数过多，请 10 分钟后再试' });
    const body = await readBody(req, 4096);
    const name = String(body.username || '').trim();
    const pass = String(body.password || '');
    const u = db.users[name.toLowerCase()];
    if (!u || !verifyPassword(pass, u.salt, u.hash)) {
      addFail(ip);
      return sendJson(res, 401, { error: '用户名或密码不对' });
    }
    const token = newToken();
    db.sessions[token] = { user: name.toLowerCase(), exp: Date.now() + SESSION_MS };
    if (pruneSessions()) saveDb();
    return sendJson(res, 200, { user: u.name, favs: u.favs }, { 'Set-Cookie': sessionCookie(token) });
  }

  /* 退出 */
  if (route === '/api/logout' && req.method === 'POST') {
    const sid = parseCookies(req)[COOKIE];
    if (sid) { delete db.sessions[sid]; saveDb(); }
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': clearCookie() });
  }

  /* 当前登录状态 */
  if (route === '/api/me' && req.method === 'GET') {
    const s = sessionUser(req);
    return sendJson(res, 200, s ? { user: s.name, favs: s.favs } : { user: null, favs: [] });
  }

  /* 收藏列表 */
  if (route === '/api/favorites' && req.method === 'GET') {
    const s = sessionUser(req);
    if (!s) return sendJson(res, 401, { error: 'unauth' });
    return sendJson(res, 200, { favs: s.favs });
  }

  /* 收藏 / 取消收藏 */
  if (route === '/api/favorites/toggle' && req.method === 'POST') {
    const s = sessionUser(req);
    if (!s) return sendJson(res, 401, { error: 'unauth' });
    const body = await readBody(req, 2048);
    const type = String(body.type || '');
    const name = String(body.name || '').slice(0, 40);
    if ((type !== 'armor' && type !== 'helmet') || !name) {
      return sendJson(res, 400, { error: 'bad item' });
    }
    const u = db.users[s.key];
    const i = u.favs.findIndex(f => f.type === type && f.name === name);
    let on;
    if (i > -1) { u.favs.splice(i, 1); on = false; }
    else { u.favs.push({ type, name, at: Date.now() }); on = true; }
    if (u.favs.length > 200) u.favs.length = 200;
    saveDb();
    return sendJson(res, 200, { on, favs: u.favs });
  }

  return sendJson(res, 404, { error: 'not found' });
}

/* ---------------- 静态托管（HTML 自动注入登录脚本） ---------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function injectAuth(html) {
  const tags = '<link rel="stylesheet" href="/assets/auth.css">' +
    '<script src="/assets/auth.js" defer></script>';
  let out = html;
  if (/<\/head>/i.test(out)) out = out.replace(/<\/head>/i, tags + '</head>');
  else if (/<\/body>/i.test(out)) out = out.replace(/<\/body>/i, tags + '</body>');
  return out;
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/') rel = '/index.html';
  let file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }

  let status = 200;
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(ROOT, '404.html');
    status = 404;
  }

  const ext = path.extname(file).toLowerCase();
  const isHtml = ext === '.html';
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=86400',
    'X-Content-Type-Options': 'nosniff'
  };

  if (isHtml) {
    const html = injectAuth(fs.readFileSync(file, 'utf8'));
    res.writeHead(status, headers);
    return res.end(html);
  }
  res.writeHead(status, headers);
  fs.createReadStream(file).pipe(res);
}

/* ---------------- HTTP 服务 ---------------- */
const server = http.createServer(async (req, res) => {
  const ip = (req.socket.remoteAddress || 'x').replace('::ffff:', '');
  let pathname;
  try { pathname = new URL(req.url, 'http://x').pathname; }
  catch (e) { pathname = req.url.split('?')[0]; }

  try {
    if (pathname.startsWith('/api/')) {
      return await handleApi(req, res, pathname, ip);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405); return res.end();
    }
    return serveStatic(req, res, pathname);
  } catch (e) {
    const msg = e && e.message === 'too large' ? '请求过大' :
      e && e.message === 'bad json' ? '请求格式错误' : '服务器开小差了';
    if (!res.headersSent) return sendJson(res, e && e.message && e.message.startsWith('bad') ? 400 : 500, { error: msg });
    res.end();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('[delta-force-armor] serving on 0.0.0.0:' + PORT);
});
