import jwt from 'jsonwebtoken';
import { query } from '../db.js';

const secret = process.env.JWT_SECRET || 'dev-secret-change-me';

export function signToken(payload) {
  return jwt.sign(payload, secret, { expiresIn: '30d' });
}

export function authOptional(req, res, next) {
  const h = req.headers.authorization;
  if (h && h.startsWith('Bearer ')) {
    const token = h.slice(7);
    try {
      req.user = jwt.verify(token, secret);
    } catch {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
}

export function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, data: null, message: '未登录' });
  }
  try {
    req.user = jwt.verify(h.slice(7), secret);
    next();
  } catch {
    return res.status(401).json({ code: 401, data: null, message: '登录已过期' });
  }
}

export async function requireAdmin(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, data: null, message: '未登录' });
  }
  try {
    const payload = jwt.verify(h.slice(7), secret);
    const rows = await query('SELECT id, username, role, is_active FROM users WHERE id = ? LIMIT 1', [payload.id]);
    const user = rows[0];
    if (!user || Number(user.is_active) === 0) {
      return res.status(403).json({ code: 403, data: null, message: '账号不可用' });
    }
    if (user.role !== 'admin') {
      return res.status(403).json({ code: 403, data: null, message: '仅管理员可访问' });
    }
    req.user = { id: user.id, username: user.username, role: user.role };
    next();
  } catch {
    return res.status(401).json({ code: 401, data: null, message: '登录已过期' });
  }
}
