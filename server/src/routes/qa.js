import { Router } from 'express';
import { query, execute } from '../db.js';
import { ok, fail } from '../util/response.js';
import { authOptional, requireAuth } from '../middleware/auth.js';
import { deepseekChat } from '../services/deepseek.js';
import { sanitizeRichHtml, sanitizePlainText } from '../util/sanitize.js';
import { assertNoSensitive } from '../util/sensitive.js';
import { rankRelatedPosts } from '../util/related.js';
import { applyAnonymousAuthorDisplay } from '../util/anonymousPost.js';

const router = Router();

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function syncAnswerLikes(answerId) {
  await query(
    'UPDATE answers SET likes_count = (SELECT COUNT(*) FROM answer_likes WHERE answer_id = ?) WHERE id = ?',
    [answerId, answerId]
  );
}

async function enrichAnswers(answers, viewerId) {
  if (!answers.length) return answers;
  const ids = answers.map((a) => a.id);
  const ph = ids.map(() => '?').join(',');
  const uid = viewerId ?? 0;

  const [likeRows, collectRows, commentCountRows, myLikes, myCollects, commentRows] = await Promise.all([
    query(`SELECT answer_id, COUNT(*) AS c FROM answer_likes WHERE answer_id IN (${ph}) GROUP BY answer_id`, ids),
    query(`SELECT answer_id, COUNT(*) AS c FROM answer_collects WHERE answer_id IN (${ph}) GROUP BY answer_id`, ids),
    query(`SELECT answer_id, COUNT(*) AS c FROM answer_comments WHERE answer_id IN (${ph}) GROUP BY answer_id`, ids),
    uid
      ? query(`SELECT answer_id FROM answer_likes WHERE user_id = ? AND answer_id IN (${ph})`, [uid, ...ids])
      : Promise.resolve([]),
    uid
      ? query(`SELECT answer_id FROM answer_collects WHERE user_id = ? AND answer_id IN (${ph})`, [uid, ...ids])
      : Promise.resolve([]),
    query(
      `SELECT ac.*, u.username, ru.username AS reply_to_username
       FROM answer_comments ac
       JOIN users u ON u.id = ac.user_id
       LEFT JOIN users ru ON ru.id = ac.reply_to_user_id
       WHERE ac.answer_id IN (${ph})
       ORDER BY ac.created_at ASC`,
      ids
    ),
  ]);

  const likeMap = Object.fromEntries(likeRows.map((r) => [r.answer_id, Number(r.c)]));
  const collectMap = Object.fromEntries(collectRows.map((r) => [r.answer_id, Number(r.c)]));
  const commentCountMap = Object.fromEntries(commentCountRows.map((r) => [r.answer_id, Number(r.c)]));
  const likedSet = new Set(myLikes.map((r) => r.answer_id));
  const collectedSet = new Set(myCollects.map((r) => r.answer_id));

  const commentsByAnswer = {};
  for (const r of commentRows) {
    if (!commentsByAnswer[r.answer_id]) commentsByAnswer[r.answer_id] = [];
    commentsByAnswer[r.answer_id].push(r);
  }

  return answers.map((a) => ({
    ...a,
    likes_count: likeMap[a.id] ?? 0,
    collects_count: collectMap[a.id] ?? 0,
    comments_count: commentCountMap[a.id] ?? 0,
    liked: likedSet.has(a.id),
    collected: collectedSet.has(a.id),
    reply_comments: commentsByAnswer[a.id] || [],
  }));
}

