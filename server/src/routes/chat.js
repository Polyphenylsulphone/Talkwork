import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, execute } from '../db.js';
import { ok, fail } from '../util/response.js';
import { requireAuth } from '../middleware/auth.js';
import { deepseekChat } from '../services/deepseek.js';
import { stripAssistantMarkdown } from '../util/plainText.js';
import { assertNoSensitive } from '../util/sensitive.js';

const router = Router();

const SYSTEM = `你是 TalkWork 的「T宝」，专业求职导师，语气亲切温柔，擅长简历、面试与职业规划。
回答用纯中文口语段落表达，禁止使用 Markdown：不要使用 ** 粗体、不要使用 # 标题、不要使用 \`\`\` 代码块、不要使用项目符号列表堆砌。
需要换行时只用普通换行。回答简洁并给出可执行的行动建议。`;
const MAX_ATTACHMENTS = 3;
const MAX_IMAGE_BASE64_LEN = 2_000_000;
const MAX_PDF_TEXT_LEN = 12_000;

function normalizeAttachments(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, MAX_ATTACHMENTS)
    .map((a) => ({
      type: String(a?.type || ''),
      name: String(a?.name || '').slice(0, 80),
      data_base64: String(a?.data_base64 || ''),
      text: String(a?.text || ''),
    }))
    .filter((a) => a.type === 'image' || a.type === 'pdf');
}

function buildPromptContent(text, attachments) {
  if (!attachments.length) return text;
  const parts = [`用户问题：${text}`];
  for (const att of attachments) {
    if (att.type === 'image') {
      if (!att.data_base64 || att.data_base64.length > MAX_IMAGE_BASE64_LEN) continue;
      parts.push(`附件图片（${att.name || 'image'}，base64）：${att.data_base64}`);
      continue;
    }
    if (att.type === 'pdf') {
      const safeText = att.text.slice(0, MAX_PDF_TEXT_LEN);
      if (!safeText) continue;
      parts.push(`附件PDF（${att.name || 'pdf'}）提取文字：\n${safeText}`);
    }
  }
  parts.push('请结合用户输入与附件内容回答。若附件信息不足，请明确指出并给出下一步建议。');
  return parts.join('\n\n');
}

