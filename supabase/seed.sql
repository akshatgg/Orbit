-- Local development data. Runs on `supabase db reset` (never on the hosted project).
-- Every demo account's password is: password123

-- ─── Categories ─────────────────────────────────────────────
insert into public.categories (slug, name, "group", sort_order) values
  ('employer-presentation', 'Employer presentation', 'career', 10),
  ('careers-fair',          'Careers fair',          'career', 20),
  ('workshop',              'Workshop',              'career', 30),
  ('competition',           'Competition',           'career', 40),
  ('talk',                  'Talk & panel',          'career', 50),
  ('networking',            'Networking',            'social', 60),
  ('society',               'Society event',         'social', 70),
  ('social',                'Social',                'social', 80),
  ('fitness',               'Fitness & sport',       'other',  90),
  ('entrepreneurship',      'Entrepreneurship',      'other', 100),
  ('sustainability',        'Sustainability',        'other', 110),
  ('arts-culture',          'Arts & culture',        'other', 120)
on conflict (slug) do nothing;

-- ─── Demo accounts ──────────────────────────────────────────
create or replace function pg_temp.demo_user(uid uuid, mail text, name text)
returns void language plpgsql as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail,
    extensions.crypt('password123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', name),
    now(), now(), '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', mail), 'email', now(), now(), now());
end;
$$;

select pg_temp.demo_user('00000000-0000-4000-8000-000000000001', 'akshatg9536@gmail.com', 'Akshat (Super Admin)');
select pg_temp.demo_user('00000000-0000-4000-8000-000000000002', 'admin@orbit.test',     'Ada Admin');
select pg_temp.demo_user('00000000-0000-4000-8000-000000000003', 'student@imperial.ac.uk', 'Sam Student');
select pg_temp.demo_user('00000000-0000-4000-8000-000000000004', 'newbie@orbit.test',    'Nina Newbie');
select pg_temp.demo_user('00000000-0000-4000-8000-000000000005', 'organiser@orbit.test', 'Olu Organiser');
select pg_temp.demo_user('00000000-0000-4000-8000-000000000006', 'pending@orbit.test',   'Priya Pending');
select pg_temp.demo_user('00000000-0000-4000-8000-000000000007', 'guest1@orbit.test',    'Gabe Guest');
select pg_temp.demo_user('00000000-0000-4000-8000-000000000008', 'guest2@orbit.test',    'Grace Guest');

update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000000002';

-- Sam has finished onboarding; Nina hasn't (to test the onboarding flow).
update public.profiles set
  university = 'Imperial College London', department = 'Business School',
  course = 'MSc Management', year_of_study = '2026/27',
  career_interests = array['consulting', 'finance'],
  personal_interests = array['fitness', 'socialising'],
  preferred_categories = array['employer-presentation', 'networking', 'workshop'],
  preferred_formats = array['in_person', 'hybrid'],
  location_preference = 'London',
  availability = '{"mon":["evening"],"tue":["evening"],"wed":["evening"],"thu":["evening"],"sat":["day"]}',
  onboarded_at = now()
where id in (
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000005',
  '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000007',
  '00000000-0000-4000-8000-000000000008'
);

-- ─── Organisers ─────────────────────────────────────────────
insert into public.organisers (id, slug, name, kind, bio, website, contact_email, university, status, is_verified, created_by, reviewed_at) values
  ('10000000-0000-4000-8000-000000000001', 'imperial-consulting-society', 'Imperial Consulting Society', 'society',
   'Case workshops, firm presentations and networking for future consultants.', 'https://example.com/ics',
   'hello@ics.example.com', 'Imperial College London', 'approved', true, '00000000-0000-4000-8000-000000000005', now()),
  ('10000000-0000-4000-8000-000000000002', 'business-school-careers', 'Business School Careers', 'university',
   'Careers fairs, employer sessions and coaching for Business School students.', 'https://example.com/careers',
   'careers@example.ac.uk', 'Imperial College London', 'approved', true, '00000000-0000-4000-8000-000000000002', now()),
  ('10000000-0000-4000-8000-000000000003', 'northbridge-capital', 'Northbridge Capital', 'employer',
   'Investment firm hiring graduates into markets and advisory.', 'https://example.com/northbridge',
   'campus@northbridge.example.com', null, 'approved', false, '00000000-0000-4000-8000-000000000002', now()),
  ('10000000-0000-4000-8000-000000000004', 'london-founders-club', 'London Founders Club', 'community',
   'Monthly meetups for student founders and early-stage builders.', 'https://example.com/lfc',
   'team@lfc.example.com', null, 'approved', false, '00000000-0000-4000-8000-000000000005', now()),
  ('10000000-0000-4000-8000-000000000005', 'pottery-society', 'Pottery Society', 'society',
   'Throw, glaze, repeat.', null, 'pots@example.com', 'Imperial College London', 'pending', false,
   '00000000-0000-4000-8000-000000000006', null);