router.get('/', authOptional, async (req, res) => {
  try {
    const tab = req.query.tab || 'all';
    const college = req.query.college;
    const q = req.query.q ? String(req.query.q).trim() : '';
    const sort = req.query.sort || 'time';
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = 15;
    const offset = (page - 1) * pageSize;

    let where = "p.post_type = 'question' AND p.is_private = 0 AND p.review_status = 'approved'";
    const params = [];
    if (college && college !== 'all') {
      where += ' AND p.college = ?';
      params.push(college);
    }
    if (tab === 'unanswered') {
      where += ' AND (SELECT COUNT(*) FROM answers a WHERE a.post_id = p.id AND a.is_ai = 0) = 0';
    } else if (tab === 'answered') {
      where += ' AND (SELECT COUNT(*) FROM answers a WHERE a.post_id = p.id AND a.is_ai = 0) > 0';
    }
    if (q) {
      where += ' AND (p.title LIKE ? OR p.content LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }

    let orderBy = 'p.created_at DESC';
    if (sort === 'hot') {
      orderBy =
        '((SELECT COUNT(*) FROM answer_likes al JOIN answers a2 ON a2.id = al.answer_id WHERE a2.post_id = p.id) * 2 + (SELECT COUNT(*) FROM answer_comments ac JOIN answers a3 ON a3.id = ac.answer_id WHERE a3.post_id = p.id) * 3 + p.views) DESC, p.created_at DESC';
    }

    const uid = req.user?.id || 0;
    const list = await query(
      `SELECT p.*, u.username,
        (SELECT COUNT(*) FROM answers a WHERE a.post_id = p.id AND a.is_ai = 0) AS human_answers,
        (SELECT COUNT(*) FROM answers a WHERE a.post_id = p.id) AS answers_count,
        (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likes_count,
        (SELECT COUNT(*) FROM post_collects pc WHERE pc.post_id = p.id) AS collects_count,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comments_count,
        EXISTS (SELECT 1 FROM post_likes plx WHERE plx.post_id = p.id AND plx.user_id = ?) AS liked,
        EXISTS (SELECT 1 FROM post_collects pcx WHERE pcx.post_id = p.id AND pcx.user_id = ?) AS collected
       FROM posts p JOIN users u ON u.id = p.user_id
       WHERE ${where}
       ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [uid, uid, ...params, pageSize, offset]
    );

    const mapped = list.map((p) =>
      applyAnonymousAuthorDisplay({
        ...p,
        summary: stripHtml(p.content).slice(0, 140),
      })
    );
    res.json(ok({ list: mapped, page, pageSize }));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.post('/answers/:answerId/like', requireAuth, async (req, res) => {
  try {
    const answerId = Number(req.params.answerId);
    const rows = await query('SELECT id FROM answers WHERE id = ?', [answerId]);
    if (!rows[0]) return res.status(404).json(fail(404, '回答不存在'));
    const exists = await query('SELECT 1 FROM answer_likes WHERE user_id = ? AND answer_id = ?', [
      req.user.id,
      answerId,
    ]);
    if (exists[0]) {
      await query('DELETE FROM answer_likes WHERE user_id = ? AND answer_id = ?', [req.user.id, answerId]);
    } else {
      await query('INSERT INTO answer_likes (user_id, answer_id) VALUES (?,?)', [req.user.id, answerId]);
    }
    await syncAnswerLikes(answerId);
    const [{ c }] = await query('SELECT COUNT(*) AS c FROM answer_likes WHERE answer_id = ?', [answerId]);
    res.json(ok({ liked: !exists[0], likes_count: c }));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.post('/answers/:answerId/collect', requireAuth, async (req, res) => {
  try {
    const answerId = Number(req.params.answerId);
    const rows = await query('SELECT id FROM answers WHERE id = ?', [answerId]);
    if (!rows[0]) return res.status(404).json(fail(404, '回答不存在'));
    const exists = await query('SELECT 1 FROM answer_collects WHERE user_id = ? AND answer_id = ?', [
      req.user.id,
      answerId,
    ]);
    if (exists[0]) {
      await query('DELETE FROM answer_collects WHERE user_id = ? AND answer_id = ?', [req.user.id, answerId]);
    } else {
      await query('INSERT INTO answer_collects (user_id, answer_id) VALUES (?,?)', [req.user.id, answerId]);
    }
    const [{ c }] = await query('SELECT COUNT(*) AS c FROM answer_collects WHERE answer_id = ?', [answerId]);
    res.json(ok({ collected: !exists[0], collects_count: c }));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.post('/answers/:answerId/comments', requireAuth, async (req, res) => {
  try {
    const answerId = Number(req.params.answerId);
    const { content, parent_comment_id, reply_to_user_id } = req.body || {};
    if (!content || !String(content).trim()) {
      return res.status(400).json(fail(400, '评论不能为空'));
    }
    try {
      assertNoSensitive(content);
    } catch (e) {
      return res.status(400).json(fail(400, e.message));
    }
    const rows = await query('SELECT id FROM answers WHERE id = ?', [answerId]);
    if (!rows[0]) return res.status(404).json(fail(404, '回答不存在'));
    const safe = sanitizePlainText(String(content).trim());
    let parentId = Number(parent_comment_id) || null;
    let replyToUserId = Number(reply_to_user_id) || null;
    if (parentId) {
      const parentRows = await query(
        'SELECT id, answer_id, parent_comment_id, user_id FROM answer_comments WHERE id = ?',
        [parentId]
      );
      const parent = parentRows[0];
      if (!parent || Number(parent.answer_id) !== answerId) {
        return res.status(400).json(fail(400, '回复目标不存在'));
      }
      // 最多两级：回复二级评论时，挂到一级父评论下
      if (parent.parent_comment_id) parentId = Number(parent.parent_comment_id);
      if (!replyToUserId) replyToUserId = Number(parent.user_id);
    } else {
      replyToUserId = null;
    }
    await execute(
      'INSERT INTO answer_comments (answer_id, user_id, content, parent_comment_id, reply_to_user_id) VALUES (?,?,?,?,?)',
      [
      answerId,
      req.user.id,
      safe,
        parentId,
        replyToUserId,
      ]
    );
    const postRow = await query('SELECT post_id FROM answers WHERE id = ?', [answerId]);
    const postId = postRow[0].post_id;
    let answers = await query(
      `SELECT a.*, u.username, u.avatar_url FROM answers a
       LEFT JOIN users u ON u.id = a.user_id WHERE a.post_id = ? ORDER BY a.created_at DESC`,
      [postId]
    );
    answers = await enrichAnswers(answers, req.user.id);
    res.json(ok(answers));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.delete('/answers/:answerId', requireAuth, async (req, res) => {
  try {
    const answerId = Number(req.params.answerId);
    const rows = await query('SELECT user_id, is_ai, post_id FROM answers WHERE id = ?', [answerId]);
    if (!rows[0]) return res.status(404).json(fail(404, '回答不存在'));
    if (rows[0].is_ai) return res.status(403).json(fail(403, '不能删除系统回答'));
    if (rows[0].user_id !== req.user.id) return res.status(403).json(fail(403, '无权限'));
    await query('DELETE FROM answers WHERE id = ?', [answerId]);
    const answers = await query(
      `SELECT a.*, u.username, u.avatar_url FROM answers a
       LEFT JOIN users u ON u.id = a.user_id WHERE a.post_id = ? ORDER BY a.created_at DESC`,
      [rows[0].post_id]
    );
    const enriched = await enrichAnswers(answers, req.user.id);
    res.json(ok(enriched));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.patch('/answers/:answerId', requireAuth, async (req, res) => {
  try {
    const answerId = Number(req.params.answerId);
    const { content } = req.body || {};
    if (!content || !stripHtml(content)) {
      return res.status(400).json(fail(400, '回答不能为空'));
    }
    try {
      assertNoSensitive(stripHtml(content));
    } catch (e) {
      return res.status(400).json(fail(400, e.message));
    }
    const rows = await query('SELECT user_id, is_ai, post_id FROM answers WHERE id = ?', [answerId]);
    if (!rows[0]) return res.status(404).json(fail(404, '回答不存在'));
    if (rows[0].is_ai) return res.status(403).json(fail(403, '不能编辑系统回答'));
    if (rows[0].user_id !== req.user.id) return res.status(403).json(fail(403, '无权限'));
    const safe = sanitizeRichHtml(content);
    await execute('UPDATE answers SET content = ? WHERE id = ?', [safe, answerId]);
    let answers = await query(
      `SELECT a.*, u.username, u.avatar_url FROM answers a
       LEFT JOIN users u ON u.id = a.user_id WHERE a.post_id = ? ORDER BY a.created_at DESC`,
      [rows[0].post_id]
    );
    answers = await enrichAnswers(answers, req.user.id);
    res.json(ok(answers));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.get('/:id', authOptional, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await query(
      `SELECT p.*, u.username, u.avatar_url FROM posts p
       JOIN users u ON u.id = p.user_id
       WHERE p.id = ? AND p.post_type = 'question' AND ((p.is_private = 0 AND p.review_status = 'approved') OR p.user_id = ?)`,
      [id, req.user?.id || 0]
    );
    const post = rows[0];
    if (!post) return res.status(404).json(fail(404, '问题不存在'));
    await query('UPDATE posts SET views = views + 1 WHERE id = ?', [id]);

    let answers = await query(
      `SELECT a.*, u.username, u.avatar_url FROM answers a
       LEFT JOIN users u ON u.id = a.user_id WHERE a.post_id = ? ORDER BY a.created_at DESC`,
      [id]
    );

    const humanCount = answers.filter((a) => !a.is_ai).length;
    if (humanCount === 0) {
      const hasAi = answers.some((a) => a.is_ai);
      if (!hasAi) {
        let text = '';
        try {
          text = await deepseekChat(
            [
              {
                role: 'system',
                content:
                  '你是 T宝。用中文给出温暖、结构清晰的第一条回答，帮助提问者迈出下一步。末尾追加一行：由T宝AI生成',
              },
              {
                role: 'user',
                content: `问题：${post.title}\n描述：${stripHtml(post.content).slice(0, 1000)}`,
              },
            ],
            { temperature: 0.55 }
          );
        } catch {
          text = '试着把问题拆成「背景—卡点—已尝试」三部分，会更容易获得高质量回答。\n\n由T宝AI生成';
        }
        await query('INSERT INTO answers (post_id, user_id, content, is_ai) VALUES (?,?,?,1)', [
          id,
          null,
          `<p>${String(text).replace(/\n/g, '</p><p>')}</p>`,
        ]);
        answers = await query(
          `SELECT a.*, u.username, u.avatar_url FROM answers a
           LEFT JOIN users u ON u.id = a.user_id WHERE a.post_id = ? ORDER BY a.created_at DESC`,
          [id]
        );
      }
    }

    answers = await enrichAnswers(answers, req.user?.id);

    const pool = await query(
      `SELECT id, title, content, post_type, college, created_at
       FROM posts
       WHERE is_private = 0 AND review_status = 'approved' AND id != ?
       ORDER BY created_at DESC
       LIMIT 260`,
      [id]
    );
    const related = rankRelatedPosts(post, pool, 6).map(({ id: rid, title, post_type, college, created_at }) => ({
      id: rid,
      title,
      post_type,
      college,
      created_at,
    }));

    res.json(ok({ post: applyAnonymousAuthorDisplay(post), answers, related }));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.post('/:id/answers', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { content } = req.body || {};
    if (!content || !stripHtml(content)) {
      return res.status(400).json(fail(400, '回答不能为空'));
    }
    try {
      assertNoSensitive(stripHtml(content));
    } catch (e) {
      return res.status(400).json(fail(400, e.message));
    }
    const safe = sanitizeRichHtml(String(content));
    await query('INSERT INTO answers (post_id, user_id, content, is_ai) VALUES (?,?,?,0)', [
      id,
      req.user.id,
      safe,
    ]);
    let answers = await query(
      `SELECT a.*, u.username, u.avatar_url FROM answers a
       LEFT JOIN users u ON u.id = a.user_id WHERE a.post_id = ? ORDER BY a.created_at DESC`,
      [id]
    );
    answers = await enrichAnswers(answers, req.user.id);
    res.json(ok(answers));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

export default router;
