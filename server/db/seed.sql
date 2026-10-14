-- Demo data for Harbor Street Physio. Appointment times are relative to now(),
-- so the app always has some history and one upcoming booking.
-- Both demo users sign in with the password "demo1234".

-- Local wall-clock time at the clinic, N days from today. Sundays (closed) roll to Monday.
CREATE FUNCTION pg_temp.clinic_time(days_from_today integer, at time) RETURNS timestamptz
LANGUAGE sql AS $$
  SELECT ((d + CASE WHEN extract(isodow FROM d) = 7 THEN 1 ELSE 0 END) + at) AT TIME ZONE 'America/New_York'
  FROM (SELECT (now() AT TIME ZONE 'America/New_York')::date + days_from_today AS d) AS day
$$;

CREATE FUNCTION pg_temp.clinic_day_label(ts timestamptz) RETURNS text
LANGUAGE sql AS $$
  SELECT to_char(ts AT TIME ZONE 'America/New_York', 'Dy FMDD Mon')
$$;

INSERT INTO businesses (id, name, slug, timezone, open_time, close_time, open_days, slot_minutes)
VALUES ('bdb9cba5-d7ab-4cda-887a-c780161a7434', 'Harbor Street Physio', 'harbor-street',
        'America/New_York', '09:00', '17:00', '{1,2,3,4,5,6}', 30);

INSERT INTO services (id, business_id, name, duration_minutes, price_cents) VALUES
  ('e26d1a51-041e-4cb9-9345-00a0051c0a0c', 'bdb9cba5-d7ab-4cda-887a-c780161a7434', 'Initial assessment',  60, 9500),
  ('0474771d-f822-4cf6-96bd-afe09b62e1c3', 'bdb9cba5-d7ab-4cda-887a-c780161a7434', 'Follow-up physio',    30, 6000),
  ('1ebb6626-2b87-4f80-a9ba-21a60ac4fed6', 'bdb9cba5-d7ab-4cda-887a-c780161a7434', 'Sports massage',      45, 7500),
  ('b4419107-9afd-4eee-b3bb-46f0c7f125f3', 'bdb9cba5-d7ab-4cda-887a-c780161a7434', 'Deep tissue massage', 60, 8500);

-- bcrypt (cost 10) of "demo1234", generated with bcryptjs.
INSERT INTO users (id, business_id, email, password_hash, full_name, phone, created_at) VALUES
  ('2774234f-6751-43f5-bdbd-e2f72c7611a0', 'bdb9cba5-d7ab-4cda-887a-c780161a7434', 'demo@bookwell.test',
   '$2b$10$gZZ5P0.1v.vBsekWESJPV.rciiPUhAM1E5O1WydRCflDNmDbdb182', 'Jordan Ellis', '+1 617 555 0142',
   now() - interval '30 days'),
  ('06b7c903-5bf3-47ee-ac35-a352b726ccb2', 'bdb9cba5-d7ab-4cda-887a-c780161a7434', 'maya.okafor@bookwell.test',
   '$2b$10$UcJubOxpBX1WCV0.wQUAh.aetiUiB89aeQtRqpOP/Sv0lGCy4ER9.', 'Maya Okafor', '+1 617 555 0187',
   now() - interval '21 days');

-- Jordan's conversation from yesterday that ended in the upcoming booking below.
INSERT INTO chat_sessions (id, business_id, user_id, title, state, last_message_at, created_at)
VALUES ('552bc2e0-e4cb-4b9a-a792-3f3bfab86b5a', 'bdb9cba5-d7ab-4cda-887a-c780161a7434',
        '2774234f-6751-43f5-bdbd-e2f72c7611a0',
        'Sports massage · ' || pg_temp.clinic_day_label(pg_temp.clinic_time(2, '10:00')),
        '{"step": "booked", "draft": {}, "misses": 0}',
        now() - interval '1 day' + interval '3 minutes',
        now() - interval '1 day');

