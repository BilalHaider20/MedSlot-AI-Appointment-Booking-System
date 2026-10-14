import { z } from 'zod';
import { isValidDate } from '../../lib/time.js';

export const dateField = z.string().refine(isValidDate, 'Use a date like 2026-10-17.');
export const timeField = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time like 14:30.');

export const availabilityQuery = z.object({
  serviceId: z.uuid('Pick a service.'),
  date: dateField,
});

export const listAppointmentsQuery = z.object({
  scope: z.enum(['upcoming', 'past']).default('upcoming'),
});

export const createAppointmentBody = z.object({
  serviceId: z.uuid('Pick a service.'),
  date: dateField,
  time: timeField,
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((notes) => notes || undefined),
});

export const appointmentIdParams = z.object({ id: z.uuid() });

export type AppointmentScope = z.infer<typeof listAppointmentsQuery>['scope'];
export type CreateAppointmentInput = z.infer<typeof createAppointmentBody>;
