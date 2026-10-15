// End to end against a real database (medslot_test, rebuilt by globalSetup).
import { DateTime } from 'luxon';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db.js';

const app = createApp();
const timezone = 'America/New_York';

afterAll(async () => {
  await pool.end();
});

type ServiceBody = { id: string; name: string };

/** Tomorrow at the clinic, or Monday if tomorrow is Sunday (closed). */
function nextOpenDay(): { date: string; phrase: string } {
  const tomorrow = DateTime.now().setZone(timezone).plus({ days: 1 });
  if (tomorrow.weekday !== 7) return { date: tomorrow.toISODate()!, phrase: 'tomorrow' };
  return { date: tomorrow.plus({ days: 1 }).toISODate()!, phrase: 'on monday' };
}

describe('API', () => {
  it('rejects requests without a session and reports validation errors in the standard shape', async () => {
    const unauthenticated = await request(app).get('/api/services');
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.error.code).toBe('UNAUTHORIZED');

    const invalid = await request(app).post('/api/auth/signup').send({ email: 'nope', password: 'short' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    expect(invalid.body.error.details.map((d: { path: string }) => d.path)).toEqual(
      expect.arrayContaining(['fullName', 'email', 'password']),
    );
  });

  it('signs up, books, blocks a double booking, then books through chat', async () => {
    const email = `alex.rivera.${Date.now()}@medslot.test`;
    const password = 'correct horse battery';

    const signup = await request(app).post('/api/auth/signup').send({ fullName: 'Alex Rivera', email, password });
    expect(signup.status).toBe(201);
    expect(signup.body.user).toMatchObject({ email, fullName: 'Alex Rivera', role: 'customer' });
    expect(JSON.stringify(signup.body)).not.toMatch(/password/i);
    expect(signup.headers['set-cookie']?.[0]).toMatch(/^ms_token=.+HttpOnly/);

    const duplicate = await request(app).post('/api/auth/signup').send({ fullName: 'Alex Rivera', email, password });
    expect(duplicate.status).toBe(409);

    const wrongPassword = await request(app).post('/api/auth/login').send({ email, password: 'not the password' });
    const unknownEmail = await request(app).post('/api/auth/login').send({ email: 'nobody@medslot.test', password });
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);

    // The agent keeps the ms_token cookie from here on.
    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send({ email: email.toUpperCase(), password });
    expect(login.status).toBe(200);
    expect((await agent.get('/api/auth/me')).body.user.email).toBe(email);

    const services: ServiceBody[] = (await agent.get('/api/services')).body.services;
    const followUp = services.find((s) => s.name === 'Follow-up physio')!;
    expect(followUp).toBeDefined();

    const { date, phrase } = nextOpenDay();
    const availability = await agent.get('/api/availability').query({ serviceId: followUp.id, date });
    expect(availability.status).toBe(200);
    expect(availability.body).toMatchObject({ date, timezone });
    const [firstSlot] = availability.body.slots as string[];
    expect(firstSlot).toBeDefined();

    const booking = { serviceId: followUp.id, date, time: firstSlot, notes: 'Left shoulder' };
    const created = await agent.post('/api/appointments').send(booking);
    expect(created.status).toBe(201);
    expect(created.body.appointment).toMatchObject({ status: 'booked', source: 'form', notes: 'Left shoulder' });

    const doubleBooked = await agent.post('/api/appointments').send(booking);
    expect(doubleBooked.status).toBe(409);
    expect(doubleBooked.body.error.code).toBe('CONFLICT');

    const session = await agent.post('/api/chat/sessions');
    expect(session.status).toBe(201);
    expect(session.body.messages[0].role).toBe('assistant');
    const sessionId: string = session.body.session.id;

    const turn = await agent
      .post(`/api/chat/sessions/${sessionId}/messages`)
      .send({ content: `book a sports massage ${phrase} at 2pm` });
    expect(turn.status).toBe(201);
    const [userMessage, reply] = turn.body.messages;
    expect(userMessage.role).toBe('user');
    expect(reply.meta.ui).toMatchObject({
      type: 'confirm',
      draft: { serviceName: 'Sports massage', date, time: '14:00' },
    });
    expect(turn.body.session.title).toMatch(/^Sports massage · /);

    const confirmed = await agent.post(`/api/chat/sessions/${sessionId}/confirm`);
    expect(confirmed.status).toBe(201);
    expect(confirmed.body.appointment).toMatchObject({ source: 'chat', status: 'booked' });
    expect(confirmed.body.messages[0].content).toMatch(/^You're booked for a sports massage on .+ at 14:00\.$/);
    expect(confirmed.body.messages[0].meta.ui).toEqual({ type: 'booked', appointmentId: confirmed.body.appointment.id });

    const again = await agent.post(`/api/chat/sessions/${sessionId}/confirm`);
    expect(again.status).toBe(409);

    const polled = await agent.get(`/api/chat/sessions/${sessionId}/messages`).query({ after: userMessage.id });
    expect(polled.body.messages.map((m: { role: string }) => m.role)).toEqual(['assistant', 'assistant']);

    const upcoming = await agent.get('/api/appointments').query({ scope: 'upcoming' });
    expect(upcoming.body.appointments).toHaveLength(2);

    const cancelled = await agent.post(`/api/appointments/${created.body.appointment.id}/cancel`);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.appointment.status).toBe('cancelled');
  });

  it('lets exactly one of two simultaneous requests take a slot', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'maya.okafor@medslot.test', password: 'demo1234' });
    const services: ServiceBody[] = (await agent.get('/api/services')).body.services;
    const assessment = services.find((s) => s.name === 'Initial assessment')!;

    const { date } = nextOpenDay();
    const booking = { serviceId: assessment.id, date, time: '16:00' };
    const results = await Promise.all([
      agent.post('/api/appointments').send(booking),
      agent.post('/api/appointments').send(booking),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });
});