router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const rows = await query(
      'SELECT id, title, is_pinned, created_at, updated_at FROM chat_sessions WHERE user_id = ? ORDER BY is_pinned DESC, updated_at DESC LIMIT 100',
      [req.user.id]
    );
    res.json(ok(rows));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.post('/sessions', requireAuth, async (req, res) => {
  try {
    const id = uuidv4();
    await execute('INSERT INTO chat_sessions (id, user_id, title) VALUES (?,?,?)', [
      id,
      req.user.id,
      '新对话',
    ]);
    res.json(ok({ id }));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.patch('/sessions/:id', requireAuth, async (req, res) => {
  try {
    const sid = req.params.id;
    const own = await query('SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?', [sid, req.user.id]);
    if (!own[0]) return res.status(404).json(fail(404, '会话不存在'));
    const { title, is_pinned } = req.body || {};
    if (title != null) {
      const t = String(title).trim().slice(0, 80);
      if (!t) return res.status(400).json(fail(400, '标题不能为空'));
      await execute('UPDATE chat_sessions SET title = ? WHERE id = ?', [t, sid]);
    }
    if (is_pinned != null) {
      await execute('UPDATE chat_sessions SET is_pinned = ? WHERE id = ?', [is_pinned ? 1 : 0, sid]);
    }
    const rows = await query(
      'SELECT id, title, is_pinned, created_at, updated_at FROM chat_sessions WHERE id = ? AND user_id = ? LIMIT 1',
      [sid, req.user.id]
    );
    res.json(ok(rows[0]));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.delete('/sessions/:id', requireAuth, async (req, res) => {
  await query('DELETE FROM chat_sessions WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json(ok(true));
});

router.get('/sessions/:id/messages', requireAuth, async (req, res) => {
  try {
    const rows = await query(
      'SELECT id, role, content, created_at FROM chat_messages WHERE session_id = ? ORDER BY id ASC',
      [req.params.id]
    );
    res.json(ok(rows));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.post('/sessions/:id/messages', requireAuth, async (req, res) => {
  try {
    const sid = req.params.id;
    const own = await query('SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?', [
      sid,
      req.user.id,
    ]);
    if (!own[0]) return res.status(404).json(fail(404, '会话不存在'));

    const { content, attachments } = req.body || {};
    if (!content || !String(content).trim()) {
      return res.status(400).json(fail(400, '内容为空'));
    }
    try {
      assertNoSensitive(content);
    } catch (e) {
      return res.status(400).json(fail(400, e.message));
    }
    const text = String(content).trim();
    const files = normalizeAttachments(attachments);
    for (const f of files) {
      if (f.type === 'pdf' && f.text) assertNoSensitive(f.text.slice(0, 2000));
    }
    await execute('INSERT INTO chat_messages (session_id, role, content) VALUES (?,?,?)', [
      sid,
      'user',
      files.length ? `${text}\n[附件 ${files.length} 个]` : text,
    ]);

    const hist = await query(
      'SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY id ASC LIMIT 40',
      [sid]
    );
    const baseMessages = hist.map((m) => ({ role: m.role, content: m.content }));
    const latestUserIdx = (() => {
      for (let i = baseMessages.length - 1; i >= 0; i -= 1) {
        if (baseMessages[i].role === 'user') return i;
      }
      return -1;
    })();
    if (latestUserIdx >= 0) {
      baseMessages[latestUserIdx] = {
        ...baseMessages[latestUserIdx],
        content: buildPromptContent(text, files),
      };
    }
    const messages = [{ role: 'system', content: SYSTEM }, ...baseMessages];

    const reply = stripAssistantMarkdown(await deepseekChat(messages, { temperature: 0.6 }));
    await execute('INSERT INTO chat_messages (session_id, role, content) VALUES (?,?,?)', [
      sid,
      'assistant',
      reply,
    ]);

    const titleRow = await query('SELECT title FROM chat_sessions WHERE id = ?', [sid]);
    if (titleRow[0]?.title === '新对话') {
      await execute('UPDATE chat_sessions SET title = ? WHERE id = ?', [text.slice(0, 40), sid]);
    } else {
      await execute('UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [sid]);
    }

    const rows = await query(
      'SELECT id, role, content, created_at FROM chat_messages WHERE session_id = ? ORDER BY id ASC',
      [sid]
    );
    res.json(ok(rows));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.post('/messages/:mid/favorite', requireAuth, async (req, res) => {
  try {
    const mid = Number(req.params.mid);
    const msg = await query(
      `SELECT m.id FROM chat_messages m JOIN chat_sessions s ON s.id = m.session_id
       WHERE m.id = ? AND s.user_id = ? AND m.role = 'assistant'`,
      [mid, req.user.id]
    );
    if (!msg[0]) return res.status(404).json(fail(404, '消息不存在'));
    const ex = await query('SELECT id FROM chat_favorites WHERE user_id = ? AND message_id = ?', [
      req.user.id,
      mid,
    ]);
    if (ex[0]) {
      await query('DELETE FROM chat_favorites WHERE user_id = ? AND message_id = ?', [req.user.id, mid]);
      return res.json(ok({ favorited: false }));
    }
    await execute('INSERT INTO chat_favorites (user_id, message_id) VALUES (?,?)', [req.user.id, mid]);
    res.json(ok({ favorited: true }));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.get('/favorites', requireAuth, async (req, res) => {
  try {
    const rows = await query(
      `SELECT m.id, m.content, m.created_at, s.id AS session_id, s.title
       FROM chat_favorites f
       JOIN chat_messages m ON m.id = f.message_id
       JOIN chat_sessions s ON s.id = m.session_id
       WHERE f.user_id = ? ORDER BY f.created_at DESC`,
      [req.user.id]
    );
    res.json(ok(rows));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.post('/stream', requireAuth, async (req, res) => {
  try {
    const { session_id, content, attachments } = req.body || {};
    if (!session_id || !content) return res.status(400).json(fail(400, '参数不完整'));
    try {
      assertNoSensitive(content);
    } catch (e) {
      return res.status(400).json(fail(400, e.message));
    }
    const own = await query('SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?', [
      session_id,
      req.user.id,
    ]);
    if (!own[0]) return res.status(404).json(fail(404, '会话不存在'));

    const text = String(content).trim();
    const files = normalizeAttachments(attachments);
    for (const f of files) {
      if (f.type === 'pdf' && f.text) assertNoSensitive(f.text.slice(0, 2000));
    }
    await execute('INSERT INTO chat_messages (session_id, role, content) VALUES (?,?,?)', [
      session_id,
      'user',
      files.length ? `${text}\n[附件 ${files.length} 个]` : text,
    ]);

    const hist = await query(
      'SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY id ASC LIMIT 40',
      [session_id]
    );
    const baseMessages = hist.map((m) => ({ role: m.role, content: m.content }));
    const latestUserIdx = (() => {
      for (let i = baseMessages.length - 1; i >= 0; i -= 1) {
        if (baseMessages[i].role === 'user') return i;
      }
      return -1;
    })();
    if (latestUserIdx >= 0) {
      baseMessages[latestUserIdx] = {
        ...baseMessages[latestUserIdx],
        content: buildPromptContent(text, files),
      };
    }
    const messages = [{ role: 'system', content: SYSTEM }, ...baseMessages];

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const streamIt = await deepseekChat(messages, { stream: true, temperature: 0.55 });
    let full = '';
    if (typeof streamIt === 'string') {
      full = stripAssistantMarkdown(streamIt);
      res.write(`data: ${JSON.stringify({ delta: full })}\n\n`);
    } else {
      for await (const delta of streamIt) {
        full += delta;
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
      full = stripAssistantMarkdown(full);
    }

    await execute('INSERT INTO chat_messages (session_id, role, content) VALUES (?,?,?)', [
      session_id,
      'assistant',
      full,
    ]);
    const titleRow = await query('SELECT title FROM chat_sessions WHERE id = ?', [session_id]);
    if (titleRow[0]?.title === '新对话') {
      await execute('UPDATE chat_sessions SET title = ? WHERE id = ?', [text.slice(0, 40), session_id]);
    } else {
      await execute('UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [session_id]);
    }

    const rows = await query(
      'SELECT id, role, content, created_at FROM chat_messages WHERE session_id = ? ORDER BY id ASC',
      [session_id]
    );
    res.write(`data: ${JSON.stringify({ done: true, messages: rows })}\n\n`);
    res.end();
  } catch (e) {
    console.error(e);
    try {
      res.write(`data: ${JSON.stringify({ error: 'stream failed' })}\n\n`);
      res.end();
    } catch {
      /* ignore */
    }
  }
});

export default router;
