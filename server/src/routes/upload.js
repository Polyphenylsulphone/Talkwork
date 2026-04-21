import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { nanoid } from 'nanoid';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { requireAuth } from '../middleware/auth.js';
import { ok, fail } from '../util/response.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `${nanoid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) return cb(new Error('仅支持图片'));
    cb(null, true);
  },
});

const router = Router();

router.post('/image', requireAuth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json(fail(400, err.message || '上传失败'));
    }
    if (!req.file) return res.status(400).json(fail(400, '未选择文件'));
    const url = `/uploads/${req.file.filename}`;
    res.json(ok({ url }));
  });
});

export default router;
