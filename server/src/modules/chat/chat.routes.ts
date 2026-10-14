import { Router } from 'express';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { chatMessageLimiter } from '../../middleware/rateLimit.js';
import { validate, validated } from '../../middleware/validate.js';
import { messagesQuery, postMessageBody, sessionParams } from './chat.schemas.js';
import { confirmBooking, createSession, getMessages, listSessions, postMessage } from './chat.service.js';

export const chatRouter = Router();

chatRouter.use('/chat', requireAuth);

chatRouter.get('/chat/sessions', async (req, res) => {
  res.json({ sessions: await listSessions(currentUser(req)) });
});

chatRouter.post('/chat/sessions', async (req, res) => {
  res.status(201).json(await createSession(currentUser(req)));
});

const getMessagesInput = { params: sessionParams, query: messagesQuery };
chatRouter.get('/chat/sessions/:id/messages', validate(getMessagesInput), async (req, res) => {
  const { params, query } = validated(res, getMessagesInput);
  res.json(await getMessages(currentUser(req), params.id, query.after));
});

const postMessageInput = { params: sessionParams, body: postMessageBody };
chatRouter.post('/chat/sessions/:id/messages', chatMessageLimiter, validate(postMessageInput), async (req, res) => {
  const { params, body } = validated(res, postMessageInput);
  res.status(201).json(await postMessage(currentUser(req), params.id, body.content));
});

const confirmInput = { params: sessionParams };
chatRouter.post('/chat/sessions/:id/confirm', validate(confirmInput), async (req, res) => {
  const { params } = validated(res, confirmInput);
  const result = await confirmBooking(currentUser(req), params.id);
  // 200 when the slot went in the meantime: the reply offers new times but nothing was created.
  res.status(result.appointment ? 201 : 200).json(result);
});