-- created_by triggers added owners; give the organiser account access to two orgs and the admin to the careers team.
insert into public.organiser_members (organiser_id, user_id, role) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', 'owner'),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005', 'owner')
on conflict do nothing;

insert into public.follows (user_id, organiser_id) values
  ('00000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001');

-- ─── Events (dates relative to now so the demo always looks current) ──────
create or replace function pg_temp.cat(s text) returns uuid language sql as $$
  select id from public.categories where slug = s;
$$;

insert into public.events (
  id, organiser_id, title, summary, description, starts_at, ends_at, format, venue_name, address,
  category_id, tags, university, registration_mode, external_url, external_label, requires_approval,
  capacity, registration_deadline, price_min, price_max, status, source, source_url, created_by
) values
  -- Free tickets, plenty of space
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   'Case Interview Bootcamp', 'Crack your first case with ex-MBB consultants.',
   'A hands-on evening of live cases in small groups, with feedback from consultants who have run real interviews.',
   date_trunc('day', now()) + interval '2 days 18 hours', date_trunc('day', now()) + interval '2 days 20 hours',
   'in_person', 'Business School, Room 220', 'Exhibition Road, London SW7 2AZ',
   pg_temp.cat('workshop'), array['consulting', 'case interviews'], 'Imperial College London',
   'tickets', null, 'Apply now', false, 60, date_trunc('day', now()) + interval '2 days 12 hours',
   0, 0, 'published', 'orbit', null, '00000000-0000-4000-8000-000000000005'),

  -- Free, tiny capacity, already full → waitlist
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001',
   'Dinner with a Partner', 'An intimate dinner with a consulting partner. 2 seats.',
   'Ask anything about life in consulting over dinner.',
   date_trunc('day', now()) + interval '5 days 19 hours', date_trunc('day', now()) + interval '5 days 21 hours',
   'in_person', 'The Ivy Kensington', '96 Kensington High St, London W8 4SG',
   pg_temp.cat('networking'), array['consulting', 'dinner'], 'Imperial College London',
   'tickets', null, 'Apply now', false, 2, null, 0, 0, 'published', 'orbit', null, '00000000-0000-4000-8000-000000000005'),

  -- Application form (approval + questions)
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003',
   'Northbridge Spring Insight Week', 'Apply for a 3-day insight programme in markets and advisory.',
   'Spend three days on the trading floor and with the advisory team. Places are limited and selected by application.',
   date_trunc('day', now()) + interval '21 days 9 hours', date_trunc('day', now()) + interval '23 days 17 hours',
   'in_person', 'Northbridge Capital HQ', '1 Canada Square, London E14 5AB',
   pg_temp.cat('employer-presentation'), array['finance', 'internship', 'markets'], null,
   'tickets', null, 'Apply now', true, 30, date_trunc('day', now()) + interval '10 days',
   0, 0, 'published', 'orbit', null, '00000000-0000-4000-8000-000000000002'),

  -- Paid tickets
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004',
   'Founders Friday: Fundraising 101', 'Pitch practice, investor panel, and drinks.',
   'Three investors share what they look for, then open-mic pitches with feedback.',
   date_trunc('day', now()) + interval '4 days 18 hours 30 minutes', date_trunc('day', now()) + interval '4 days 21 hours',
   'in_person', 'Second Home Spitalfields', '68 Hanbury St, London E1 5JL',
   pg_temp.cat('entrepreneurship'), array['startups', 'entrepreneurship', 'investors'], null,
   'tickets', null, 'Apply now', false, 120, null, 5, 15, 'published', 'orbit', null, '00000000-0000-4000-8000-000000000005'),

  -- External "Apply now" redirect (university form)
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002',
   'Business School Careers Fair', '80+ employers across consulting, finance and tech.',
   'Bring your CV. Registration is through the Careers portal.',
   date_trunc('day', now()) + interval '9 days 11 hours', date_trunc('day', now()) + interval '9 days 16 hours',
   'in_person', 'Great Hall, Sherfield Building', 'Exhibition Road, London SW7 2AZ',
   pg_temp.cat('careers-fair'), array['consulting', 'finance', 'technology'], 'Imperial College London',
   'external', 'https://example.com/careers-fair-registration', 'Register on Careers portal', false,
   null, date_trunc('day', now()) + interval '8 days', 0, 0, 'published', 'orbit', 'https://example.com/careers-fair', '00000000-0000-4000-8000-000000000002'),

  -- Online, free
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000002',
   'CV Clinic (Online)', '30-minute live CV review in small groups.',
   'Share your CV on screen and get live feedback from a careers consultant.',
   date_trunc('day', now()) + interval '1 day 13 hours', date_trunc('day', now()) + interval '1 day 14 hours',
   'online', null, null, pg_temp.cat('workshop'), array['cv', 'careers'], 'Imperial College London',
   'tickets', null, 'Apply now', false, 40, null, 0, 0, 'published', 'orbit', null, '00000000-0000-4000-8000-000000000002'),

  -- Social / fitness, info only
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000004',
   'Sunday Run Club: Hyde Park 5K', 'Easy-paced 5K followed by coffee. All levels.',
   'Meet at the Serpentine Bar & Kitchen. No sign-up needed — just turn up.',
   date_trunc('day', now()) + interval '3 days 9 hours', date_trunc('day', now()) + interval '3 days 10 hours 30 minutes',
   'in_person', 'Serpentine Bar & Kitchen', 'Hyde Park, London W2 2UH',
   pg_temp.cat('fitness'), array['fitness', 'running', 'socialising'], null,
   'none', null, 'Apply now', false, null, null, 0, 0, 'published', 'orbit', null, '00000000-0000-4000-8000-000000000005'),

  -- Social, free, hybrid
  ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000001',
   'Sustainability in Strategy: Panel', 'How consultancies are rebuilding strategy around net zero.',
   'Panel with practitioners from three firms, followed by Q&A and networking.',
   date_trunc('day', now()) + interval '6 days 18 hours', date_trunc('day', now()) + interval '6 days 19 hours 30 minutes',
   'hybrid', 'Business School, LT1', 'Exhibition Road, London SW7 2AZ',
   pg_temp.cat('talk'), array['sustainability', 'consulting'], 'Imperial College London',
   'tickets', null, 'Apply now', false, 150, null, 0, 0, 'published', 'orbit', null, '00000000-0000-4000-8000-000000000005'),

  -- Cancelled
  ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000003',
   'Northbridge Coffee Chat', 'Informal coffee with recent graduates.', 'Cancelled due to a scheduling conflict.',
   date_trunc('day', now()) + interval '7 days 10 hours', null, 'in_person', 'Cafe Nero, South Ken', 'London SW7',
   pg_temp.cat('networking'), array['finance'], null, 'tickets', null, 'Apply now', false, 20, null, 0, 0,
   'cancelled', 'orbit', null, '00000000-0000-4000-8000-000000000002'),

  -- Past event
  ('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000001',
   'Welcome Mixer', 'Kick off the term with the society.', 'Drinks and introductions.',
   date_trunc('day', now()) - interval '6 days' + interval '18 hours', date_trunc('day', now()) - interval '6 days' + interval '21 hours',
   'in_person', 'Eastside Bar', 'Prince''s Gardens, London SW7', pg_temp.cat('social'), array['socialising'],
   'Imperial College London', 'tickets', null, 'Apply now', false, 100, null, 0, 0, 'published', 'orbit', null,
   '00000000-0000-4000-8000-000000000005'),

  -- Draft (only the organiser sees it)
  ('20000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000004',
   'Hackathon: Climate x Fintech', 'Draft — details coming soon.', null,
   date_trunc('day', now()) + interval '30 days 10 hours', null, 'in_person', null, null,
   pg_temp.cat('competition'), array['hackathon', 'fintech', 'sustainability'], null,
   'tickets', null, 'Apply now', false, 80, null, null, null, 'draft', 'orbit', null, '00000000-0000-4000-8000-000000000005');

