import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { query } from '../db.js';
import { ok, fail } from '../util/response.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();
const RESET_CODE_TTL_MINUTES = 5;
const RESET_CODE_LENGTH = 6;
const REGISTER_SMS_RESEND_SECONDS = 60;
const REGISTER_SMS_DAILY_LIMIT = 100;
const PASSWORD_RESET_SMS_RESEND_SECONDS = 60;
const PASSWORD_RESET_SMS_DAILY_LIMIT = 100;
const SPUG_SMS_URL = String(process.env.SPUG_SMS_URL || 'https://push.spug.cc/send/p2eNa8DPxo809gJQ').trim();
const SPUG_APP_KEY = String(process.env.SPUG_APP_KEY || '').trim();
const DEFAULT_COLLEGE_OPTIONS = [
  {
    id: 'engineering',
    label: '工科',
    image_url: 'https://placehold.co/480x280/1a56db/ffffff?text=%E5%B7%A5%E7%A7%91',
  },
  {
    id: 'science',
    label: '理科',
    image_url: 'https://placehold.co/480x280/7c3aed/ffffff?text=%E7%90%86%E7%A7%91',
  },
  {
    id: 'liberal',
    label: '文科',
    image_url: 'https://placehold.co/480x280/ea580c/ffffff?text=%E6%96%87%E7%A7%91',
  },
  {
    id: 'other',
    label: '其他',
    image_url: 'https://placehold.co/480x280/059669/ffffff?text=%E5%85%B6%E4%BB%96',
  },
];

function buildResetMailTransport() {
  const host = String(process.env.SMTP_HOST || '').trim();
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true') !== 'false',
    auth: { user, pass },
  });
}

const resetMailTransport = buildResetMailTransport();

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

async function dispatchEmailCode(targetEmail, scene, code) {
  console.warn(`[${scene}] email=${targetEmail}, code=${code}, ttl=${RESET_CODE_TTL_MINUTES}min`);
  const mailFrom = String(process.env.SMTP_FROM || process.env.SMTP_USER || '').trim();
  if (!targetEmail || !resetMailTransport || !mailFrom) return;
  await resetMailTransport.sendMail({
    from: mailFrom,
    to: targetEmail,
    subject: 'TalkWork 验证码',
    text: `你的验证码是 ${code}，5分钟内有效。若非本人操作请忽略。`,
  });
}

async function dispatchSmsCode(phone, scene, code) {
  console.warn(`[${scene}] phone=${phone}, code=${code}, ttl=${RESET_CODE_TTL_MINUTES}min`);
  if (!SPUG_SMS_URL) {
    throw new Error('SPUG_SMS_URL 未配置');
  }
  const content = `【TalkWork】验证码 ${code}，${RESET_CODE_TTL_MINUTES} 分钟内有效。`;
  const headers = { 'Content-Type': 'application/json' };
  if (SPUG_APP_KEY) {
    headers['X-API-KEY'] = SPUG_APP_KEY;
    headers.Authorization = `Bearer ${SPUG_APP_KEY}`;
  }
  const resp = await fetch(SPUG_SMS_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      code,
      targets: phone,
      app_key: SPUG_APP_KEY || undefined,
    }),
  });
  let body = null;
  try {
    body = await resp.json();
  } catch {
    body = null;
  }
  if (!resp.ok) {
    throw new Error(body?.msg || `Spug 推送失败（HTTP ${resp.status}）`);
  }
  if (body && Number(body.code) === 204) {
    throw new Error('Spug 未匹配到短信推送对象，请检查模板绑定与短信通道');
  }
  if (body && Number(body.code) !== 0 && Number(body.code) !== 200) {
    throw new Error(body.msg || 'Spug 推送失败');
  }
}

function normalizePhone(raw) {
  return String(raw || '').replace(/\s+/g, '').trim();
}

function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

