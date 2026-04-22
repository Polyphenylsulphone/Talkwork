import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { query } from './db.js';

import { authOptional } from './middleware/auth.js';
import authRouter from './routes/auth.js';
import postsRouter from './routes/posts.js';
import qaRouter from './routes/qa.js';
import profileRouter from './routes/profile.js';
import uploadRouter from './routes/upload.js';
import resumeRouter from './routes/resume.js';
import chatRouter from './routes/chat.js';
import interviewRouter from './routes/interview.js';
import adminRouter from './routes/admin.js';
import reportsRouter from './routes/reports.js';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

const uploads = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploads));

const api = express.Router();
api.use(authOptional);

api.use('/auth', authRouter);
api.use('/posts', postsRouter);
api.use('/qa', qaRouter);
api.use('/profile', profileRouter);
api.use('/upload', uploadRouter);
api.use('/resumes', resumeRouter);
api.use('/chat', chatRouter);
api.use('/interview', interviewRouter);
api.use('/reports', reportsRouter);
api.use('/admin', adminRouter);

app.use('/api/v1', api);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ code: 500, data: null, message: '服务器错误' });
});

async function ensureSchemaCompat() {
  try {
    await query('ALTER TABLE posts ADD COLUMN is_private TINYINT(1) NOT NULL DEFAULT 0');
  } catch (e) {
    if (!String(e?.message || '').includes('Duplicate column')) {
      console.error('schema check failed:', e.message || e);
    }
  }
  try {
    await query("ALTER TABLE users ADD COLUMN bio VARCHAR(200) NOT NULL DEFAULT ''");
  } catch (e) {
    if (!String(e?.message || '').includes('Duplicate column')) {
      console.error('schema check failed:', e.message || e);
    }
  }
  try {
    await query('ALTER TABLE chat_sessions ADD COLUMN is_pinned TINYINT(1) NOT NULL DEFAULT 0');
  } catch (e) {
    if (!String(e?.message || '').includes('Duplicate column')) {
      console.error('schema check failed:', e.message || e);
    }
  }
  try {
    await query('ALTER TABLE interview_sessions ADD COLUMN total_questions INT NOT NULL DEFAULT 0');
  } catch (e) {
    if (!String(e?.message || '').includes('Duplicate column')) {
      console.error('schema check failed:', e.message || e);
    }
  }
  try {
    await query("ALTER TABLE users ADD COLUMN role ENUM('user','admin') NOT NULL DEFAULT 'user'");
  } catch (e) {
    if (!String(e?.message || '').includes('Duplicate column')) {
      console.error('schema check failed:', e.message || e);
    }
  }
  try {
    await query('ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1');
  } catch (e) {
    if (!String(e?.message || '').includes('Duplicate column')) {
      console.error('schema check failed:', e.message || e);
    }
  }
  try {
    await query('ALTER TABLE users ADD COLUMN student_no VARCHAR(32) NULL UNIQUE');
  } catch (e) {
    if (!String(e?.message || '').includes('Duplicate column')) {
      console.error('schema check failed:', e.message || e);
    }
  }
  try {
    await query('ALTER TABLE users ADD COLUMN email VARCHAR(128) NULL UNIQUE');
  } catch (e) {
    if (!String(e?.message || '').includes('Duplicate column')) {
      console.error('schema check failed:', e.message || e);
    }
  }
  try {
    await query('UPDATE users SET student_no = username WHERE student_no IS NULL OR student_no = ""');
  } catch (e) {
    console.error('schema check failed:', e.message || e);
  }
  try {
    await query('UPDATE users SET email = CONCAT(username, "@example.invalid") WHERE email IS NULL OR email = ""');
  } catch (e) {
    console.error('schema check failed:', e.message || e);
  }
  try {
    await query("ALTER TABLE posts ADD COLUMN review_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved'");
  } catch (e) {
    if (!String(e?.message || '').includes('Duplicate column')) {
      console.error('schema check failed:', e.message || e);
    }
  }
  try {
    await query('ALTER TABLE posts ADD COLUMN review_note VARCHAR(200) NOT NULL DEFAULT ""');
  } catch (e) {
    if (!String(e?.message || '').includes('Duplicate column')) {
      console.error('schema check failed:', e.message || e);
    }
  }
  try {
    await query('ALTER TABLE posts ADD COLUMN reviewed_by INT NULL');
  } catch (e) {
    if (!String(e?.message || '').includes('Duplicate column')) {
      console.error('schema check failed:', e.message || e);
    }
  }
  try {
    await query('ALTER TABLE posts ADD COLUMN reviewed_at TIMESTAMP NULL');
  } catch (e) {
    if (!String(e?.message || '').includes('Duplicate column')) {
      console.error('schema check failed:', e.message || e);
    }
  }
  try {
    await query(`CREATE TABLE IF NOT EXISTS password_reset_codes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(128) NOT NULL,
      user_id INT NOT NULL,
      code_hash VARCHAR(64) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_reset_email (email),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
  } catch (e) {
    console.error('schema check failed:', e.message || e);
  }
  try {
    await query(`CREATE TABLE IF NOT EXISTS password_reset_sms_codes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      phone VARCHAR(32) NOT NULL,
      user_id INT NOT NULL,
      code_hash VARCHAR(64) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_reset_phone (phone),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
  } catch (e) {
    console.error('schema check failed:', e.message || e);
  }
  try {
    await query(`CREATE TABLE IF NOT EXISTS register_email_codes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(128) NOT NULL,
      student_no VARCHAR(32) NOT NULL,
      code_hash VARCHAR(64) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_register_email (email)
    )`);
  } catch (e) {
    console.error('schema check failed:', e.message || e);
  }
  try {
    await query(`CREATE TABLE IF NOT EXISTS register_sms_codes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      phone VARCHAR(32) NOT NULL,
      code_hash VARCHAR(64) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_register_phone (phone)
    )`);
  } catch (e) {
    console.error('schema check failed:', e.message || e);
  }
  try {
    await query(`CREATE TABLE IF NOT EXISTS content_reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      reporter_id INT NOT NULL,
      target_type ENUM('post','comment') NOT NULL,
      target_id INT NOT NULL,
      reason VARCHAR(120) NOT NULL,
      details TEXT,
      status ENUM('pending','resolved','rejected') NOT NULL DEFAULT 'pending',
      admin_note VARCHAR(200) NOT NULL DEFAULT '',
      handled_by INT NULL,
      handled_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
  } catch (e) {
    console.error('schema check failed:', e.message || e);
  }
  try {
    await query('ALTER TABLE comments ADD COLUMN parent_comment_id INT NULL');
  } catch (e) {
    if (!String(e?.message || '').includes('Duplicate column')) {
      console.error('schema check failed:', e.message || e);
    }
  }
  try {
    await query('ALTER TABLE comments ADD COLUMN reply_to_user_id INT NULL');
  } catch (e) {
    if (!String(e?.message || '').includes('Duplicate column')) {
      console.error('schema check failed:', e.message || e);
    }
  }
  try {
    await query('ALTER TABLE answer_comments ADD COLUMN parent_comment_id INT NULL');
  } catch (e) {
    if (!String(e?.message || '').includes('Duplicate column')) {
      console.error('schema check failed:', e.message || e);
    }
  }
  try {
    await query('ALTER TABLE answer_comments ADD COLUMN reply_to_user_id INT NULL');
  } catch (e) {
    if (!String(e?.message || '').includes('Duplicate column')) {
      console.error('schema check failed:', e.message || e);
    }
  }
  const adminNames = String(process.env.ADMIN_USERNAMES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (adminNames.length) {
    try {
      const ph = adminNames.map(() => '?').join(',');
      await query(`UPDATE users SET role = 'admin' WHERE username IN (${ph})`, adminNames);
    } catch (e) {
      console.error('schema check failed:', e.message || e);
    }
  }
}

const port = Number(process.env.PORT || 3001);
ensureSchemaCompat().finally(() => {
  app.listen(port, () => {
    console.log(`TalkWork API http://localhost:${port}`);
  });
});
