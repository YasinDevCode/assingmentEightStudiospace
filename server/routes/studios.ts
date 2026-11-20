import { Router } from 'express';
import type { Response } from 'express';
import crypto from 'crypto';
import db, { serializeStudio } from '../db.ts';
import type { StudioRow } from '../db.ts';
import { requireAuth } from '../auth.ts';
import type { AuthenticatedRequest } from '../auth.ts';

const router = Router();

const SORT_CLAUSES: Record<string, string> = {
  newest: 'ORDER BY createdAt DESC',
  price_asc: 'ORDER BY hourlyRate ASC',
  price_desc: 'ORDER BY hourlyRate DESC',
  rating: 'ORDER BY rating DESC, reviewCount DESC',
};

function sanitizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

router.get('/', (req, res) => {
  const { category, search, minRate, maxRate, sort, limit, ownerEmail } = req.query;
  const filters: string[] = [];
  const params: unknown[] = [];

  if (typeof category === 'string' && category && category !== 'All') {
    filters.push('category = ?');
    params.push(category);
  }
  if (typeof ownerEmail === 'string' && ownerEmail) {
    filters.push('LOWER(ownerEmail) = LOWER(?)');
    params.push(ownerEmail);
  }
  if (typeof search === 'string' && search.trim()) {
    const query = `%${search.trim().toLowerCase()}%`;
    filters.push(
      '(LOWER(title) LIKE ? OR LOWER(location) LIKE ? OR LOWER(category) LIKE ? OR LOWER(overview) LIKE ? OR LOWER(amenities) LIKE ?)'
    );
    params.push(query, query, query, query, query);
  }
  if (typeof minRate === 'string' && minRate !== '' && !Number.isNaN(Number(minRate))) {
    filters.push('hourlyRate >= ?');
    params.push(Number(minRate));
  }
  if (typeof maxRate === 'string' && maxRate !== '' && !Number.isNaN(Number(maxRate))) {
    filters.push('hourlyRate <= ?');
    params.push(Number(maxRate));
  }

  const whereSql = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const orderSql =
    (typeof sort === 'string' && SORT_CLAUSES[sort]) || 'ORDER BY rating DESC, createdAt DESC';

  const parsedLimit = typeof limit === 'string' ? Number(limit) : NaN;
  const limitSql =
    Number.isInteger(parsedLimit) && parsedLimit > 0 ? `LIMIT ${Math.min(parsedLimit, 50)}` : '';

  const rows = db
    .prepare(`SELECT * FROM studios ${whereSql} ${orderSql} ${limitSql}`)
    .all(...params) as StudioRow[];

  res.json({ studios: rows.map(serializeStudio) });
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM studios WHERE id = ?').get(req.params.id) as
    | StudioRow
    | undefined;

  if (!row) {
    res.status(404).json({ error: 'Studio workspace not found.' });
    return;
  }

  const reviews = db
    .prepare('SELECT * FROM reviews WHERE studioId = ? ORDER BY createdAt DESC')
    .all(req.params.id);

  const confirmedBookings = db
    .prepare(
      `SELECT bookingDate, startHour, endHour FROM bookings
       WHERE studioId = ? AND status = 'Confirmed'
       ORDER BY bookingDate ASC, startHour ASC`
    )
    .all(req.params.id);

  res.json({ studio: serializeStudio(row), reviews, confirmedBookings });
});

router.get('/:id/availability', (req, res) => {
  const { date } = req.query;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: 'A valid YYYY-MM-DD date parameter is required.' });
    return;
  }

  const confirmedSlots = db
    .prepare(
      `SELECT id, startHour, endHour, status FROM bookings
       WHERE studioId = ? AND bookingDate = ? AND status = 'Confirmed'
       ORDER BY startHour ASC`
    )
    .all(req.params.id, date);

  res.json({ date, confirmedSlots });
});

