import { conflict, notFound } from '../../lib/httpError.js';
import { addDays } from '../../lib/time.js';
import type { AuthUser } from '../auth/auth.tokens.js';
import { getBusiness, getService, type Business, type Service } from '../services/services.service.js';
import * as repo from './appointments.repository.js';
import type { Appointment, AppointmentSource } from './appointments.repository.js';
import type { AppointmentScope, CreateAppointmentInput } from './appointments.schemas.js';
import { appointmentRange, dayStatus, freeSlots, openingRange, type DayStatus } from './availability.js';

export type { Appointment };

export type DayAvailability = { date: string; status: DayStatus; slots: string[] };

const NEXT_FREE_DAY_HORIZON = 14;

export async function getDayAvailability(
  business: Business,
  service: Service,
  date: string,
  now = new Date(),
): Promise<DayAvailability> {
  const status = dayStatus(business, date, now);
  if (status !== 'open') return { date, status, slots: [] };

  const booked = await repo.findBookedRanges(business.id, openingRange(business, date));
  const slots = freeSlots({ hours: business, date, durationMinutes: service.durationMinutes, booked, now });
  return { date, status, slots };
}

/** First day on or after `fromDate` with at least one free slot, looking two weeks ahead. */
export async function findNextFreeDay(
  business: Business,
  service: Service,
  fromDate: string,
  now = new Date(),
): Promise<DayAvailability | null> {
  const lastDate = addDays(fromDate, NEXT_FREE_DAY_HORIZON - 1);
  const window = { startsAt: openingRange(business, fromDate).startsAt, endsAt: openingRange(business, lastDate).endsAt };
  // One query for the whole window instead of one per day.
  const booked = await repo.findBookedRanges(business.id, window);

  for (let offset = 0; offset < NEXT_FREE_DAY_HORIZON; offset++) {
    const date = addDays(fromDate, offset);
    const slots = freeSlots({ hours: business, date, durationMinutes: service.durationMinutes, booked, now });
    if (slots.length > 0) return { date, status: 'open', slots };
  }
  return null;
}

export async function getAvailability(businessId: string, serviceId: string, date: string) {
  const [business, service] = await Promise.all([getBusiness(businessId), getService(businessId, serviceId)]);
  const day = await getDayAvailability(business, service, date);
  return { date, timezone: business.timezone, slots: day.slots };
}

export function listAppointments(user: AuthUser, scope: AppointmentScope): Promise<Appointment[]> {
  return repo.listForUser(user.businessId, user.id, scope, new Date());
}

export async function createAppointment(
  user: AuthUser,
  input: CreateAppointmentInput & { source: AppointmentSource; chatSessionId?: string },
): Promise<Appointment> {
  const [business, service] = await Promise.all([
    getBusiness(user.businessId),
    getService(user.businessId, input.serviceId),
  ]);

  const day = await getDayAvailability(business, service, input.date);
  if (!day.slots.includes(input.time)) {
    throw conflict('That time is not available. Pick one of the free times.');
  }

  try {
    return await repo.insertAppointment({
      businessId: business.id,
      userId: user.id,
      serviceId: service.id,
      range: appointmentRange(business.timezone, input.date, input.time, service.durationMinutes),
      notes: input.notes,
      source: input.source,
      chatSessionId: input.chatSessionId,
    });
  } catch (error) {
    // Someone booked an overlapping slot between our check and the insert.
    if ((error as { code?: string }).code === '23P01') throw conflict('That time was just taken.');
    throw error;
  }
}

export async function cancelAppointment(user: AuthUser, appointmentId: string): Promise<Appointment> {
  const cancelled = await repo.cancelUpcoming(user.businessId, user.id, appointmentId, new Date());
  if (cancelled) return cancelled;

  const existing = await repo.findForUser(user.businessId, user.id, appointmentId);
  if (!existing) throw notFound('Appointment not found.');
  throw conflict('Only upcoming bookings can be cancelled.');
}