function isValidPhone(phone) {
  return /^1\d{10}$/.test(phone);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function getRegisterSmsSendStats(phone) {
  const latestRows = await query(
    `SELECT id, created_at
     FROM register_sms_codes
     WHERE phone = ?
     ORDER BY id DESC
     LIMIT 1`,
    [phone]
  );
  const dailyRows = await query(
    `SELECT COUNT(*) AS total
     FROM register_sms_codes
     WHERE phone = ? AND created_at >= CURDATE()`,
    [phone]
  );
  return {
    latest: latestRows[0] || null,
    dailyCount: Number(dailyRows[0]?.total || 0),
  };
}

async function getPasswordResetSmsSendStats(phone) {
  const latestRows = await query(
    `SELECT id, created_at
     FROM password_reset_sms_codes
     WHERE phone = ?
     ORDER BY id DESC
     LIMIT 1`,
    [phone]
  );
  const dailyRows = await query(
    `SELECT COUNT(*) AS total
     FROM password_reset_sms_codes
     WHERE phone = ? AND created_at >= CURDATE()`,
    [phone]
  );
  return {
    latest: latestRows[0] || null,
    dailyCount: Number(dailyRows[0]?.total || 0),
  };
}

function readCollegeOptionsConfig() {
  const raw = process.env.COLLEGE_CARD_IMAGES || '';
  if (!raw.trim()) return DEFAULT_COLLEGE_OPTIONS;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_COLLEGE_OPTIONS;
    return DEFAULT_COLLEGE_OPTIONS.map((item) => {
      const override = parsed[item.id];
      if (typeof override !== 'string' || !override.trim()) return item;
      return { ...item, image_url: override.trim() };
    });
  } catch {
    return DEFAULT_COLLEGE_OPTIONS;
  }
}

