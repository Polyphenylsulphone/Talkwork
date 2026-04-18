import { Router } from 'express';
import { query } from '../db.js';
import { ok, fail } from '../util/response.js';
import { requireAuth } from '../middleware/auth.js';
import { applyAnonymousAuthorDisplay } from '../util/anonymousPost.js';

const router = Router();

router.get('/posts', requireAuth, async (req, res) => {
  try {
    const q = req.query.q ? String(req.query.q).trim() : '';
    const uid = req.user.id;
    let sql = `SELECT p.id, p.title, p.content, p.college, p.post_type, p.created_at, p.is_private, p.is_anonymous,
      u.username, u.avatar_url,
      (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likes_count,
      (SELECT COUNT(*) FROM post_collects pc WHERE pc.post_id = p.id) AS collects_count,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comments_count,
      EXISTS (SELECT 1 FROM post_likes pl2 WHERE pl2.post_id = p.id AND pl2.user_id = ?) AS liked,
      EXISTS (SELECT 1 FROM post_collects pc2 WHERE pc2.post_id = p.id AND pc2.user_id = ?) AS collected
      FROM posts p JOIN users u ON u.id = p.user_id WHERE p.user_id = ?`;
    const params = [uid, uid, uid];
    if (q) {
      sql += ' AND (p.title LIKE ? OR p.content LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }
    sql += ' ORDER BY p.created_at DESC LIMIT 200';
    const list = await query(sql, params);
    res.json(ok(list.map((row) => applyAnonymousAuthorDisplay(row))));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.get('/collects', requireAuth, async (req, res) => {
  try {
    const q = req.query.q ? String(req.query.q).trim() : '';
    const uid = req.user.id;
    let sql = `SELECT p.id, p.title, p.content, p.college, p.post_type, p.created_at, p.is_anonymous,
      u.username, u.avatar_url,
      (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likes_count,
      (SELECT COUNT(*) FROM post_collects pc WHERE pc.post_id = p.id) AS collects_count,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comments_count,
      EXISTS (SELECT 1 FROM post_likes pl2 WHERE pl2.post_id = p.id AND pl2.user_id = ?) AS liked,
      1 AS collected
      FROM post_collects pc JOIN posts p ON p.id = pc.post_id
      JOIN users u ON u.id = p.user_id WHERE pc.user_id = ?`;
    const params = [uid, uid];
    if (q) {
      sql += ' AND (p.title LIKE ? OR p.content LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }
    sql += ' ORDER BY pc.created_at DESC LIMIT 200';
    const rows = await query(sql, params);
    res.json(ok(rows.map((row) => applyAnonymousAuthorDisplay(row))));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.delete('/collects/:postId', requireAuth, async (req, res) => {
  const postId = Number(req.params.postId);
  await query('DELETE FROM post_collects WHERE user_id = ? AND post_id = ?', [req.user.id, postId]);
  res.json(ok(true));
});

router.patch('/posts/:id/privacy', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const isPrivate = req.body?.is_private ? 1 : 0;
    const rows = await query('SELECT user_id FROM posts WHERE id = ?', [id]);
    if (!rows[0]) return res.status(404).json(fail(404, '帖子不存在'));
    if (rows[0].user_id !== req.user.id) return res.status(403).json(fail(403, '无权限'));
    await query('UPDATE posts SET is_private = ? WHERE id = ?', [isPrivate, id]);
    res.json(ok({ id, is_private: !!isPrivate }));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.get('/likes', requireAuth, async (req, res) => {
  try {
    const q = req.query.q ? String(req.query.q).trim() : '';
    const uid = req.user.id;
    let sql = `SELECT p.id, p.title, p.content, p.college, p.post_type, p.created_at, p.is_anonymous,
      u.username, u.avatar_url,
      (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likes_count,
      (SELECT COUNT(*) FROM post_collects pc WHERE pc.post_id = p.id) AS collects_count,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comments_count,
      1 AS liked,
      EXISTS (SELECT 1 FROM post_collects pc2 WHERE pc2.post_id = p.id AND pc2.user_id = ?) AS collected
      FROM post_likes pl JOIN posts p ON p.id = pl.post_id
      JOIN users u ON u.id = p.user_id WHERE pl.user_id = ?`;
    const params = [uid, uid];
    if (q) {
      sql += ' AND (p.title LIKE ? OR p.content LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }
    sql += ' ORDER BY pl.created_at DESC LIMIT 200';
    const rows = await query(sql, params);
    res.json(ok(rows.map((row) => applyAnonymousAuthorDisplay(row))));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.get('/history', requireAuth, async (req, res) => {
  try {
    const q = req.query.q ? String(req.query.q).trim() : '';
    const uid = req.user.id;
    let sql = `SELECT p.id, p.title, p.content, p.college, p.post_type, p.created_at, h.viewed_at, p.is_anonymous,
      u.username, u.avatar_url,
      (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likes_count,
      (SELECT COUNT(*) FROM post_collects pc WHERE pc.post_id = p.id) AS collects_count,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comments_count,
      EXISTS (SELECT 1 FROM post_likes pl2 WHERE pl2.post_id = p.id AND pl2.user_id = ?) AS liked,
      EXISTS (SELECT 1 FROM post_collects pc2 WHERE pc2.post_id = p.id AND pc2.user_id = ?) AS collected
      FROM browse_history h JOIN posts p ON p.id = h.post_id
      JOIN users u ON u.id = p.user_id WHERE h.user_id = ?`;
    const params = [uid, uid, uid];
    if (q) {
      sql += ' AND (p.title LIKE ? OR p.content LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }
    sql += ' ORDER BY h.viewed_at DESC LIMIT 50';
    const rows = await query(sql, params);
    res.json(ok(rows.map((row) => applyAnonymousAuthorDisplay(row))));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.delete('/history', requireAuth, async (req, res) => {
  await query('DELETE FROM browse_history WHERE user_id = ?', [req.user.id]);
  res.json(ok(true));
});

export default router;
