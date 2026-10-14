import { Router, type CookieOptions, type Response } from 'express';
import { isProduction } from '../../config.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rateLimit.js';
import { validate, validated } from '../../middleware/validate.js';
import { loginBody, signupBody } from './auth.schemas.js';
import { getCurrentUser, login, signup, type Session } from './auth.service.js';
import { TOKEN_COOKIE, tokenTtlMs } from './auth.tokens.js';

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