INSERT INTO appointments (business_id, user_id, service_id, starts_at, ends_at, status, notes, source, created_at, cancelled_at) VALUES
  -- Jordan: first visit two weeks ago, then a follow-up.
  ('bdb9cba5-d7ab-4cda-887a-c780161a7434', '2774234f-6751-43f5-bdbd-e2f72c7611a0', 'e26d1a51-041e-4cb9-9345-00a0051c0a0c',
   pg_temp.clinic_time(-14, '10:00'), pg_temp.clinic_time(-14, '11:00'), 'completed', 'Right knee pain after running.', 'form',
   now() - interval '20 days', NULL),
  ('bdb9cba5-d7ab-4cda-887a-c780161a7434', '2774234f-6751-43f5-bdbd-e2f72c7611a0', '0474771d-f822-4cf6-96bd-afe09b62e1c3',
   pg_temp.clinic_time(-7, '11:30'), pg_temp.clinic_time(-7, '12:00'), 'completed', NULL, 'form',
   now() - interval '14 days', NULL),
  -- Jordan: cancelled a massage last week.
  ('bdb9cba5-d7ab-4cda-887a-c780161a7434', '2774234f-6751-43f5-bdbd-e2f72c7611a0', 'b4419107-9afd-4eee-b3bb-46f0c7f125f3',
   pg_temp.clinic_time(-5, '15:00'), pg_temp.clinic_time(-5, '16:00'), 'cancelled', NULL, 'form',
   now() - interval '10 days', now() - interval '6 days'),
  -- Maya: past assessment and an upcoming massage.
  ('bdb9cba5-d7ab-4cda-887a-c780161a7434', '06b7c903-5bf3-47ee-ac35-a352b726ccb2', 'e26d1a51-041e-4cb9-9345-00a0051c0a0c',
   pg_temp.clinic_time(-10, '14:00'), pg_temp.clinic_time(-10, '15:00'), 'completed', 'Lower back, desk job.', 'form',
   now() - interval '18 days', NULL),
  ('bdb9cba5-d7ab-4cda-887a-c780161a7434', '06b7c903-5bf3-47ee-ac35-a352b726ccb2', 'b4419107-9afd-4eee-b3bb-46f0c7f125f3',
   pg_temp.clinic_time(3, '15:00'), pg_temp.clinic_time(3, '16:00'), 'booked', NULL, 'form',
   now() - interval '2 days', NULL);

INSERT INTO appointments (id, business_id, user_id, service_id, starts_at, ends_at, status, source, chat_session_id, created_at)
VALUES ('a7e3c1d2-5b8f-4e6a-9c0d-3f2b1e4d5a6c', 'bdb9cba5-d7ab-4cda-887a-c780161a7434',
        '2774234f-6751-43f5-bdbd-e2f72c7611a0', '1ebb6626-2b87-4f80-a9ba-21a60ac4fed6',
        pg_temp.clinic_time(2, '10:00'), pg_temp.clinic_time(2, '10:45'), 'booked', 'chat',
        '552bc2e0-e4cb-4b9a-a792-3f3bfab86b5a', now() - interval '1 day' + interval '3 minutes');

INSERT INTO chat_messages (session_id, role, content, meta, created_at)
SELECT '552bc2e0-e4cb-4b9a-a792-3f3bfab86b5a', m.role, m.content, m.meta,
       now() - interval '1 day' + m.offset_seconds * interval '1 second'
FROM (
  SELECT pg_temp.clinic_time(2, '10:00') AS starts_at
) AS booking,
LATERAL (VALUES
  ('assistant', 'Hi, I''m the booking assistant for Harbor Street Physio. What would you like to book?',
   jsonb_build_object('ui', jsonb_build_object('type', 'services', 'services', jsonb_build_array(
     jsonb_build_object('id', 'e26d1a51-041e-4cb9-9345-00a0051c0a0c', 'name', 'Initial assessment'),
     jsonb_build_object('id', '0474771d-f822-4cf6-96bd-afe09b62e1c3', 'name', 'Follow-up physio'),
     jsonb_build_object('id', '1ebb6626-2b87-4f80-a9ba-21a60ac4fed6', 'name', 'Sports massage'),
     jsonb_build_object('id', 'b4419107-9afd-4eee-b3bb-46f0c7f125f3', 'name', 'Deep tissue massage')))),
   0),
  ('user', 'Can I get a sports massage on ' || trim(to_char(booking.starts_at AT TIME ZONE 'America/New_York', 'Day')) || '?',
   '{}'::jsonb, 40),
  ('assistant', 'These times are free on ' || pg_temp.clinic_day_label(booking.starts_at) || ':',
   jsonb_build_object('ui', jsonb_build_object(
     'type', 'slots',
     'date', to_char(booking.starts_at AT TIME ZONE 'America/New_York', 'YYYY-MM-DD'),
     'serviceId', '1ebb6626-2b87-4f80-a9ba-21a60ac4fed6',
     'slots', jsonb_build_array('09:00', '09:30', '10:00', '10:30', '11:00', '13:00', '13:30', '14:00', '15:30'))),
   41),
  ('user', '10am please', '{}'::jsonb, 150),
  ('assistant', 'Sports massage on ' || pg_temp.clinic_day_label(booking.starts_at) || ' at 10:00, 45 minutes, $75. Should I book it?',
   jsonb_build_object('ui', jsonb_build_object('type', 'confirm', 'draft', jsonb_build_object(
     'serviceId', '1ebb6626-2b87-4f80-a9ba-21a60ac4fed6',
     'serviceName', 'Sports massage',
     'date', to_char(booking.starts_at AT TIME ZONE 'America/New_York', 'YYYY-MM-DD'),
     'time', '10:00'))),
   151),
  ('assistant', 'You''re booked for a sports massage on ' || pg_temp.clinic_day_label(booking.starts_at) || ' at 10:00.',
   jsonb_build_object('ui', jsonb_build_object('type', 'booked', 'appointmentId', 'a7e3c1d2-5b8f-4e6a-9c0d-3f2b1e4d5a6c')),
   180)
) AS m(role, content, meta, offset_seconds)
ORDER BY m.offset_seconds;