router.get('/college-options', async (_req, res) => {
  try {
    res.json(ok(readCollegeOptionsConfig()));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.post('/register', async (req, res) => {
  try {
    const { username, code, password, college } = req.body || {};
    const phone = normalizePhone(username);
    if (!phone || !code || !password || !college) {
      return res.status(400).json(fail(400, '参数不完整'));
    }
    if (!isValidPhone(phone)) return res.status(400).json(fail(400, '请使用11位手机号注册'));
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json(fail(400, '密码需至少8位且包含字母和数字'));
    }
    const allowed = ['engineering', 'science', 'liberal', 'other'];
    if (!allowed.includes(college)) {
      return res.status(400).json(fail(400, '请选择你的学院'));
    }
    const codeRows = await query(
      `SELECT id, code_hash, expires_at
       FROM register_sms_codes
       WHERE phone = ? AND used_at IS NULL
       ORDER BY id DESC
       LIMIT 1`,
      [phone]
    );
    const codeTicket = codeRows[0];
    if (!codeTicket) return res.status(400).json(fail(400, '请先发送验证码'));
    if (new Date(codeTicket.expires_at).getTime() < Date.now()) {
      await query('UPDATE register_sms_codes SET used_at = NOW() WHERE id = ?', [codeTicket.id]);
      return res.status(400).json(fail(400, '验证码已过期，请重新获取'));
    }
    if (codeTicket.code_hash !== hashCode(String(code).trim())) {
      return res.status(400).json(fail(400, '验证码错误'));
    }
    const hash = await bcrypt.hash(password, 10);
    await query('INSERT INTO users (username, student_no, email, password_hash, college) VALUES (?,?,?,?,?)', [
      phone,
      phone,
      `${phone}@example.invalid`,
      hash,
      college,
    ]);
    await query('UPDATE register_sms_codes SET used_at = NOW() WHERE id = ?', [codeTicket.id]);
    res.json(ok({ message: '注册成功' }));
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(400).json(fail(400, '手机号已注册'));
    }
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.post('/register/send-code', async (req, res) => {
  try {
    const phone = normalizePhone(req.body?.phone);
    if (!phone) return res.status(400).json(fail(400, '请输入手机号'));
    if (!isValidPhone(phone)) return res.status(400).json(fail(400, '手机号格式不正确'));
    const exists = await query('SELECT id FROM users WHERE username = ? LIMIT 1', [phone]);
    if (exists.length) return res.status(400).json(fail(400, '手机号已注册'));
    const stats = await getRegisterSmsSendStats(phone);
    if (stats.dailyCount >= REGISTER_SMS_DAILY_LIMIT) {
      return res.status(429).json(fail(429, `今日验证码发送次数已达上限（${REGISTER_SMS_DAILY_LIMIT}次）`));
    }
    if (stats.latest) {
      const elapsedSeconds = Math.floor((Date.now() - new Date(stats.latest.created_at).getTime()) / 1000);
      if (elapsedSeconds < REGISTER_SMS_RESEND_SECONDS) {
        const retryAfterSeconds = REGISTER_SMS_RESEND_SECONDS - elapsedSeconds;
        return res.status(429).json(
          fail(429, `${retryAfterSeconds}秒后可重新发送验证码`, {
            retry_after_seconds: retryAfterSeconds,
          })
        );
      }
    }
    const code = String(Math.floor(Math.random() * 10 ** RESET_CODE_LENGTH)).padStart(RESET_CODE_LENGTH, '0');
    const codeHash = hashCode(code);
    await query('UPDATE register_sms_codes SET used_at = NOW() WHERE phone = ? AND used_at IS NULL', [phone]);
    await query(
      `INSERT INTO register_sms_codes (phone, code_hash, expires_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
      [phone, codeHash, RESET_CODE_TTL_MINUTES]
    );
    await dispatchSmsCode(phone, 'register', code);
    res.json(
      ok({
        expire_minutes: RESET_CODE_TTL_MINUTES,
        retry_after_seconds: REGISTER_SMS_RESEND_SECONDS,
        daily_limit: REGISTER_SMS_DAILY_LIMIT,
      })
    );
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, e.message || '验证码发送失败，请稍后重试'));
  }
});

router.post('/register/verify-code', async (req, res) => {
  try {
    const phone = normalizePhone(req.body?.phone);
    const code = String(req.body?.code || '').trim();
    if (!phone || !code) return res.status(400).json(fail(400, '参数不完整'));
    if (!isValidPhone(phone)) return res.status(400).json(fail(400, '手机号格式不正确'));
    const rows = await query(
      `SELECT id, code_hash, expires_at
       FROM register_sms_codes
       WHERE phone = ? AND used_at IS NULL
       ORDER BY id DESC
       LIMIT 1`,
      [phone]
    );
    const ticket = rows[0];
    if (!ticket) return res.status(400).json(fail(400, '请先发送验证码'));
    if (new Date(ticket.expires_at).getTime() < Date.now()) {
      await query('UPDATE register_sms_codes SET used_at = NOW() WHERE id = ?', [ticket.id]);
      return res.status(400).json(fail(400, '验证码已过期，请重新获取'));
    }
    if (ticket.code_hash !== hashCode(code)) {
      return res.status(400).json(fail(400, '验证码错误'));
    }
    res.json(ok({ verified: true }));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json(fail(400, '请填写账号和密码'));
    }
    const loginId = username.trim();
    const rows = await query('SELECT * FROM users WHERE username = ? OR student_no = ? OR email = ? LIMIT 1', [
      loginId,
      loginId,
      normalizeEmail(loginId),
    ]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(400).json(fail(400, '账号或密码错误'));
    }
    if (Number(user.is_active) === 0) {
      return res.status(403).json(fail(403, '账号已被禁用，请联系管理员'));
    }
    const token = signToken({ id: user.id, username: user.username, role: user.role || 'user' });
    res.json(
      ok({
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role || 'user',
          college: user.college,
          avatar_url: user.avatar_url,
          bio: user.bio || '',
        },
      })
    );
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.post('/password-reset/send-code', async (req, res) => {
  try {
    const phone = normalizePhone(req.body?.phone);
    if (!phone) return res.status(400).json(fail(400, '请输入注册手机号'));
    if (!isValidPhone(phone)) return res.status(400).json(fail(400, '手机号格式不正确'));
    const users = await query(
      'SELECT id FROM users WHERE username = ? OR student_no = ? OR email = ? LIMIT 1',
      [phone, phone, `${phone}@example.invalid`]
    );
    if (!users.length) return res.status(400).json(fail(400, '该手机号未注册'));
    const stats = await getPasswordResetSmsSendStats(phone);
    if (stats.dailyCount >= PASSWORD_RESET_SMS_DAILY_LIMIT) {
      return res.status(429).json(fail(429, `今日验证码发送次数已达上限（${PASSWORD_RESET_SMS_DAILY_LIMIT}次）`));
    }
    if (stats.latest) {
      const elapsedSeconds = Math.floor((Date.now() - new Date(stats.latest.created_at).getTime()) / 1000);
      if (elapsedSeconds < PASSWORD_RESET_SMS_RESEND_SECONDS) {
        const retryAfterSeconds = PASSWORD_RESET_SMS_RESEND_SECONDS - elapsedSeconds;
        return res.status(429).json(
          fail(429, `${retryAfterSeconds}秒后可重新发送验证码`, {
            retry_after_seconds: retryAfterSeconds,
          })
        );
      }
    }
    const code = String(Math.floor(Math.random() * 10 ** RESET_CODE_LENGTH)).padStart(RESET_CODE_LENGTH, '0');
    const codeHash = hashCode(code);
    await query('UPDATE password_reset_sms_codes SET used_at = NOW() WHERE phone = ? AND used_at IS NULL', [phone]);
    await query(
      `INSERT INTO password_reset_sms_codes (phone, user_id, code_hash, expires_at)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
      [phone, users[0].id, codeHash, RESET_CODE_TTL_MINUTES]
    );
    await dispatchSmsCode(phone, 'password-reset', code);
    res.json(
      ok({
        expire_minutes: RESET_CODE_TTL_MINUTES,
        retry_after_seconds: PASSWORD_RESET_SMS_RESEND_SECONDS,
        daily_limit: PASSWORD_RESET_SMS_DAILY_LIMIT,
      })
    );
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '验证码发送失败，请稍后重试'));
  }
});

router.post('/password-reset/verify', async (req, res) => {
  try {
    const phone = normalizePhone(req.body?.phone);
    const code = String(req.body?.code || '').trim();
    const newPassword = String(req.body?.newPassword || '');
    if (!phone || !code || !newPassword) {
      return res.status(400).json(fail(400, '参数不完整'));
    }
    if (!isValidPhone(phone)) return res.status(400).json(fail(400, '手机号格式不正确'));
    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return res.status(400).json(fail(400, '密码需至少8位且包含字母和数字'));
    }
    const rows = await query(
      `SELECT id, user_id, code_hash, expires_at
       FROM password_reset_sms_codes
       WHERE phone = ? AND used_at IS NULL
       ORDER BY id DESC
       LIMIT 1`,
      [phone]
    );
    const ticket = rows[0];
    if (!ticket) return res.status(400).json(fail(400, '请先获取验证码'));
    if (new Date(ticket.expires_at).getTime() < Date.now()) {
      await query('UPDATE password_reset_sms_codes SET used_at = NOW() WHERE id = ?', [ticket.id]);
      return res.status(400).json(fail(400, '验证码已过期，请重新获取'));
    }
    if (ticket.code_hash !== hashCode(code)) {
      return res.status(400).json(fail(400, '验证码错误'));
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, ticket.user_id]);
    await query('UPDATE password_reset_sms_codes SET used_at = NOW() WHERE id = ?', [ticket.id]);
    res.json(ok({ message: '密码已重置' }));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const rows = await query('SELECT id, username, role, college, avatar_url, bio FROM users WHERE id = ?', [
      req.user.id,
    ]);
    res.json(ok(rows[0]));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.patch('/me', requireAuth, async (req, res) => {
  try {
    const { username, avatar_url, bio, college } = req.body || {};
    const allowed = ['engineering', 'science', 'liberal', 'other'];
    if (username != null) {
      const u = String(username).trim().slice(0, 20);
      if (!u) return res.status(400).json(fail(400, '用户名不能为空'));
      await query('UPDATE users SET username = ? WHERE id = ?', [u, req.user.id]);
    }
    if (avatar_url != null) {
      await query('UPDATE users SET avatar_url = ? WHERE id = ?', [String(avatar_url), req.user.id]);
    }
    if (bio != null) {
      await query('UPDATE users SET bio = ? WHERE id = ?', [String(bio).trim().slice(0, 200), req.user.id]);
    }
    if (college != null) {
      if (!allowed.includes(college)) return res.status(400).json(fail(400, '请选择正确的学院'));
      await query('UPDATE users SET college = ? WHERE id = ?', [college, req.user.id]);
    }
    const rows = await query('SELECT id, username, role, college, avatar_url, bio FROM users WHERE id = ?', [
      req.user.id,
    ]);
    res.json(ok(rows[0]));
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(400).json(fail(400, '用户名已被占用'));
    }
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

export default router;
