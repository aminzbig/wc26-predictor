-- Italy didn't qualify, but allow it as a profile flag choice.
insert into teams(code, name) values ('it', 'Italy') on conflict (code) do nothing;