router.post('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const body = req.body ?? {};
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const location = typeof body.location === 'string' ? body.location.trim() : '';
  const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';
  const overview = typeof body.overview === 'string' ? body.overview.trim() : '';

  if (!title || !category || !location || !imageUrl || !overview) {
    res.status(400).json({ error: 'Please complete all required studio listing fields.' });
    return;
  }

  const hourlyRate = Number(body.hourlyRate);
  const securityDeposit = Number(body.securityDeposit ?? 0);
  const maxCapacity = Number(body.maxCapacity);
  const sqft = Number(body.sqft ?? 1400);

  if (Number.isNaN(hourlyRate) || hourlyRate <= 0) {
    res.status(400).json({ error: 'Hourly rate must be greater than $0.' });
    return;
  }
  if (Number.isNaN(securityDeposit) || securityDeposit < 0) {
    res.status(400).json({ error: 'Security deposit cannot be negative.' });
    return;
  }
  if (Number.isNaN(maxCapacity) || maxCapacity < 1) {
    res.status(400).json({ error: 'Maximum capacity must be at least 1 person.' });
    return;
  }

  const gallery = sanitizeStringList(body.gallery);
  if (!gallery.includes(imageUrl)) {
    gallery.unshift(imageUrl);
  }
  const amenities = sanitizeStringList(body.amenities);
  const ceilingHeight =
    typeof body.ceilingHeight === 'string' && body.ceilingHeight.trim()
      ? body.ceilingHeight.trim()
      : '14 ft';

  const id = `std_${crypto.randomUUID().slice(0, 12)}`;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO studios (
      id, title, category, hourlyRate, securityDeposit, maxCapacity, location,
      imageUrl, gallery, amenities, overview, rating, reviewCount, sqft,
      ceilingHeight, ownerEmail, ownerName, ownerPhoto, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    title,
    category,
    hourlyRate,
    securityDeposit,
    maxCapacity,
    location,
    imageUrl,
    JSON.stringify(gallery),
    JSON.stringify(amenities),
    overview,
    5.0,
    0,
    Number.isNaN(sqft) || sqft < 100 ? 1400 : sqft,
    ceilingHeight,
    req.user!.email,
    req.user!.name,
    req.user!.photoUrl || '',
    now,
    now
  );

  const created = db.prepare('SELECT * FROM studios WHERE id = ?').get(id) as StudioRow;
  res.status(201).json({ studio: serializeStudio(created) });
});

