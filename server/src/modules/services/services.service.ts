import { notFound } from '../../lib/httpError.js';
import * as repo from './services.repository.js';
import type { Business, Service } from './services.repository.js';

export type { Business, Service };

export const listServices = (businessId: string): Promise<Service[]> => repo.listActiveServices(businessId);

export async function getBusiness(businessId: string): Promise<Business> {
  const business = await repo.findBusinessById(businessId);
  if (!business) throw notFound('Business not found.');
  return business;
}

export async function getService(businessId: string, serviceId: string): Promise<Service> {
  const service = await repo.findActiveService(businessId, serviceId);
  if (!service) throw notFound('That service does not exist.');
  return service;
}
