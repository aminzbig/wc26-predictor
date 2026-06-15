-- Default every player's flag to Iran; they can change it in the profile page.
alter table players alter column flag_code set default 'ir';
update players set flag_code = 'ir' where flag_code is null;
