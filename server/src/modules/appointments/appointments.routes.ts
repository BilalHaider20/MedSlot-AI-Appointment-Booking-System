import { Router } from 'express';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { validate, validated } from '../../middleware/validate.js';
import {
  appointmentIdParams,
  availabilityQuery,
  createAppointmentBody,
  listAppointmentsQuery,
} from './appointments.schemas.js';
import { cancelAppointment, createAppointment, getAvailability, listAppointments } from './appointments.service.js';

export const appointmentsRouter = Router();

appointmentsRouter.use(['/availability', '/appointments'], requireAuth);

const availabilityInput = { query: availabilityQuery };
appointmentsRouter.get('/availability', validate(availabilityInput), async (req, res) => {
  const { query } = validated(res, availabilityInput);
  res.json(await getAvailability(currentUser(req).businessId, query.serviceId, query.date));
});

const listInput = { query: listAppointmentsQuery };
appointmentsRouter.get('/appointments', validate(listInput), async (req, res) => {
  const { query } = validated(res, listInput);
  res.json({ appointments: await listAppointments(currentUser(req), query.scope) });
});

const createInput = { body: createAppointmentBody };
appointmentsRouter.post('/appointments', validate(createInput), async (req, res) => {
  const { body } = validated(res, createInput);
  const appointment = await createAppointment(currentUser(req), { ...body, source: 'form' });
  res.status(201).json({ appointment });
});

const cancelInput = { params: appointmentIdParams };
appointmentsRouter.post('/appointments/:id/cancel', validate(cancelInput), async (req, res) => {
  const { params } = validated(res, cancelInput);
  res.json({ appointment: await cancelAppointment(currentUser(req), params.id) });
});
