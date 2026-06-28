-- Backfill venue (stadium + city) for knockout matches.
-- Group-stage venues come from API-Football (fetch-football.mjs), but knockout
-- matches have home_code/away_code = null so they never get mapped to a fixture
-- and stay venue-less. The FIFA 2026 schedule assigns a fixed stadium to each
-- knockout match *number* regardless of which teams qualify, so we set them here.
-- City names follow the FIFA host-city branding already used by API-Football
-- (e.g. SoFi -> 'Los Angeles', Gillette -> 'Boston', Estadio BBVA -> 'Monterrey').
update matches m
set venue_name = v.name, venue_city = v.city
from (values
  -- Round of 32 (73-88)
  (73,  'SoFi Stadium',            'Los Angeles'),
  (74,  'Gillette Stadium',        'Boston'),
  (75,  'Estadio BBVA',            'Monterrey'),
  (76,  'NRG Stadium',             'Houston'),
  (77,  'MetLife Stadium',         'New York New Jersey'),
  (78,  'AT&T Stadium',            'Dallas'),
  (79,  'Estadio Azteca',          'Mexico City'),
  (80,  'Mercedes-Benz Stadium',   'Atlanta'),
  (81,  'Levi''s Stadium',         'San Francisco Bay Area'),
  (82,  'Lumen Field',             'Seattle'),
  (83,  'BMO Field',               'Toronto'),
  (84,  'SoFi Stadium',            'Los Angeles'),
  (85,  'BC Place',                'Vancouver'),
  (86,  'Hard Rock Stadium',       'Miami'),
  (87,  'Arrowhead Stadium',       'Kansas City'),
  (88,  'AT&T Stadium',            'Dallas'),
  -- Round of 16 (89-96)
  (89,  'Lincoln Financial Field', 'Philadelphia'),
  (90,  'NRG Stadium',             'Houston'),
  (91,  'MetLife Stadium',         'New York New Jersey'),
  (92,  'Estadio Azteca',          'Mexico City'),
  (93,  'AT&T Stadium',            'Dallas'),
  (94,  'Lumen Field',             'Seattle'),
  (95,  'Mercedes-Benz Stadium',   'Atlanta'),
  (96,  'BC Place',                'Vancouver'),
  -- Quarter-finals (97-100)
  (97,  'Gillette Stadium',        'Boston'),
  (98,  'SoFi Stadium',            'Los Angeles'),
  (99,  'Hard Rock Stadium',       'Miami'),
  (100, 'Arrowhead Stadium',       'Kansas City'),
  -- Semi-finals (101-102)
  (101, 'AT&T Stadium',            'Dallas'),
  (102, 'Mercedes-Benz Stadium',   'Atlanta'),
  -- Third-place play-off (103)
  (103, 'Hard Rock Stadium',       'Miami'),
  -- Final (104)
  (104, 'MetLife Stadium',         'New York New Jersey')
) as v(match_no, name, city)
where m.match_no = v.match_no and m.stage <> 'group';