-- Admin-imported event with no organiser (e.g. from CSV)
insert into public.events (id, organiser_id, title, summary, starts_at, format, venue_name, category_id, tags,
  registration_mode, external_url, external_label, price_min, price_max, status, source, source_url, source_event_id, created_by)
values ('20000000-0000-4000-8000-000000000012', null, 'Women in Finance Breakfast', 'Networking breakfast with senior women in finance.',
  date_trunc('day', now()) + interval '8 days 8 hours', 'in_person', 'Guildhall', pg_temp.cat('networking'),
  array['finance', 'networking'], 'external', 'https://example.com/wif-breakfast', 'Get tickets', 10, 10,
  'published', 'csv', 'https://example.com/wif', 'wif-2026-10', '00000000-0000-4000-8000-000000000002');

-- ─── Tickets, questions, private info ──────────────────────
insert into public.ticket_types (id, event_id, name, price, quantity, sort_order) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'General admission', 0, null, 0),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Dinner seat', 0, null, 0),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', 'Insight Week place', 0, null, 0),
  ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000004', 'Student', 5, 80, 0),
  ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000004', 'Standard', 15, 40, 1),
  ('30000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000006', 'Online seat', 0, null, 0),
  ('30000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000008', 'In person', 0, 100, 0),
  ('30000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000008', 'Online', 0, null, 1),
  ('30000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000009', 'General admission', 0, null, 0),
  ('30000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000010', 'General admission', 0, null, 0);

