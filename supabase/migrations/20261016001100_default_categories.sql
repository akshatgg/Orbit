-- Default event categories every ORBIT database starts with. Admins can edit them later.
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
