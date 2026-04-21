import { Router } from 'express';
import { execute } from '../db.js';
import { ok, fail } from '../util/response.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/', requireAuth, async (req, res) => {
  try {
    const targetType = String(req.body?.target_type || '').trim();
    const targetId = Number(req.body?.target_id);
    const reason = String(req.body?.reason || '').trim().slice(0, 120);
    const details = String(req.body?.details || '').trim().slice(0, 1000);
    if (!['post', 'comment'].includes(targetType)) {
      return res.status(400).json(fail(400, '无效举报类型'));
    }
    if (!targetId || !Number.isFinite(targetId)) {
      return res.status(400).json(fail(400, '无效举报目标'));
    }
    if (!reason) return res.status(400).json(fail(400, '请填写举报原因'));
    await execute(
      `INSERT INTO content_reports (reporter_id, target_type, target_id, reason, details)
       VALUES (?,?,?,?,?)`,
      [req.user.id, targetType, targetId, reason, details]
    );
    res.json(ok(true));
  } catch (e) {
    console.error(e);
    res.status(500).json(fail(500, '提交举报失败'));
  }
});

export default router;
