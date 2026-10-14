import { query } from '../../db.js';

export type Business = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  openTime: string;
  closeTime: string;
  openDays: number[];
  slotMinutes: number;
};

export type Service = {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
};

type BusinessRow = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  open_time: string;
  close_time: string;
  open_days: number[];
  slot_minutes: number;
};

type ServiceRow = { id: string; name: string; duration_minutes: number; price_cents: number };

const toBusiness = (row: BusinessRow): Business => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  timezone: row.timezone,
  openTime: row.open_time.slice(0, 5),
  closeTime: row.close_time.slice(0, 5),
  openDays: row.open_days,
  slotMinutes: row.slot_minutes,
});

const toService = (row: ServiceRow): Service => ({
  id: row.id,
  name: row.name,
  durationMinutes: row.duration_minutes,
  priceCents: row.price_cents,
});

const businessColumns = 'id, name, slug, timezone, open_time, close_time, open_days, slot_minutes';
const serviceColumns = 'id, name, duration_minutes, price_cents';

export async function findBusinessById(id: string): Promise<Business | null> {
  const rows = await query<BusinessRow>(`SELECT ${businessColumns} FROM businesses WHERE id = $1`, [id]);
  return rows[0] ? toBusiness(rows[0]) : null;
}

export async function findBusinessBySlug(slug: string): Promise<Business | null> {
  const rows = await query<BusinessRow>(`SELECT ${businessColumns} FROM businesses WHERE slug = $1`, [slug]);
  return rows[0] ? toBusiness(rows[0]) : null;
}

export async function listActiveServices(businessId: string): Promise<Service[]> {
  const rows = await query<ServiceRow>(
    `SELECT ${serviceColumns} FROM services WHERE business_id = $1 AND active ORDER BY name`,
    [businessId],
  );
  return rows.map(toService);
}

export async function findActiveService(businessId: string, serviceId: string): Promise<Service | null> {
  const rows = await query<ServiceRow>(
    `SELECT ${serviceColumns} FROM services WHERE business_id = $1 AND id = $2 AND active`,
    [businessId, serviceId],
  );
  return rows[0] ? toService(rows[0]) : null;
}