insert into public.event_questions (event_id, label, kind, options, required, sort_order) values
  ('20000000-0000-4000-8000-000000000003', 'Which programme are you on?', 'single_select',
   array['MSc Finance', 'MSc Management', 'MSc Business Analytics', 'MBA', 'Other'], true, 0),
  ('20000000-0000-4000-8000-000000000003', 'Why are you interested in Northbridge? (100 words)', 'long_text', '{}', true, 1),
  ('20000000-0000-4000-8000-000000000003', 'LinkedIn profile URL', 'short_text', '{}', false, 2);

insert into public.event_private (event_id, online_url, guest_info) values
  ('20000000-0000-4000-8000-000000000006', 'https://meet.example.com/cv-clinic', 'Have your CV open as a PDF.'),
  ('20000000-0000-4000-8000-000000000008', 'https://meet.example.com/sustainability-panel', null);

-- ─── Registrations (so counts, waitlists and guest lists have data) ──────
insert into public.registrations (event_id, user_id, ticket_type_id, status, created_at) values
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000002', 'going', now() - interval '2 days'),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000008', '30000000-0000-4000-8000-000000000002', 'going', now() - interval '1 day'),
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000001', 'going', now() - interval '3 hours'),
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', 'going', now() - interval '1 hour'),
  ('20000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000011', 'going', now() - interval '8 days');

insert into public.registrations (event_id, user_id, ticket_type_id, status, answers) values
  ('20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000008', '30000000-0000-4000-8000-000000000003', 'pending',
   '{"q":"seed"}');

update public.registrations set checked_in_at = now() - interval '6 days'
where event_id = '20000000-0000-4000-8000-000000000010';

insert into public.user_events (user_id, event_id, kind) values
  ('00000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', 'saved'),
  ('00000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000010', 'attended');

insert into public.event_interactions (event_id, user_id, kind)
select '20000000-0000-4000-8000-000000000001', null, 'view' from generate_series(1, 37);
insert into public.event_interactions (event_id, user_id, kind)
select '20000000-0000-4000-8000-000000000005', null, k
from unnest(array['view', 'view', 'view', 'apply_click', 'apply_click']) k;
