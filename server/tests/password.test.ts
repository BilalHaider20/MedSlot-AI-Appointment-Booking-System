// Forgot / reset / change password against the real test database. The mailer is
// replaced so the test can read the link that would have been emailed.
import request from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { Email } from '../src/lib/mailer.js';

const sent = vi.hoisted(() => [] as Email[]);
vi.mock('../src/lib/mailer.js', () => ({
  sendEmail: async (email: Email) => {
    sent.push(email);
  },
}));

const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db.js');

const app = createApp();

afterAll(async () => {
  await pool.end();
});

// Session tokens carry their issue time in whole seconds, so a password change
// in the same second as login wouldn't count as "after". Real users never hit this.
const nextSecond = () => new Promise((resolve) => setTimeout(resolve, 1100));

function tokenFrom(email: Email): string {
  const match = /reset-password\?token=([\w-]+)/.exec(email.text);
  if (!match) throw new Error('No reset link in email');
  return match[1]!;
}

async function signUp(name: string) {
  const email = `${name.toLowerCase().replace(' ', '.')}.${Date.now()}@medslot.test`;
  const password = 'first password 1';
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/signup').send({ fullName: name, email, password });
  expect(res.status).toBe(201);
  return { agent, email, password };
}

describe('password reset', () => {
  it('emails a single-use link, sets the new password and ends existing sessions', async () => {
    const { agent, email, password } = await signUp('Priya Shah');
    await nextSecond();

    const unknown = await request(app).post('/api/auth/password/forgot').send({ email: 'nobody@medslot.test' });
    const known = await request(app).post('/api/auth/password/forgot').send({ email });
    expect(unknown.status).toBe(202);
    expect(known.status).toBe(202);
    expect(known.body).toEqual(unknown.body);
    expect(sent.map((message) => message.to)).toEqual([email]);

    // Asking again revokes the first link.
    await request(app).post('/api/auth/password/forgot').send({ email });
    const [firstLink, secondLink] = sent.map(tokenFrom);
    const stale = await request(app).post('/api/auth/password/reset').send({ token: firstLink, password: 'new password 22' });
    expect(stale.status).toBe(400);

    const reset = await request(app).post('/api/auth/password/reset').send({ token: secondLink, password: 'new password 22' });
    expect(reset.status).toBe(204);
    const reused = await request(app).post('/api/auth/password/reset').send({ token: secondLink, password: 'another one 333' });
    expect(reused.status).toBe(400);

    expect((await agent.get('/api/auth/me')).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email, password })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email, password: 'new password 22' })).status).toBe(200);
  });
});

describe('password change', () => {
  it('checks the current password, keeps this session and signs out the others', async () => {
    const { agent, email, password } = await signUp('Tom Becker');
    const otherDevice = request.agent(app);
    expect((await otherDevice.post('/api/auth/login').send({ email, password })).status).toBe(200);
    await nextSecond();

    const wrong = await agent.post('/api/auth/password/change').send({ currentPassword: 'guess', newPassword: 'second password 2' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.details).toEqual([{ path: 'currentPassword', message: "That isn't your current password." }]);

    const changed = await agent.post('/api/auth/password/change').send({ currentPassword: password, newPassword: 'second password 2' });
    expect(changed.status).toBe(200);
    expect(changed.body.user.email).toBe(email);

    expect((await agent.get('/api/auth/me')).status).toBe(200);
    expect((await otherDevice.get('/api/auth/me')).status).toBe(401);

    const signedOut = await request(app).post('/api/auth/password/change').send({ currentPassword: 'x', newPassword: 'whatever 12345' });
    expect(signedOut.status).toBe(401);
  });
});
