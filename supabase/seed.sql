-- Starter categories. Run after the init migration.
insert into public.categories (slug, name, "group") values
  ('employer-presentation', 'Employer presentation', 'career'),
  ('careers-fair',          'Careers fair',          'career'),
  ('workshop',              'Workshop',              'career'),
  ('competition',           'Competition',           'career'),
  ('networking',            'Networking',            'social'),
  ('society',               'Society event',         'social'),
  ('social',                'Social',                'social'),
  ('fitness',               'Fitness & sport',       'other'),
  ('entrepreneurship',      'Entrepreneurship',      'other'),
  ('sustainability',        'Sustainability',        'other')
on conflict (slug) do nothing;
