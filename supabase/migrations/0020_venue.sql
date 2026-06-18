-- Match venue (stadium + city), sourced from API-Football fixture.venue.
alter table matches add column if not exists venue_name text; -- e.g. 'Estadio Azteca'
alter table matches add column if not exists venue_city text; -- e.g. 'Mexico City'
