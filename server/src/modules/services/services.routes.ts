import { Router } from 'express';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { listServices } from './services.service.js';

export const servicesRouter = Router();

servicesRouter.get('/services', requireAuth, async (req, res) => {
  const services = await listServices(currentUser(req).businessId);
  res.json({ services });
});
