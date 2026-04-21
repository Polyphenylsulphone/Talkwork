import { Router } from 'express';
import path from 'path';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { query, execute } from '../db.js';
import { ok, fail } from '../util/response.js';
import { requireAuth } from '../middleware/auth.js';
import { deepseekChat } from '../services/deepseek.js';

const router = Router();
const resumeImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});
const SUPPORTED_RESUME_EXTS = new Set(['.pdf', '.docx']);
const SUPPORTED_RESUME_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const MAX_EXTRACT_TEXT_LEN = 12000;
const DEFAULT_RESUME_TEMPLATES = [
  {
    id: 'wps-minimal-clean',
    name: 'WPS-简约清晰版',
    desc: '白底黑字，细线分割，适合校招投递',
    tpl: 'simple',
    preset: 'minimal-clean',
  },
  {
    id: 'wps-minimal-sidebar',
    name: 'WPS-简约侧栏版',
    desc: '左侧信息栏，内容层级更清楚',
    tpl: 'simple',
    preset: 'minimal-sidebar',
  },
  {
    id: 'wps-business-pro',
    name: 'WPS-商务专业版',
    desc: '深蓝顶部信息带，正式稳重',
    tpl: 'business',
    preset: 'business-pro',
  },
  {
    id: 'wps-business-modern',
    name: 'WPS-商务现代版',
    desc: '灰蓝底纹 + 高对比标题，适合社招',
    tpl: 'business',
    preset: 'business-modern',
  },
  {
    id: 'wps-campus-fresh',
    name: 'WPS-校招清新版',
    desc: '浅色分区，信息密度适中',
    tpl: 'simple',
    preset: 'minimal-clean',
  },
  {
    id: 'wps-creative-lite',
    name: 'WPS-创意轻量版',
    desc: '适合设计/运营岗位，强调项目成果',
    tpl: 'simple',
    preset: 'minimal-sidebar',
  },
  {
    id: 'wps-ats-focus',
    name: 'WPS-ATS友好版',
    desc: '结构规整，便于系统解析',
    tpl: 'simple',
    preset: 'minimal-clean',
  },
  {
    id: 'wps-tech-pro',
    name: 'WPS-技术专业版',
    desc: '深色标题，突出技术栈与项目经历',
    tpl: 'business',
    preset: 'business-pro',
  },
  {
    id: 'wps-product-pro',
    name: 'WPS-产品经理版',
    desc: '重点展示项目闭环与指标成果',
    tpl: 'business',
    preset: 'business-modern',
  },
  {
    id: 'wps-finance-formal',
    name: 'WPS-金融正式版',
    desc: '沉稳配色，适合金融与咨询岗位',
    tpl: 'business',
    preset: 'business-pro',
  },
  {
    id: 'wps-overseas-lite',
    name: 'WPS-海外申请简版',
    desc: '双语场景友好，阅读节奏更清晰',
    tpl: 'simple',
    preset: 'minimal-clean',
  },
  {
    id: 'wps-exec-elite',
    name: 'WPS-高管精英版',
    desc: '强化管理经历与战略贡献展示',
    tpl: 'business',
    preset: 'business-modern',
  },
];

function normalizeTemplate(item, idx) {
  if (!item || typeof item !== 'object') return null;
  const id = String(item.id || `tpl-${idx + 1}`).trim().slice(0, 60);
  const name = String(item.name || '').trim().slice(0, 60);
  const desc = String(item.desc || '').trim().slice(0, 140);
  const tpl = item.tpl === 'business' ? 'business' : 'simple';
  const preset = String(item.preset || '').trim().slice(0, 40);
  if (!id || !name) return null;
  return { id, name, desc, tpl, preset };
}

function readResumeTemplatesConfig() {
  const raw = process.env.WPS_RESUME_TEMPLATES || '';
  if (!raw.trim()) return DEFAULT_RESUME_TEMPLATES;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_RESUME_TEMPLATES;
    const list = parsed.map((item, idx) => normalizeTemplate(item, idx)).filter(Boolean);
    return list.length ? list : DEFAULT_RESUME_TEMPLATES;
  } catch {
    return DEFAULT_RESUME_TEMPLATES;
  }
}

