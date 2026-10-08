import { createHash, randomBytes } from 'node:crypto';

const COOKIE_NAME = 'painel_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function hashSessionId(sessionId) {
  return createHash('sha256').update(sessionId).digest('hex');
}

function cookieValue(header, name) {
  const entry = (header || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!entry) return null;
  try {
    return decodeURIComponent(entry.slice(name.length + 1));
  } catch {
    return null;
  }
}

function setSessionCookie(res, sessionId) {
  const maxAge = Math.floor(SESSION_DURATION_MS / 1000);
  res.append('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(sessionId)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`);
}

function clearSessionCookie(res) {
  res.append('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

export function createSessionMiddleware(db) {
  return (req, res, next) => {
    const sessionId = cookieValue(req.headers.cookie, COOKIE_NAME);
    req.sessionId = sessionId;
    req.user = null;

    if (sessionId) {
      const session = db.prepare(`
        SELECT users.id, users.name, users.email
        FROM sessions JOIN users ON users.id = sessions.user_id
        WHERE sessions.id_hash = ? AND sessions.expires_at > ?
      `).get(hashSessionId(sessionId), new Date().toISOString());
      if (session) req.user = session;
    }
    next();
  };
}

export function startSession(db, res, userId) {
  const sessionId = randomBytes(32).toString('base64url');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS).toISOString();
  db.prepare('INSERT INTO sessions (id_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(hashSessionId(sessionId), userId, expiresAt, now.toISOString());
  setSessionCookie(res, sessionId);
}

export function endSession(db, req, res) {
  if (req.sessionId) db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(hashSessionId(req.sessionId));
  clearSessionCookie(res);
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Entre na sua conta para continuar.' } });
  }
  next();
}
