import { Router } from 'express';
import crypto from 'crypto';
import db from '../db.ts';
import type { StudioRow } from '../db.ts';
import { requireAuth } from '../auth.ts';
import type { AuthenticatedRequest } from '../auth.ts';
import { findConfirmedOverlap, formatHourLabel } from '../utils/helpers.ts';

const router = Router();
const VALID_STATUSES = new Set(['Pending', 'Confirmed', 'Completed', 'Cancelled']);

router.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const email = req.user!.email.toLowerCase();
  const myBookings = db
    .prepare('SELECT * FROM bookings WHERE LOWER(userEmail) = ? ORDER BY createdAt DESC')
    .all(email);
  const hostBookings = db
    .prepare('SELECT * FROM bookings WHERE LOWER(hostEmail) = ? ORDER BY createdAt DESC')
    .all(email);

  res.json({ myBookings, hostBookings });
});

router.post('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const { studioId, bookingDate, startHour, endHour, notes } = req.body ?? {};
  const studio = db.prepare('SELECT * FROM studios WHERE id = ?').get(studioId) as
    | StudioRow
    | undefined;

  if (!studio) {
    res.status(404).json({ error: 'Selected studio workspace does not exist.' });
    return;
  }
  if (typeof bookingDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) {
    res.status(400).json({ error: 'Please select a valid shoot date.' });
    return;
  }

  const start = Number(startHour);
  const end = Number(endHour);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 6 || end > 23 || end <= start) {
    res
      .status(400)
      .json({ error: 'Please choose a valid shoot window (minimum 1 hour between 6 AM and 11 PM).' });
    return;
  }

  const conflict = findConfirmedOverlap(studioId, bookingDate, start, end);
  if (conflict) {
    res.status(409).json({
      error: `Double-booking conflict: "${studio.title}" already has a Confirmed reservation on ${bookingDate} from ${formatHourLabel(conflict.startHour)} to ${formatHourLabel(conflict.endHour)}. Please choose a non-overlapping time window.`,
      conflict,
    });
    return;
  }

  const durationHours = end - start;
  const totalAmount = durationHours * studio.hourlyRate + studio.securityDeposit;
  const id = `bkg_${crypto.randomUUID().slice(0, 12)}`;
  const invoiceNumber = `INV-SS-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`;

  db.prepare(
    `INSERT INTO bookings (
      id, studioId, studioTitle, studioImage, studioLocation, studioCategory,
      hostEmail, hostName, userEmail, userName, bookingDate, startHour, endHour,
      durationHours, hourlyRate, securityDeposit, totalAmount, status, notes,
      invoiceNumber, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?)`
  ).run(
    id,
    studio.id,
    studio.title,
    studio.imageUrl,
    studio.location,
    studio.category,
    studio.ownerEmail,
    studio.ownerName,
    req.user!.email,
    req.user!.name,
    bookingDate,
    start,
    end,
    durationHours,
    studio.hourlyRate,
    studio.securityDeposit,
    totalAmount,
    typeof notes === 'string' ? notes.trim() : '',
    invoiceNumber,
    new Date().toISOString()
  );

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
  res.status(201).json({ booking });
});

router.patch('/:id/status', requireAuth, (req: AuthenticatedRequest, res) => {
  const { status } = req.body ?? {};
  if (typeof status !== 'string' || !VALID_STATUSES.has(status)) {
    res.status(400).json({ error: 'Invalid booking status value.' });
    return;
  }

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id) as
    | {
        id: string;
        studioId: string;
        hostEmail: string;
        userEmail: string;
        bookingDate: string;
        startHour: number;
        endHour: number;
        status: string;
      }
    | undefined;

  if (!booking) {
    res.status(404).json({ error: 'Booking reservation not found.' });
    return;
  }

  const requester = req.user!.email.toLowerCase();
  const isGuest = booking.userEmail.toLowerCase() === requester;
  const isHost = booking.hostEmail.toLowerCase() === requester;

  if (!isGuest && !isHost) {
    res.status(403).json({ error: 'Forbidden: You do not have permission to update this booking.' });
    return;
  }
  if (isGuest && !isHost && (status !== 'Cancelled' || booking.status !== 'Pending')) {
    res.status(400).json({ error: 'Creators can only cancel bookings that are currently Pending.' });
    return;
  }

  if (status === 'Confirmed') {
    const conflict = findConfirmedOverlap(
      booking.studioId,
      booking.bookingDate,
      booking.startHour,
      booking.endHour,
      booking.id
    );
    if (conflict) {
      res.status(409).json({
        error: `Cannot confirm: Overlaps with an already Confirmed booking from ${formatHourLabel(conflict.startHour)} to ${formatHourLabel(conflict.endHour)} on ${booking.bookingDate}.`,
      });
      return;
    }
  }

  db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, booking.id);
  const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(booking.id);
  res.json({ booking: updated });
});

export default router;
