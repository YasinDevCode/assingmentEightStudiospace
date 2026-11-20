import db from '../db.ts';

export interface OverlapMatch {
  id: string;
  startHour: number;
  endHour: number;
}

export function formatHourLabel(hour: number): string {
  const normalized = hour % 12 === 0 ? 12 : hour % 12;
  const period = hour < 12 ? 'AM' : 'PM';
  return `${normalized}:00 ${period}`;
}

export function validatePasswordStrength(password: string): string | null {
  if (!password || password.length < 6) {
    return 'Password must be at least 6 characters long.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter.';
  }
  return null;
}

export function findConfirmedOverlap(
  studioId: string,
  bookingDate: string,
  startHour: number,
  endHour: number,
  excludeBookingId?: string
): OverlapMatch | undefined {
  if (excludeBookingId) {
    return db
      .prepare(
        `SELECT id, startHour, endHour FROM bookings
         WHERE studioId = ?
           AND bookingDate = ?
           AND status = 'Confirmed'
           AND id != ?
           AND startHour < ?
           AND endHour > ?
         LIMIT 1`
      )
      .get(studioId, bookingDate, excludeBookingId, endHour, startHour) as
      | OverlapMatch
      | undefined;
  }

  return db
    .prepare(
      `SELECT id, startHour, endHour FROM bookings
       WHERE studioId = ?
         AND bookingDate = ?
         AND status = 'Confirmed'
         AND startHour < ?
         AND endHour > ?
       LIMIT 1`
    )
    .get(studioId, bookingDate, endHour, startHour) as OverlapMatch | undefined;
}
