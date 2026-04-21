import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { query, execute } from '../db.js';
import { ok, fail } from '../util/response.js';
import { requireAuth } from '../middleware/auth.js';
import { deepseekChat } from '../services/deepseek.js';
import { isAliyunSpeechConfigured, recognizeSpeech, synthesizeSpeech } from '../services/aliyunNls.js';

const router = Router();

const speechUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

router.get('/history', requireAuth, async (req, res) => {
  const rows = await query(
    `SELECT id, mode, job_title, score, created_at FROM interview_sessions
     WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`,
    [req.user.id]
  );
  res.json(ok(rows));
});

router.get('/speech/config', requireAuth, (_req, res) => {
  res.json(ok({ configured: isAliyunSpeechConfigured() }));
});

router.post('/speech/asr', requireAuth, speechUpload.single('audio'), async (req, res) => {
  try {
    if (!isAliyunSpeechConfigured()) {
      return res.status(400).json(fail(400, '未配置阿里云智能语音：请在 server/.env 配置 ALIYUN_ACCESS_KEY_ID、ALIYUN_ACCESS_KEY_SECRET、ALIYUN_NLS_APP_KEY'));
    }
    const buf = req.file?.buffer;
    if (!buf || !buf.length) {
      return res.status(400).json(fail(400, '请上传音频字段 audio（WAV，16kHz 单声道）'));
    }
    const out = await recognizeSpeech(buf);
    res.json(ok(out));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, e.message || '语音识别失败'));
  }
});

router.post('/speech/tts', requireAuth, async (req, res) => {
  try {
    if (!isAliyunSpeechConfigured()) {
      return res.status(400).json(fail(400, '未配置阿里云智能语音：请先配置 ALIYUN_ACCESS_KEY_ID、ALIYUN_ACCESS_KEY_SECRET、ALIYUN_NLS_APP_KEY'));
    }
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json(fail(400, '缺少 text'));
    const out = await synthesizeSpeech(text);
    res.setHeader('Content-Type', out.contentType);
    res.setHeader('Cache-Control', 'no-store');
    res.send(out.audio);
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, e.message || '语音合成失败'));
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  const rows = await query('SELECT * FROM interview_sessions WHERE id = ? AND user_id = ?', [
    req.params.id,
    req.user.id,
  ]);
  if (!rows[0]) return res.status(404).json(fail(404, '不存在'));
  const s = rows[0];
  s.questions_json = typeof s.questions_json === 'string' ? JSON.parse(s.questions_json || '[]') : s.questions_json;
  s.transcript_json =
    typeof s.transcript_json === 'string' ? JSON.parse(s.transcript_json || '[]') : s.transcript_json;
  let dims = s.dimensions_json;
  dims = typeof dims === 'string' ? JSON.parse(dims || '{}') : dims || {};
  s.dimensions_json = dims;
  s.review = dims.review || [];
  res.json(ok(s));
});

router.post('/start', requireAuth, async (req, res) => {
  try {
    const { mode, job_title, resume_text } = req.body || {};
    const m = ['beginner', 'pro', 'pressure'].includes(mode) ? mode : 'beginner';
    if (!job_title || !String(job_title).trim()) {
      return res.status(400).json(fail(400, '请填写目标岗位'));
    }
    const id = uuidv4();
    let questions = [
      '请用 1 分钟做自我介绍，并说明你为何适合这个岗位。',
      '请分享一段你最有成就感的项目经历，重点讲你的贡献与结果。',
      '遇到需求频繁变更时，你会如何协作与推进？',
      '你最近学到的一项新技能是什么？如何应用到工作中？',
      '你对未来 1~3 年的职业期待是什么？',
    ];
    try {
      const prompt = `你是面试官。岗位：${job_title}\n简历摘要：${String(resume_text || '').slice(0, 2000)}\n面试模式：${
        m === 'beginner' ? '小白引导' : m === 'pro' ? '标准追问' : '高压挑战'
      }\n请输出 8 个中文面试问题，每行一个，不要编号。`;
      const out = await deepseekChat([{ role: 'user', content: prompt }], { temperature: 0.35 });
      const lines = out
        .split('\n')
        .map((l) => l.replace(/^\d+[\).、\s]+/, '').trim())
        .filter(Boolean);
      if (lines.length >= 6) questions = lines.slice(0, 10);
    } catch {
      /* keep default */
    }

    await execute(
      `INSERT INTO interview_sessions (id, user_id, mode, job_title, resume_text, questions_json, total_questions, transcript_json)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        id,
        req.user.id,
        m,
        String(job_title).slice(0, 200),
        String(resume_text || '').slice(0, 8000),
        JSON.stringify(questions),
        questions.length,
        '[]',
      ]
    );
    res.json(ok({ id, questions }));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.put('/:id/transcript', requireAuth, async (req, res) => {
  try {
    const { transcript } = req.body || {};
    const rows = await query(
      'SELECT total_questions, questions_json FROM interview_sessions WHERE id = ? AND user_id = ? LIMIT 1',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json(fail(404, '不存在'));
    const s = rows[0];
    let total = Number(s.total_questions) || 0;
    if (!total) {
      const q = typeof s.questions_json === 'string' ? JSON.parse(s.questions_json || '[]') : s.questions_json || [];
      total = q.length || 0;
    }
    const safeTranscript = Array.isArray(transcript) ? transcript : [];
    await execute('UPDATE interview_sessions SET transcript_json = ? WHERE id = ? AND user_id = ?', [
      JSON.stringify(safeTranscript),
      req.params.id,
      req.user.id,
    ]);
    const answered = safeTranscript.length;
    res.json(ok({ done: total > 0 && answered >= total, answered, total }));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.post('/:id/finish', requireAuth, async (req, res) => {
  try {
    const rows = await query('SELECT * FROM interview_sessions WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    if (!rows[0]) return res.status(404).json(fail(404, '不存在'));
    const s = rows[0];
    const bodyTranscript = req.body?.transcript;
    let transcript =
      typeof s.transcript_json === 'string' ? JSON.parse(s.transcript_json || '[]') : s.transcript_json || [];
    if (Array.isArray(bodyTranscript)) transcript = bodyTranscript;

    let score = 78;
    let dimensions = { professional: 80, expression: 76, adaptability: 74 };
    let review = [];
    try {
      const prompt = `根据以下面试问答记录，输出 JSON：{"score":0-100,"dimensions":{"professional":0-100,"expression":0-100,"adaptability":0-100},"items":[{"q":"","user":"","comment":""}]}
岗位：${s.job_title}
记录：${JSON.stringify(transcript).slice(0, 6000)}`;
      const out = await deepseekChat([{ role: 'user', content: prompt }], { temperature: 0.3 });
      const m = out.match(/\{[\s\S]*\}/);
      const j = m ? JSON.parse(m[0]) : null;
      if (j) {
        score = Number(j.score) || score;
        dimensions = j.dimensions || dimensions;
        review = j.items || [];
      }
    } catch {
      review = [{ q: '综合', user: '—', comment: '复盘生成失败，可稍后在真实 AI 环境下重试。' }];
    }

    await execute(
      'UPDATE interview_sessions SET score = ?, dimensions_json = ? WHERE id = ? AND user_id = ?',
      [score, JSON.stringify({ ...dimensions, review }), req.params.id, req.user.id]
    );

    res.json(ok({ score, dimensions, review }));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

export default router;
