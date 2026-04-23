import { Router } from 'express';
import { query, execute } from '../db.js';
import { ok, fail } from '../util/response.js';
import { authOptional, requireAuth } from '../middleware/auth.js';
import { deepseekChat } from '../services/deepseek.js';
import { sanitizeRichHtml, sanitizePlainText } from '../util/sanitize.js';
import { assertNoSensitive } from '../util/sensitive.js';
import { stripAssistantMarkdown } from '../util/plainText.js';
import { rankRelatedPosts } from '../util/related.js';
import { applyAnonymousAuthorDisplay } from '../util/anonymousPost.js';

const router = Router();

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function excerpt(html, max) {
  const t = stripHtml(html);
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

async function listCommentsForPost(postId, viewerId) {
  const uid = viewerId ?? 0;
  return query(
    `SELECT c.*, u.username, u.avatar_url, ru.username AS reply_to_username,
      (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id) AS likes_count,
      EXISTS (SELECT 1 FROM comment_likes cl2 WHERE cl2.comment_id = c.id AND cl2.user_id = ?) AS liked
     FROM comments c
     JOIN users u ON u.id = c.user_id
     LEFT JOIN users ru ON ru.id = c.reply_to_user_id
     WHERE c.post_id = ?
     ORDER BY c.created_at ASC`,
    [uid, postId]
  );
}

async function getPostRow(id, viewerId) {
  const uid = viewerId ?? 0;
  const rows = await query(
    `SELECT p.*, u.username, u.avatar_url,
      (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likes_count,
      (SELECT COUNT(*) FROM post_collects pc WHERE pc.post_id = p.id) AS collects_count,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comments_count,
      (SELECT COUNT(*) FROM answers a WHERE a.post_id = p.id AND a.is_ai = 0) AS human_answers,
      (SELECT COUNT(*) FROM answers a WHERE a.post_id = p.id) AS answers_count
     FROM posts p JOIN users u ON u.id = p.user_id
     WHERE p.id = ? AND ((p.is_private = 0 AND p.review_status = 'approved') OR p.user_id = ?)`,
    [id, uid]
  );
  return rows[0];
}

router.get('/', authOptional, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(30, Math.max(1, Number(req.query.pageSize || req.query.page_size) || 15));
    const offset = (page - 1) * pageSize;
    const college = req.query.college;
    const kw = req.query.q ? String(req.query.q).trim() : '';
    const postType = req.query.type;

    let where = "p.is_private = 0 AND p.review_status = 'approved'";
    const params = [];
    if (college && college !== 'all') {
      where += ' AND p.college = ?';
      params.push(college);
    }
    if (postType === 'question' || postType === 'article') {
      where += ' AND p.post_type = ?';
      params.push(postType);
    }
    if (kw) {
      where += ' AND (p.title LIKE ? OR p.content LIKE ?)';
      params.push(`%${kw}%`, `%${kw}%`);
    }

    const uid = req.user?.id || 0;
    const list = await query(
      `SELECT p.id, p.title, p.content, p.post_type, p.college, p.views, p.created_at, p.is_anonymous,
        u.username, u.avatar_url,
        (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likes_count,
        (SELECT COUNT(*) FROM post_collects pc WHERE pc.post_id = p.id) AS collects_count,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comments_count,
        (SELECT COUNT(*) FROM answers a WHERE a.post_id = p.id) AS answers_count,
        EXISTS (SELECT 1 FROM post_likes plx WHERE plx.post_id = p.id AND plx.user_id = ?) AS liked,
        EXISTS (SELECT 1 FROM post_collects pcx WHERE pcx.post_id = p.id AND pcx.user_id = ?) AS collected
       FROM posts p JOIN users u ON u.id = p.user_id
       WHERE ${where}
       ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
      [uid, uid, ...params, pageSize, offset]
    );

    const mapped = list.map((p) =>
      applyAnonymousAuthorDisplay({
        ...p,
        summary: excerpt(p.content, 120),
      })
    );

    res.json(ok({ list: mapped, page, pageSize }));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.post('/comments/:cid/like', requireAuth, async (req, res) => {
  try {
    const cid = Number(req.params.cid);
    const rows = await query('SELECT id FROM comments WHERE id = ?', [cid]);
    if (!rows[0]) return res.status(404).json(fail(404, '评论不存在'));
    const exists = await query('SELECT 1 FROM comment_likes WHERE user_id = ? AND comment_id = ?', [
      req.user.id,
      cid,
    ]);
    if (exists[0]) {
      await query('DELETE FROM comment_likes WHERE user_id = ? AND comment_id = ?', [req.user.id, cid]);
    } else {
      await query('INSERT INTO comment_likes (user_id, comment_id) VALUES (?,?)', [req.user.id, cid]);
    }
    const [{ c }] = await query('SELECT COUNT(*) AS c FROM comment_likes WHERE comment_id = ?', [cid]);
    res.json(ok({ liked: !exists[0], likes_count: c }));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.get('/:id', authOptional, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const post = await getPostRow(id, req.user?.id);
    if (!post) return res.status(404).json(fail(404, '帖子不存在'));

    await query('UPDATE posts SET views = views + 1 WHERE id = ?', [id]);

    let liked = false;
    let collected = false;
    if (req.user) {
      const [l] = await query(
        'SELECT 1 FROM post_likes WHERE user_id = ? AND post_id = ? LIMIT 1',
        [req.user.id, id]
      );
      const [c] = await query(
        'SELECT 1 FROM post_collects WHERE user_id = ? AND post_id = ? LIMIT 1',
        [req.user.id, id]
      );
      liked = !!l;
      collected = !!c;
      await query('INSERT INTO browse_history (user_id, post_id) VALUES (?,?)', [req.user.id, id]);
    }

    const comments = await listCommentsForPost(id, req.user?.id);

    let tbaoInsight = null;
    if (post.post_type === 'question') {
      const prompt = `你是亲切的求职导师「T宝」，请像朋友聊天一样回答，语气自然、温暖、易懂。不要用 Markdown（不要标题、列表、加粗、代码块）。用户问题标题：${post.title}\n请给出2~3句中文建议。`;
      try {
        tbaoInsight = stripAssistantMarkdown(await deepseekChat([{ role: 'user', content: prompt }], { temperature: 0.6 }));
      } catch {
        tbaoInsight = '先理清岗位与自身经历的连接点，再组织一个真诚的小故事来讲述你的动机与成长。';
      }
    }

    const pool = await query(
      `SELECT id, title, content, post_type, college, created_at
       FROM posts
       WHERE is_private = 0 AND review_status = 'approved' AND id != ?
       ORDER BY created_at DESC
       LIMIT 220`,
      [id]
    );
    const related = rankRelatedPosts(post, pool, 5).map(({ id: rid, title, post_type, college, created_at }) => ({
      id: rid,
      title,
      post_type,
      college,
      created_at,
    }));

    const safePost = applyAnonymousAuthorDisplay({ ...post, liked, collected });
    res.json(ok({ post: safePost, comments, related, tbaoInsight }));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, content, college, post_type, is_anonymous: rawAnon } = req.body || {};
    if (!title || !stripHtml(content)) {
      return res.status(400).json(fail(400, '标题和内容不能为空'));
    }
    try {
      assertNoSensitive(`${title}\n${stripHtml(content)}`);
    } catch (e) {
      return res.status(400).json(fail(400, e.message));
    }
    const allowed = ['engineering', 'science', 'liberal', 'other'];
    if (!allowed.includes(college)) {
      return res.status(400).json(fail(400, '请选择学院分类'));
    }
    const pt = post_type === 'question' ? 'question' : 'article';
    const anon = rawAnon === true || rawAnon === 1 || rawAnon === '1' || rawAnon === 'true' ? 1 : 0;
    const safeTitle = sanitizePlainText(String(title)).slice(0, 200);
    const safeContent = sanitizeRichHtml(content);
    const [r] = await execute(
      'INSERT INTO posts (user_id, title, content, post_type, college, is_anonymous) VALUES (?,?,?,?,?,?)',
      [req.user.id, safeTitle, safeContent, pt, college, anon]
    );
    const id = r.insertId;
    if (pt === 'question') {
      ensureAiAnswer(id).catch(console.error);
    }
    res.json(ok({ id }));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await query('SELECT user_id FROM posts WHERE id = ?', [id]);
    if (!rows[0]) return res.status(404).json(fail(404, '不存在'));
    if (rows[0].user_id !== req.user.id) return res.status(403).json(fail(403, '无权限'));
    await query('DELETE FROM posts WHERE id = ?', [id]);
    res.json(ok(true));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.post('/:id/like', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const exists = await query(
      'SELECT 1 FROM post_likes WHERE user_id = ? AND post_id = ?',
      [req.user.id, id]
    );
    if (exists[0]) {
      await query('DELETE FROM post_likes WHERE user_id = ? AND post_id = ?', [req.user.id, id]);
    } else {
      await query('INSERT INTO post_likes (user_id, post_id) VALUES (?,?)', [req.user.id, id]);
    }
    const [{ c }] = await query('SELECT COUNT(*) AS c FROM post_likes WHERE post_id = ?', [id]);
    res.json(ok({ liked: !exists[0], likes_count: c }));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.post('/:id/collect', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const exists = await query(
      'SELECT 1 FROM post_collects WHERE user_id = ? AND post_id = ?',
      [req.user.id, id]
    );
    if (exists[0]) {
      await query('DELETE FROM post_collects WHERE user_id = ? AND post_id = ?', [req.user.id, id]);
    } else {
      await query('INSERT INTO post_collects (user_id, post_id) VALUES (?,?)', [req.user.id, id]);
    }
    const [{ c }] = await query('SELECT COUNT(*) AS c FROM post_collects WHERE post_id = ?', [id]);
    res.json(ok({ collected: !exists[0], collects_count: c }));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.post('/:id/comments', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { content, parent_comment_id, reply_to_user_id } = req.body || {};
    if (!content || !String(content).trim()) {
      return res.status(400).json(fail(400, '评论不能为空'));
    }
    try {
      assertNoSensitive(content);
    } catch (e) {
      return res.status(400).json(fail(400, e.message));
    }
    const safe = sanitizePlainText(String(content).trim());
    let parentId = Number(parent_comment_id) || null;
    let replyToUserId = Number(reply_to_user_id) || null;
    if (parentId) {
      const rows = await query('SELECT id, post_id, parent_comment_id, user_id FROM comments WHERE id = ?', [parentId]);
      const parent = rows[0];
      if (!parent || Number(parent.post_id) !== id) {
        return res.status(400).json(fail(400, '回复目标不存在'));
      }
      // 最多两级：若回复的是二级评论，挂到其一级父评论下
      if (parent.parent_comment_id) parentId = Number(parent.parent_comment_id);
      if (!replyToUserId) replyToUserId = Number(parent.user_id);
    } else {
      replyToUserId = null;
    }
    await query(
      'INSERT INTO comments (post_id, user_id, content, parent_comment_id, reply_to_user_id) VALUES (?,?,?,?,?)',
      [id, req.user.id, safe, parentId, replyToUserId]
    );
    const rows = await listCommentsForPost(id, req.user.id);
    res.json(ok(rows));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.post('/ai/rewrite', requireAuth, async (req, res) => {
  try {
    const { mode, title, content } = req.body || {};
    const m = String(mode || '').trim();
    if (!['format', 'summary', 'polish', 'experience'].includes(m)) {
      return res.status(400).json(fail(400, '无效的AI操作'));
    }
    const plain = stripHtml(content || '');
    if (!plain) return res.status(400).json(fail(400, '正文不能为空'));
    try {
      assertNoSensitive(`${title || ''}\n${plain}`);
    } catch (e) {
      return res.status(400).json(fail(400, e.message));
    }

    const map = {
      format:
        '请将以下内容进行一键排版：合理分段、补充小标题（最多3个），保持原意，不要杜撰。输出为纯文本，段落之间用换行分隔。',
      summary:
        '请将以下内容总结为一段精炼摘要（120~180字），保留关键信息与结论。输出纯文本。',
      polish:
        '请将以下内容润色为更自然、专业、易读的中文表达，保持原意和事实，不要增加虚构信息。输出纯文本。',
      experience:
        '请将以下求职经历整理为可直接发布的经验贴，严格按“背景-过程-经验”三段结构输出。每段前加对应小标题，语言真诚清晰，不要杜撰信息，输出纯文本。',
    };
    const reply = stripAssistantMarkdown(
      await deepseekChat(
        [
          { role: 'system', content: '你是求职社区内容助手，输出纯文本，不使用Markdown。' },
          {
            role: 'user',
            content: `${map[m]}\n\n标题：${String(title || '').slice(0, 120)}\n内容：${plain.slice(0, 5000)}`,
          },
        ],
        { temperature: 0.5 }
      )
    );
    res.json(ok({ content: reply }));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, 'AI处理失败'));
  }
});

router.delete('/comments/:cid', requireAuth, async (req, res) => {
  try {
    const cid = Number(req.params.cid);
    const rows = await query('SELECT user_id, parent_comment_id FROM comments WHERE id = ?', [cid]);
    if (!rows[0]) return res.status(404).json(fail(404, '不存在'));
    if (rows[0].user_id !== req.user.id) return res.status(403).json(fail(403, '无权限'));
    if (rows[0].parent_comment_id) {
      await query('DELETE FROM comments WHERE id = ?', [cid]);
    } else {
      // 删除一级评论时，同时删除它的二级回复，避免孤儿回复残留
      await query('DELETE FROM comments WHERE id = ? OR parent_comment_id = ?', [cid, cid]);
    }
    res.json(ok(true));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

async function ensureAiAnswer(postId) {
  const human = await query(
    'SELECT COUNT(*) AS c FROM answers WHERE post_id = ? AND is_ai = 0',
    [postId]
  );
  if (human[0].c > 0) return;
  const hasAi = await query('SELECT id FROM answers WHERE post_id = ? AND is_ai = 1 LIMIT 1', [postId]);
  if (hasAi[0]) return;
  const posts = await query('SELECT title, content FROM posts WHERE id = ?', [postId]);
  const p = posts[0];
  if (!p) return;
  let text = '';
  try {
    text = await deepseekChat(
      [
        {
          role: 'system',
          content:
            '你是 TalkWork 问答圈里的「T宝」。像真人朋友聊天那样用中文直接回应问题：语气自然温暖、略带口语，可以偶尔加一两个小表情（别刷屏）。不要用 Markdown：不要 # 标题、不要 ** 加粗、不要列表符号、不要代码块、不要 > 引用。用几段普通话说即可。回答大约 120~220 字，末尾不要自称。',
        },
        { role: 'user', content: `问题标题：${p.title}\n问题内容：${stripHtml(p.content).slice(0, 800)}` },
      ],
      { temperature: 0.5 }
    );
  } catch {
    text =
      '可以先从「动机—经历—能力」三段式来组织回答，再结合岗位关键词做一点点针对性补充，会更有说服力。加油，你已经在正确的路上啦。';
  }
  text = stripAssistantMarkdown(text);
  text += '\n\n—— 由T宝AI生成';
  const parts = String(text)
    .trim()
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const html = parts.length ? parts.map((para) => `<p>${sanitizePlainText(para)}</p>`).join('') : '<p></p>';
  await query('INSERT INTO answers (post_id, user_id, content, is_ai) VALUES (?,?,?,1)', [
    postId,
    null,
    html,
  ]);
}

export default router;
