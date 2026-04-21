import { Router } from 'express';
import { query, execute } from '../db.js';
import { ok, fail } from '../util/response.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAdmin);

router.get('/dashboard', async (_req, res) => {
  try {
    const [users, posts, comments, reports, pendingPosts, pendingReports] = await Promise.all([
      query('SELECT COUNT(*) AS c FROM users'),
      query('SELECT COUNT(*) AS c FROM posts'),
      query('SELECT (SELECT COUNT(*) FROM comments) + (SELECT COUNT(*) FROM answer_comments) AS c'),
      query('SELECT COUNT(*) AS c FROM content_reports'),
      query("SELECT COUNT(*) AS c FROM posts WHERE review_status = 'pending'"),
      query("SELECT COUNT(*) AS c FROM content_reports WHERE status = 'pending'"),
    ]);
    res.json(
      ok({
        users: Number(users[0]?.c || 0),
        posts: Number(posts[0]?.c || 0),
        comments: Number(comments[0]?.c || 0),
        reports: Number(reports[0]?.c || 0),
        pending_posts: Number(pendingPosts[0]?.c || 0),
        pending_reports: Number(pendingReports[0]?.c || 0),
      })
    );
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.get('/users', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20));
    const offset = (page - 1) * pageSize;
    const q = String(req.query.q || '').trim();
    const where = q ? 'WHERE username LIKE ?' : '';
    const params = q ? [`%${q}%`] : [];
    const rows = await query(
      `SELECT id, username, role, is_active, college, created_at
       FROM users
       ${where}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    res.json(ok({ list: rows, page, pageSize }));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.patch('/users/:id', async (req, res) => {
  try {
    const uid = Number(req.params.id);
    const { role, is_active } = req.body || {};
    const rows = await query('SELECT id FROM users WHERE id = ?', [uid]);
    if (!rows[0]) return res.status(404).json(fail(404, '用户不存在'));
    if (role != null) {
      const nextRole = role === 'admin' ? 'admin' : 'user';
      await execute('UPDATE users SET role = ? WHERE id = ?', [nextRole, uid]);
    }
    if (is_active != null) {
      await execute('UPDATE users SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, uid]);
    }
    const out = await query('SELECT id, username, role, is_active, college, created_at FROM users WHERE id = ?', [uid]);
    res.json(ok(out[0]));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.get('/posts', async (req, res) => {
  try {
    const status = String(req.query.status || 'all');
    const where = status === 'all' ? '' : 'WHERE p.review_status = ?';
    const params = status === 'all' ? [] : [status];
    const rows = await query(
      `SELECT p.id, p.title, p.post_type, p.review_status, p.created_at, p.updated_at, p.is_anonymous, u.username
       FROM posts p
       JOIN users u ON u.id = p.user_id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT 200`,
      params
    );
    res.json(ok(rows));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.patch('/posts/:id/review', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const action = String(req.body?.action || '').trim();
    const note = String(req.body?.note || '').trim().slice(0, 200);
    if (!['approve', 'reject', 'pending'].includes(action)) {
      return res.status(400).json(fail(400, '无效审核操作'));
    }
    const next = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'pending';
    await execute(
      `UPDATE posts
       SET review_status = ?, review_note = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [next, note, req.user.id, id]
    );
    res.json(ok(true));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.get('/comments', async (_req, res) => {
  try {
    const rows = await query(
      `(SELECT c.id, 'post' AS source, c.content, c.created_at, u.username, p.title AS target_title
        FROM comments c
        JOIN users u ON u.id = c.user_id
        JOIN posts p ON p.id = c.post_id)
       UNION ALL
       (SELECT ac.id, 'answer' AS source, ac.content, ac.created_at, u.username, p.title AS target_title
        FROM answer_comments ac
        JOIN users u ON u.id = ac.user_id
        JOIN answers a ON a.id = ac.answer_id
        JOIN posts p ON p.id = a.post_id)
       ORDER BY created_at DESC
       LIMIT 200`
    );
    res.json(ok(rows));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.delete('/comments/:source/:id', async (req, res) => {
  try {
    const source = String(req.params.source);
    const id = Number(req.params.id);
    if (source === 'post') await execute('DELETE FROM comments WHERE id = ?', [id]);
    else if (source === 'answer') await execute('DELETE FROM answer_comments WHERE id = ?', [id]);
    else return res.status(400).json(fail(400, '无效评论类型'));
    res.json(ok(true));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.get('/reports', async (req, res) => {
  try {
    const status = String(req.query.status || 'all');
    const where = status === 'all' ? '' : 'WHERE r.status = ?';
    const params = status === 'all' ? [] : [status];
    const rows = await query(
      `SELECT r.*, u.username AS reporter_name
       FROM content_reports r
       JOIN users u ON u.id = r.reporter_id
       ${where}
       ORDER BY r.created_at DESC
       LIMIT 200`,
      params
    );
    res.json(ok(rows));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.patch('/reports/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const status = String(req.body?.status || '').trim();
    const note = String(req.body?.note || '').trim().slice(0, 200);
    if (!['pending', 'resolved', 'rejected'].includes(status)) {
      return res.status(400).json(fail(400, '无效状态'));
    }
    await execute(
      `UPDATE content_reports
       SET status = ?, admin_note = ?, handled_by = ?, handled_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, note, req.user.id, id]
    );
    res.json(ok(true));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

export default router;