router.get('/templates', async (_req, res) => {
  try {
    res.json(ok(readResumeTemplatesConfig()));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const rows = await query(
      'SELECT id, title, template, created_at, updated_at FROM resumes WHERE user_id = ? ORDER BY updated_at DESC',
      [req.user.id]
    );
    res.json(ok(rows));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const rows = await query('SELECT * FROM resumes WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    if (!rows[0]) return res.status(404).json(fail(404, '未找到'));
    const r = rows[0];
    r.data_json = typeof r.data_json === 'string' ? JSON.parse(r.data_json) : r.data_json;
    res.json(ok(r));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, data_json, template } = req.body || {};
    const [r] = await execute(
      'INSERT INTO resumes (user_id, title, data_json, template) VALUES (?,?,?,?)',
      [
        req.user.id,
        String(title || '我的简历').slice(0, 120),
        JSON.stringify(data_json || {}),
        template === 'business' ? 'business' : 'simple',
      ]
    );
    res.json(ok({ id: r.insertId }));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { title, data_json, template } = req.body || {};
    const rows = await query('SELECT id FROM resumes WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    if (!rows[0]) return res.status(404).json(fail(404, '未找到'));
    await execute(
      'UPDATE resumes SET title = ?, data_json = ?, template = ? WHERE id = ? AND user_id = ?',
      [
        String(title || '我的简历').slice(0, 120),
        JSON.stringify(data_json || {}),
        template === 'business' ? 'business' : 'simple',
        req.params.id,
        req.user.id,
      ]
    );
    res.json(ok(true));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  await query('DELETE FROM resumes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json(ok(true));
});

router.post('/ai-fill', requireAuth, async (req, res) => {
  try {
    const { data_json } = req.body || {};
    const prompt = `你是中文简历顾问。根据以下 JSON 信息，输出优化后的完整 JSON（键保持一致），用更专业温暖的措辞补全各字段。只输出 JSON，不要解释。\n${JSON.stringify(
      data_json || {},
      null,
      2
    )}`;
    const out = await deepseekChat([{ role: 'user', content: prompt }], { temperature: 0.4 });
    let parsed = null;
    try {
      const m = out.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : null;
    } catch {
      parsed = null;
    }
    res.json(ok({ text: out, data_json: parsed }));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, 'AI 处理失败'));
  }
});

router.post('/ai-optimize', requireAuth, async (req, res) => {
  try {
    const { job_title, resume_text } = req.body || {};
    if (!job_title || !String(job_title).trim()) {
      return res.status(400).json(fail(400, '请填写目标岗位'));
    }
    if (!resume_text || !String(resume_text).trim()) {
      return res.status(400).json(fail(400, '请填写简历内容'));
    }
    const prompt = `你是中文简历优化顾问。请基于目标岗位和简历原文，输出“可逐条应用”的优化建议。

目标岗位：${job_title}
简历原文：
${String(resume_text).slice(0, 6000)}

要求：
1) 只输出 JSON，不要任何解释。
2) JSON 格式如下：
{
  "suggestions": [
    {
      "title": "建议标题（简短）",
      "question": "向用户提问：是否要这样改？",
      "reason": "为什么要改（1句话）",
      "original_text": "原简历中需要替换的原文片段",
      "rewritten_text": "建议替换后的文本"
    }
  ],
  "optimized_text": "把所有建议都应用后的完整简历文本"
}
3) 至少给 3 条建议，最多 6 条。
4) 若无法精确定位 original_text，请尽量截取有代表性的原文短句。`;
    const out = await deepseekChat([{ role: 'user', content: prompt }], { temperature: 0.45 });
    let parsed = null;
    try {
      const m = out.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : null;
    } catch {
      parsed = null;
    }
    const suggestions = Array.isArray(parsed?.suggestions)
      ? parsed.suggestions
          .slice(0, 6)
          .map((item) => ({
            title: String(item?.title || '').trim().slice(0, 80),
            question: String(item?.question || '').trim().slice(0, 200),
            reason: String(item?.reason || '').trim().slice(0, 280),
            original_text: String(item?.original_text || '').trim().slice(0, 1200),
            rewritten_text: String(item?.rewritten_text || '').trim().slice(0, 1400),
          }))
          .filter((item) => item.rewritten_text)
      : [];
    const optimizedText = String(parsed?.optimized_text || '').trim().slice(0, 12000);
    res.json(ok({ suggestions, optimized_text: optimizedText, raw_text: out }));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, 'AI 处理失败'));
  }
});

router.post('/extract-text', requireAuth, (req, res) => {
  resumeImportUpload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json(fail(400, err.message || '文件上传失败'));
    try {
      const file = req.file;
      if (!file) return res.status(400).json(fail(400, '未选择文件'));
      const ext = path.extname(file.originalname || '').toLowerCase();
      const mime = String(file.mimetype || '').toLowerCase();
      if (!SUPPORTED_RESUME_EXTS.has(ext) && !SUPPORTED_RESUME_MIMES.has(mime)) {
        return res.status(400).json(fail(400, '仅支持 .docx 或 .pdf 文件'));
      }
      let text = '';
      if (ext === '.pdf' || mime === 'application/pdf') {
        const parser = new PDFParse({ data: file.buffer });
        try {
          const parsed = await parser.getText();
          text = String(parsed?.text || '');
        } finally {
          await parser.destroy?.();
        }
      } else {
        const parsed = await mammoth.extractRawText({ buffer: file.buffer });
        text = String(parsed?.value || '');
      }
      const normalized = text.replace(/\u0000/g, '').replace(/\r\n/g, '\n').trim();
      if (!normalized) return res.status(400).json(fail(400, '未提取到可用文字，请检查文件内容'));
      res.json(ok({ text: normalized.slice(0, MAX_EXTRACT_TEXT_LEN), file_name: file.originalname }));
    } catch (e) {
      console.error(e);
      res.status(500).json(fail(500, '简历解析失败，请稍后重试'));
    }
  });
});

export default router;
