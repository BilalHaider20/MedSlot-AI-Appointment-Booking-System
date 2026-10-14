import { query } from '../../db.js';
import type { TimeRange } from './availability.js';
import type { AppointmentScope } from './appointments.schemas.js';

export type AppointmentStatus = 'booked' | 'cancelled' | 'completed';
export type AppointmentSource = 'chat' | 'form';

export type Appointment = {
  id: string;
  service: { id: string; name: string; durationMinutes: number };
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  notes: string | null;
  source: AppointmentSource;
  createdAt: string;
};

type AppointmentRow = {
  id: string;
  service_id: string;
  service_name: string;
  service_duration_minutes: number;
  starts_at: Date;
  ends_at: Date;
  status: AppointmentStatus;
  notes: string | null;
  source: AppointmentSource;
  created_at: Date;
};

const toAppointment = (row: AppointmentRow): Appointment => ({
  id: row.id,
  service: { id: row.service_id, name: row.service_name, durationMinutes: row.service_duration_minutes },
  startsAt: row.starts_at.toISOString(),
  endsAt: row.ends_at.toISOString(),
  status: row.status,
  notes: row.notes,
  source: row.source,
  createdAt: row.created_at.toISOString(),
});

// `a` is either the appointments table or a CTE with the same columns.
const appointmentSelect = `
  SELECT a.id, a.service_id, s.name AS service_name, s.duration_minutes AS service_duration_minutes,
         a.starts_at, a.ends_at, a.status, a.notes, a.source, a.created_at
  FROM a
  JOIN services s ON s.id = a.service_id`;

// Upcoming means still booked and not over yet; everything else is history.
const scopeFilters: Record<AppointmentScope, string> = {
  upcoming: "a.status = 'booked' AND a.ends_at > $3 ORDER BY a.starts_at ASC",
  past: "(a.status <> 'booked' OR a.ends_at <= $3) ORDER BY a.starts_at DESC LIMIT 50",
};

export async function listForUser(
  businessId: string,
  userId: string,
  scope: AppointmentScope,
  now: Date,
): Promise<Appointment[]> {
  const rows = await query<AppointmentRow>(
    `WITH a AS (SELECT * FROM appointments WHERE business_id = $1 AND user_id = $2)
     ${appointmentSelect}
     WHERE ${scopeFilters[scope]}`,
    [businessId, userId, now],
  );
  return rows.map(toAppointment);
}

export async function findForUser(businessId: string, userId: string, id: string): Promise<Appointment | null> {
  const rows = await query<AppointmentRow>(
    `WITH a AS (SELECT * FROM appointments WHERE business_id = $1 AND user_id = $2 AND id = $3)
     ${appointmentSelect}`,
    [businessId, userId, id],
  );
  return rows[0] ? toAppointment(rows[0]) : null;
}

/** Booked appointments overlapping the range. Served by appointments_booked_starts_idx. */
export async function findBookedRanges(businessId: string, range: TimeRange): Promise<TimeRange[]> {
  const rows = await query<{ starts_at: Date; ends_at: Date }>(
    `SELECT starts_at, ends_at FROM appointments
     WHERE business_id = $1 AND status = 'booked' AND starts_at < $3 AND ends_at > $2`,
    [businessId, range.startsAt, range.endsAt],
  );
  return rows.map((row) => ({ startsAt: row.starts_at, endsAt: row.ends_at }));
}

export async function insertAppointment(input: {
  businessId: string;
  userId: string;
  serviceId: string;
  range: TimeRange;
  notes?: string;
  source: AppointmentSource;
  chatSessionId?: string;
}): Promise<Appointment> {
  const rows = await query<AppointmentRow>(
    `WITH a AS (
       INSERT INTO appointments (business_id, user_id, service_id, starts_at, ends_at, notes, source, chat_session_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *
     )
     ${appointmentSelect}`,
    [
      input.businessId,
      input.userId,
      input.serviceId,
      input.range.startsAt,
      input.range.endsAt,
      input.notes ?? null,
      input.source,
      input.chatSessionId ?? null,
    ],
  );
  return toAppointment(rows[0]!);
}

/** Cancels only the user's own booking that hasn't started. Returns null if nothing matched. */
export async function cancelUpcoming(
  businessId: string,
  userId: string,
  id: string,
  now: Date,
): Promise<Appointment | null> {
  const rows = await query<AppointmentRow>(
    `WITH a AS (
       UPDATE appointments SET status = 'cancelled', cancelled_at = now()
       WHERE business_id = $1 AND user_id = $2 AND id = $3 AND status = 'booked' AND starts_at > $4
       RETURNING *
     )
     ${appointmentSelect}`,
    [businessId, userId, id, now],
  );
  return rows[0] ? toAppointment(rows[0]) : null;
}
