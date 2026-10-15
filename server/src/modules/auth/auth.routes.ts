import { Router, type CookieOptions, type Response } from 'express';
import { isProduction } from '../../config.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rateLimit.js';
import { validate, validated } from '../../middleware/validate.js';
import { changePasswordBody, forgotPasswordBody, loginBody, resetPasswordBody, signupBody } from './auth.schemas.js';
import { getCurrentUser, login, signup, type Session } from './auth.service.js';
import { TOKEN_COOKIE, tokenTtlMs } from './auth.tokens.js';
import { changePassword, requestPasswordReset, resetPassword } from './password.service.js';

export const authRouter = Router();

const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: isProduction,
  path: '/',
};

function sendSession(res: Response, status: number, session: Session) {
  res.cookie(TOKEN_COOKIE, session.token, { ...cookieOptions, maxAge: tokenTtlMs });
  res.status(status).json({ user: session.user });
}

const signupInput = { body: signupBody };
authRouter.post('/auth/signup', authLimiter, validate(signupInput), async (_req, res) => {
  const { body } = validated(res, signupInput);
  sendSession(res, 201, await signup(body));
});

const loginInput = { body: loginBody };
authRouter.post('/auth/login', authLimiter, validate(loginInput), async (_req, res) => {
  const { body } = validated(res, loginInput);
  sendSession(res, 200, await login(body));
});

authRouter.post('/auth/logout', (_req, res) => {
  res.clearCookie(TOKEN_COOKIE, cookieOptions);
  res.status(204).end();
});

authRouter.get('/auth/me', requireAuth, async (req, res) => {
  const { id, businessId } = currentUser(req);
  res.json({ user: await getCurrentUser(businessId, id) });
});

const forgotInput = { body: forgotPasswordBody };
authRouter.post('/auth/password/forgot', authLimiter, validate(forgotInput), async (_req, res) => {
  const { body } = validated(res, forgotInput);
  await requestPasswordReset(body.email);
  res.status(202).json({ message: "If that email has an account, we've sent a link to reset the password." });
});

const resetInput = { body: resetPasswordBody };
authRouter.post('/auth/password/reset', authLimiter, validate(resetInput), async (_req, res) => {
  const { body } = validated(res, resetInput);
  await resetPassword(body.token, body.password);
  res.status(204).end();
});

const changeInput = { body: changePasswordBody };
authRouter.post('/auth/password/change', authLimiter, requireAuth, validate(changeInput), async (req, res) => {
  const { body } = validated(res, changeInput);
  sendSession(res, 200, await changePassword(currentUser(req), body.currentPassword, body.newPassword));
});
