import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import db, { serializeStudio } from '../db.ts';
import type { StudioRow } from '../db.ts';
import { requireAuth } from '../auth.ts';
import type { AuthenticatedRequest } from '../auth.ts';

const router = Router();
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype in MIME_EXTENSIONS) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, WebP, and GIF images are supported.'));
    }
  },
});

router.post('/upload', requireAuth, upload.single('image'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Please select an image file to upload.' });
      return;
    }

    const imgbbKey = process.env.IMGBB_API_KEY?.trim();
    if (imgbbKey) {
      try {
        const body = new URLSearchParams({ image: req.file.buffer.toString('base64') });
        const imgbbRes = await fetch(
          `https://api.imgbb.com/1/upload?key=${encodeURIComponent(imgbbKey)}`,
          { method: 'POST', body }
        );
        if (imgbbRes.ok) {
          const data = (await imgbbRes.json()) as { data?: { url?: string } };
          if (data?.data?.url) {
            res.json({ url: data.data.url, provider: 'imgbb' });
            return;
          }
        }
      } catch {
        // Fall through to local disk hosting when external host is unavailable.
      }
    }

    const ext = MIME_EXTENSIONS[req.file.mimetype] || '.jpg';
    const filename = `studio_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), req.file.buffer);
    res.json({ url: `/uploads/${filename}`, provider: 'local' });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Failed to upload image.',
    });
  }
});

router.get('/wishlist', requireAuth, (req: AuthenticatedRequest, res) => {
  const email = req.user!.email.toLowerCase();
  const rows = db
    .prepare(
      `SELECT s.* FROM studios s
       INNER JOIN wishlists w ON w.studioId = s.id
       WHERE LOWER(w.userEmail) = ?
       ORDER BY w.createdAt DESC`
    )
    .all(email) as StudioRow[];

  const studios = rows.map(serializeStudio);
  res.json({ studioIds: studios.map((s) => s.id), studios });
});

router.post('/wishlist/toggle', requireAuth, (req: AuthenticatedRequest, res) => {
  const { studioId } = req.body ?? {};
  if (typeof studioId !== 'string' || !studioId) {
    res.status(400).json({ error: 'Studio ID is required.' });
    return;
  }

  const studioExists = db.prepare('SELECT id FROM studios WHERE id = ?').get(studioId);
  if (!studioExists) {
    res.status(404).json({ error: 'Studio not found.' });
    return;
  }

  const email = req.user!.email.toLowerCase();
  const existing = db
    .prepare('SELECT id FROM wishlists WHERE LOWER(userEmail) = ? AND studioId = ?')
    .get(email, studioId) as { id: string } | undefined;

  if (existing) {
    db.prepare('DELETE FROM wishlists WHERE id = ?').run(existing.id);
    res.json({ studioId, saved: false });
    return;
  }

  db.prepare('INSERT INTO wishlists (id, userEmail, studioId, createdAt) VALUES (?, ?, ?, ?)').run(
    crypto.randomUUID(),
    email,
    studioId,
    new Date().toISOString()
  );
  res.json({ studioId, saved: true });
});

router.post('/newsletter', (req, res) => {
  const rawEmail = req.body?.email;
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }

  const existing = db
    .prepare('SELECT id FROM newsletter_subscribers WHERE email = ?')
    .get(email);
  if (existing) {
    res.json({ message: 'You are already subscribed to StudioSpace dispatches.' });
    return;
  }

  db.prepare('INSERT INTO newsletter_subscribers (id, email, createdAt) VALUES (?, ?, ?)').run(
    crypto.randomUUID(),
    email,
    new Date().toISOString()
  );

  res.status(201).json({ message: 'Subscribed! Expect curated studio openings every Thursday.' });
});

export default router;
