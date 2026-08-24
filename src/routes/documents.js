const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');
const config = require('../config');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
const MAX_SIZE_BYTES = (config.uploads?.maxSizeMB || 50) * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

const upload = multer({ storage, limits: { fileSize: MAX_SIZE_BYTES } });

function toDto(d) {
  return {
    id: d.id,
    originalName: d.original_name,
    mimeType: d.mime_type,
    size: d.size,
    uploaderId: d.uploader_id,
    uploaderName: d.uploader_first_name ? `${d.uploader_first_name} ${d.uploader_last_name}` : undefined,
    recipientId: d.recipient_id,
    recipientName: d.recipient_first_name ? `${d.recipient_first_name} ${d.recipient_last_name}` : undefined,
    uploadedAt: d.uploaded_at,
  };
}

const LIST_QUERY = `
  SELECT d.*, up.first_name AS uploader_first_name, up.last_name AS uploader_last_name,
         rc.first_name AS recipient_first_name, rc.last_name AS recipient_last_name
  FROM documents d
  JOIN users up ON up.id = d.uploader_id
  LEFT JOIN users rc ON rc.id = d.recipient_id
`;

// Документы, доступные пользователю: адресованные лично ему, "всем сотрудникам",
// загруженные им самим, либо (для администратора) — все документы.
router.get('/', requireAuth, (req, res) => {
  let rows;
  if (req.user.role === 'admin') {
    rows = db.prepare(`${LIST_QUERY} ORDER BY d.uploaded_at DESC`).all();
  } else {
    rows = db
      .prepare(
        `${LIST_QUERY}
         WHERE d.recipient_id = ? OR d.recipient_id IS NULL OR d.uploader_id = ?
         ORDER BY d.uploaded_at DESC`
      )
      .all(req.user.id, req.user.id);
  }
  res.json(rows.map(toDto));
});

router.post('/', requireAuth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res
        .status(413)
        .json({ error: `Файл превышает допустимый размер (${config.uploads?.maxSizeMB || 50} МБ)` });
    }
    if (err) return res.status(400).json({ error: 'Не удалось загрузить файл' });
    if (!req.file) return res.status(400).json({ error: 'Файл не передан' });

    let recipientId = req.body.recipientId ? Number(req.body.recipientId) : null;
    if (recipientId) {
      const recipient = db.prepare('SELECT id FROM users WHERE id = ? AND is_active = 1').get(recipientId);
      if (!recipient) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: 'Получатель не найден' });
      }
    }

    const info = db
      .prepare(
        `INSERT INTO documents (stored_name, original_name, mime_type, size, uploader_id, recipient_id)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        req.file.filename,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        req.user.id,
        recipientId
      );

    const row = db.prepare(`${LIST_QUERY} WHERE d.id = ?`).get(info.lastInsertRowid);
    res.status(201).json(toDto(row));
  });
});

router.get('/:id/download', requireAuth, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Документ не найден' });

  const hasAccess =
    req.user.role === 'admin' ||
    doc.uploader_id === req.user.id ||
    doc.recipient_id === null ||
    doc.recipient_id === req.user.id;
  if (!hasAccess) return res.status(403).json({ error: 'Нет доступа к документу' });

  const filePath = path.join(UPLOAD_DIR, doc.stored_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Файл отсутствует на сервере' });

  res.download(filePath, doc.original_name);
});

module.exports = router;