function updateStudioHandler(req: AuthenticatedRequest, res: Response) {
  const existing = db.prepare('SELECT * FROM studios WHERE id = ?').get(req.params.id) as
    | StudioRow
    | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Studio listing not found.' });
    return;
  }
  if (existing.ownerEmail.toLowerCase() !== req.user!.email.toLowerCase()) {
    res.status(403).json({ error: 'Forbidden: Only the studio owner can edit this listing.' });
    return;
  }

  const body = req.body ?? {};
  const nextTitle = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : existing.title;
  const nextCategory =
    typeof body.category === 'string' && body.category.trim() ? body.category.trim() : existing.category;
  const nextRate = body.hourlyRate !== undefined ? Number(body.hourlyRate) : existing.hourlyRate;
  const nextDeposit =
    body.securityDeposit !== undefined ? Number(body.securityDeposit) : existing.securityDeposit;
  const nextCapacity =
    body.maxCapacity !== undefined ? Number(body.maxCapacity) : existing.maxCapacity;
  const nextLocation =
    typeof body.location === 'string' && body.location.trim() ? body.location.trim() : existing.location;
  const nextImage =
    typeof body.imageUrl === 'string' && body.imageUrl.trim() ? body.imageUrl.trim() : existing.imageUrl;
  const nextOverview =
    typeof body.overview === 'string' && body.overview.trim() ? body.overview.trim() : existing.overview;
  const nextSqft =
    body.sqft !== undefined && !Number.isNaN(Number(body.sqft)) ? Number(body.sqft) : existing.sqft;
  const nextCeiling =
    typeof body.ceilingHeight === 'string' && body.ceilingHeight.trim()
      ? body.ceilingHeight.trim()
      : existing.ceilingHeight;

  if (Number.isNaN(nextRate) || nextRate <= 0) {
    res.status(400).json({ error: 'Hourly rate must be greater than $0.' });
    return;
  }

  let nextGallery = existing.gallery;
  if (Array.isArray(body.gallery)) {
    const cleaned = sanitizeStringList(body.gallery);
    if (!cleaned.includes(nextImage)) cleaned.unshift(nextImage);
    nextGallery = JSON.stringify(cleaned);
  } else if (nextImage !== existing.imageUrl) {
    const rest = serializeStudio(existing).gallery.filter((url) => url !== existing.imageUrl);
    nextGallery = JSON.stringify([nextImage, ...rest]);
  }

  const nextAmenities = Array.isArray(body.amenities)
    ? JSON.stringify(sanitizeStringList(body.amenities))
    : existing.amenities;

  db.prepare(
    `UPDATE studios
     SET title = ?, category = ?, hourlyRate = ?, securityDeposit = ?, maxCapacity = ?,
         location = ?, imageUrl = ?, gallery = ?, amenities = ?, overview = ?,
         sqft = ?, ceilingHeight = ?, updatedAt = ?
     WHERE id = ?`
  ).run(
    nextTitle,
    nextCategory,
    nextRate,
    nextDeposit,
    nextCapacity,
    nextLocation,
    nextImage,
    nextGallery,
    nextAmenities,
    nextOverview,
    nextSqft,
    nextCeiling,
    new Date().toISOString(),
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM studios WHERE id = ?').get(req.params.id) as StudioRow;
  res.json({ studio: serializeStudio(updated) });
}

router.put('/:id', requireAuth, updateStudioHandler);
router.patch('/:id', requireAuth, updateStudioHandler);

router.delete('/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const existing = db.prepare('SELECT * FROM studios WHERE id = ?').get(req.params.id) as
    | StudioRow
    | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Studio listing not found.' });
    return;
  }
  if (existing.ownerEmail.toLowerCase() !== req.user!.email.toLowerCase()) {
    res.status(403).json({ error: 'Forbidden: You can only delete your own studio listings.' });
    return;
  }

  db.prepare('DELETE FROM studios WHERE id = ?').run(req.params.id);
  res.json({ message: 'Studio listing deleted successfully.', id: req.params.id });
});

router.post('/:id/reviews', requireAuth, (req: AuthenticatedRequest, res) => {
  const studio = db.prepare('SELECT id FROM studios WHERE id = ?').get(req.params.id);
  if (!studio) {
    res.status(404).json({ error: 'Studio not found.' });
    return;
  }

  const rating = Number(req.body?.rating);
  const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';

  if (Number.isNaN(rating) || rating < 1 || rating > 5) {
    res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    return;
  }
  if (comment.length < 10) {
    res.status(400).json({ error: 'Please write at least 10 characters in your review.' });
    return;
  }

  const id = `rev_${crypto.randomUUID().slice(0, 10)}`;
  const createdAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO reviews (id, studioId, userEmail, userName, userPhoto, rating, comment, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    req.params.id,
    req.user!.email,
    req.user!.name,
    req.user!.photoUrl || '',
    rating,
    comment,
    createdAt
  );

  const stats = db
    .prepare('SELECT AVG(rating) as avgRating, COUNT(*) as count FROM reviews WHERE studioId = ?')
    .get(req.params.id) as { avgRating: number; count: number };

  const roundedRating = Number(stats.avgRating.toFixed(2));
  db.prepare('UPDATE studios SET rating = ?, reviewCount = ? WHERE id = ?').run(
    roundedRating,
    stats.count,
    req.params.id
  );

  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id);
  res.status(201).json({ review, rating: roundedRating, reviewCount: stats.count });
});

export default router;
