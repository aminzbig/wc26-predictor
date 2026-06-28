-- generated seed: WC26 teams + 104 fixtures (openfootball)
delete from predictions; delete from matches; delete from teams;
insert into teams(code,name) values ('dz','Algeria') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('ar','Argentina') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('au','Australia') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('at','Austria') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('be','Belgium') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('ba','Bosnia & Herzegovina') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('br','Brazil') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('ca','Canada') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('cv','Cape Verde') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('co','Colombia') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('hr','Croatia') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('cw','Curaçao') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('cz','Czech Republic') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('cd','DR Congo') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('ec','Ecuador') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('eg','Egypt') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('gb-eng','England') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('fr','France') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('de','Germany') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('gh','Ghana') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('ht','Haiti') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('ir','Iran') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('iq','Iraq') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('ci','Ivory Coast') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('jp','Japan') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('jo','Jordan') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('mx','Mexico') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('ma','Morocco') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('nl','Netherlands') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('nz','New Zealand') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('no','Norway') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('pa','Panama') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('py','Paraguay') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('pt','Portugal') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('qa','Qatar') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('sa','Saudi Arabia') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('gb-sct','Scotland') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('sn','Senegal') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('za','South Africa') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('kr','South Korea') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('es','Spain') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('se','Sweden') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('ch','Switzerland') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('tn','Tunisia') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('tr','Turkey') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('us','USA') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('uy','Uruguay') on conflict (code) do update set name=excluded.name;
insert into teams(code,name) values ('uz','Uzbekistan') on conflict (code) do update set name=excluded.name;
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (1,'group','Group A','mx','za','Mexico','South Africa','2026-06-11T13:00:00-06:00',2,0,1,'finished');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (2,'group','Group A','kr','cz','South Korea','Czech Republic','2026-06-11T20:00:00-06:00',2,1,1,'finished');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (3,'group','Group A','cz','za','Czech Republic','South Africa','2026-06-18T12:00:00-04:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (4,'group','Group A','mx','kr','Mexico','South Korea','2026-06-18T19:00:00-06:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (5,'group','Group A','cz','mx','Czech Republic','Mexico','2026-06-24T19:00:00-06:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (6,'group','Group A','za','kr','South Africa','South Korea','2026-06-24T19:00:00-06:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (7,'group','Group B','ca','ba','Canada','Bosnia & Herzegovina','2026-06-12T15:00:00-04:00',1,1,1,'finished');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (8,'group','Group B','qa','ch','Qatar','Switzerland','2026-06-13T12:00:00-07:00',1,1,1,'finished');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (9,'group','Group B','ch','ba','Switzerland','Bosnia & Herzegovina','2026-06-18T12:00:00-07:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (10,'group','Group B','ca','qa','Canada','Qatar','2026-06-18T15:00:00-07:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (11,'group','Group B','ch','ca','Switzerland','Canada','2026-06-24T12:00:00-07:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (12,'group','Group B','ba','qa','Bosnia & Herzegovina','Qatar','2026-06-24T12:00:00-07:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (13,'group','Group C','br','ma','Brazil','Morocco','2026-06-13T18:00:00-04:00',1,1,1,'finished');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (14,'group','Group C','ht','gb-sct','Haiti','Scotland','2026-06-13T21:00:00-04:00',0,1,1,'finished');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (15,'group','Group C','gb-sct','ma','Scotland','Morocco','2026-06-19T18:00:00-04:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (16,'group','Group C','br','ht','Brazil','Haiti','2026-06-19T20:30:00-04:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (17,'group','Group C','gb-sct','br','Scotland','Brazil','2026-06-24T18:00:00-04:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (18,'group','Group C','ma','ht','Morocco','Haiti','2026-06-24T18:00:00-04:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (19,'group','Group D','us','py','USA','Paraguay','2026-06-12T18:00:00-07:00',4,1,1,'finished');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (20,'group','Group D','au','tr','Australia','Turkey','2026-06-13T21:00:00-07:00',2,0,1,'finished');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (21,'group','Group D','us','au','USA','Australia','2026-06-19T12:00:00-07:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (22,'group','Group D','tr','py','Turkey','Paraguay','2026-06-19T20:00:00-07:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (23,'group','Group D','tr','us','Turkey','USA','2026-06-25T19:00:00-07:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (24,'group','Group D','py','au','Paraguay','Australia','2026-06-25T19:00:00-07:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (25,'group','Group E','de','cw','Germany','Curaçao','2026-06-14T12:00:00-05:00',7,1,1,'finished');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (26,'group','Group E','ci','ec','Ivory Coast','Ecuador','2026-06-14T19:00:00-04:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (27,'group','Group E','de','ci','Germany','Ivory Coast','2026-06-20T16:00:00-04:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (28,'group','Group E','ec','cw','Ecuador','Curaçao','2026-06-20T19:00:00-05:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (29,'group','Group E','cw','ci','Curaçao','Ivory Coast','2026-06-25T16:00:00-04:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (30,'group','Group E','ec','de','Ecuador','Germany','2026-06-25T16:00:00-04:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (31,'group','Group F','nl','jp','Netherlands','Japan','2026-06-14T15:00:00-05:00',2,2,1,'finished');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (32,'group','Group F','se','tn','Sweden','Tunisia','2026-06-14T20:00:00-06:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (33,'group','Group F','nl','se','Netherlands','Sweden','2026-06-20T12:00:00-05:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (34,'group','Group F','tn','jp','Tunisia','Japan','2026-06-20T22:00:00-06:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (35,'group','Group F','jp','se','Japan','Sweden','2026-06-25T18:00:00-05:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (36,'group','Group F','tn','nl','Tunisia','Netherlands','2026-06-25T18:00:00-05:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (37,'group','Group G','be','eg','Belgium','Egypt','2026-06-15T12:00:00-07:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (38,'group','Group G','ir','nz','Iran','New Zealand','2026-06-15T18:00:00-07:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (39,'group','Group G','be','ir','Belgium','Iran','2026-06-21T12:00:00-07:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (40,'group','Group G','nz','eg','New Zealand','Egypt','2026-06-21T18:00:00-07:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (41,'group','Group G','eg','ir','Egypt','Iran','2026-06-26T20:00:00-07:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (42,'group','Group G','nz','be','New Zealand','Belgium','2026-06-26T20:00:00-07:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (43,'group','Group H','es','cv','Spain','Cape Verde','2026-06-15T12:00:00-04:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (44,'group','Group H','sa','uy','Saudi Arabia','Uruguay','2026-06-15T18:00:00-04:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (45,'group','Group H','es','sa','Spain','Saudi Arabia','2026-06-21T12:00:00-04:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (46,'group','Group H','uy','cv','Uruguay','Cape Verde','2026-06-21T18:00:00-04:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (47,'group','Group H','cv','sa','Cape Verde','Saudi Arabia','2026-06-26T19:00:00-05:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (48,'group','Group H','uy','es','Uruguay','Spain','2026-06-26T18:00:00-06:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (49,'group','Group I','fr','sn','France','Senegal','2026-06-16T15:00:00-04:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (50,'group','Group I','iq','no','Iraq','Norway','2026-06-16T18:00:00-04:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (51,'group','Group I','fr','iq','France','Iraq','2026-06-22T17:00:00-04:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (52,'group','Group I','no','sn','Norway','Senegal','2026-06-22T20:00:00-04:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (53,'group','Group I','no','fr','Norway','France','2026-06-26T15:00:00-04:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (54,'group','Group I','sn','iq','Senegal','Iraq','2026-06-26T15:00:00-04:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (55,'group','Group J','ar','dz','Argentina','Algeria','2026-06-16T20:00:00-05:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (56,'group','Group J','at','jo','Austria','Jordan','2026-06-16T21:00:00-07:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (57,'group','Group J','ar','at','Argentina','Austria','2026-06-22T12:00:00-05:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (58,'group','Group J','jo','dz','Jordan','Algeria','2026-06-22T20:00:00-07:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (59,'group','Group J','dz','at','Algeria','Austria','2026-06-27T21:00:00-05:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (60,'group','Group J','jo','ar','Jordan','Argentina','2026-06-27T21:00:00-05:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (61,'group','Group K','pt','cd','Portugal','DR Congo','2026-06-17T12:00:00-05:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (62,'group','Group K','uz','co','Uzbekistan','Colombia','2026-06-17T20:00:00-06:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (63,'group','Group K','pt','uz','Portugal','Uzbekistan','2026-06-23T12:00:00-05:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (64,'group','Group K','co','cd','Colombia','DR Congo','2026-06-23T20:00:00-06:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (65,'group','Group K','co','pt','Colombia','Portugal','2026-06-27T19:30:00-04:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (66,'group','Group K','cd','uz','DR Congo','Uzbekistan','2026-06-27T19:30:00-04:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (67,'group','Group L','gb-eng','hr','England','Croatia','2026-06-17T15:00:00-05:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (68,'group','Group L','gh','pa','Ghana','Panama','2026-06-17T19:00:00-04:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (69,'group','Group L','gb-eng','gh','England','Ghana','2026-06-23T16:00:00-04:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (70,'group','Group L','pa','hr','Panama','Croatia','2026-06-23T19:00:00-04:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (71,'group','Group L','pa','gb-eng','Panama','England','2026-06-27T17:00:00-04:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (72,'group','Group L','hr','gh','Croatia','Ghana','2026-06-27T17:00:00-04:00',null,null,1,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (73,'r32',null,null,null,'2A','2B','2026-06-28T12:00:00-07:00',null,null,1.5,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (74,'r32',null,null,null,'1E','3A/B/C/D/F','2026-06-29T16:30:00-04:00',null,null,1.5,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (75,'r32',null,null,null,'1F','2C','2026-06-29T19:00:00-06:00',null,null,1.5,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (76,'r32',null,null,null,'1C','2F','2026-06-29T12:00:00-05:00',null,null,1.5,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (77,'r32',null,null,null,'1I','3C/D/F/G/H','2026-06-30T17:00:00-04:00',null,null,1.5,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (78,'r32',null,null,null,'2E','2I','2026-06-30T12:00:00-05:00',null,null,1.5,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (79,'r32',null,null,null,'1A','3C/E/F/H/I','2026-06-30T19:00:00-06:00',null,null,1.5,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (80,'r32',null,null,null,'1L','3E/H/I/J/K','2026-07-01T12:00:00-04:00',null,null,1.5,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (81,'r32',null,null,null,'1D','3B/E/F/I/J','2026-07-01T17:00:00-07:00',null,null,1.5,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (82,'r32',null,null,null,'1G','3A/E/H/I/J','2026-07-01T13:00:00-07:00',null,null,1.5,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (83,'r32',null,null,null,'2K','2L','2026-07-02T19:00:00-04:00',null,null,1.5,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (84,'r32',null,null,null,'1H','2J','2026-07-02T12:00:00-07:00',null,null,1.5,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (85,'r32',null,null,null,'1B','3E/F/G/I/J','2026-07-02T20:00:00-07:00',null,null,1.5,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (86,'r32',null,null,null,'1J','2H','2026-07-03T18:00:00-04:00',null,null,1.5,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (87,'r32',null,null,null,'1K','3D/E/I/J/L','2026-07-03T20:30:00-05:00',null,null,1.5,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (88,'r32',null,null,null,'2D','2G','2026-07-03T13:00:00-05:00',null,null,1.5,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (89,'r16',null,null,null,'W74','W77','2026-07-04T17:00:00-04:00',null,null,2,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (90,'r16',null,null,null,'W73','W75','2026-07-04T12:00:00-05:00',null,null,2,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (91,'r16',null,null,null,'W76','W78','2026-07-05T16:00:00-04:00',null,null,2,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (92,'r16',null,null,null,'W79','W80','2026-07-05T18:00:00-06:00',null,null,2,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (93,'r16',null,null,null,'W83','W84','2026-07-06T14:00:00-05:00',null,null,2,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (94,'r16',null,null,null,'W81','W82','2026-07-06T17:00:00-07:00',null,null,2,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (95,'r16',null,null,null,'W86','W88','2026-07-07T12:00:00-04:00',null,null,2,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (96,'r16',null,null,null,'W85','W87','2026-07-07T13:00:00-07:00',null,null,2,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (97,'qf',null,null,null,'W89','W90','2026-07-09T16:00:00-04:00',null,null,3,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (98,'qf',null,null,null,'W93','W94','2026-07-10T12:00:00-07:00',null,null,3,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (99,'qf',null,null,null,'W91','W92','2026-07-11T17:00:00-04:00',null,null,3,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (100,'qf',null,null,null,'W95','W96','2026-07-11T20:00:00-05:00',null,null,3,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (101,'sf',null,null,null,'W97','W98','2026-07-14T14:00:00-05:00',null,null,4,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (102,'sf',null,null,null,'W99','W100','2026-07-15T15:00:00-04:00',null,null,4,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (103,'third',null,null,null,'L101','L102','2026-07-18T17:00:00-04:00',null,null,6,'scheduled');
insert into matches(match_no,stage,group_label,home_code,away_code,home_label,away_label,kickoff_at,home_score,away_score,multiplier,status) values (104,'final',null,null,null,'W101','W102','2026-07-19T15:00:00-04:00',null,null,6,'scheduled');

-- Knockout venues: fixed per FIFA match number regardless of which teams qualify
-- (group-stage venues are backfilled from API-Football; knockout matches are not).
-- Kept in sync with migration 0026_knockout_venues.sql.
update matches m
set venue_name = v.name, venue_city = v.city
from (values
  (73,'SoFi Stadium','Los Angeles'),(74,'Gillette Stadium','Boston'),(75,'Estadio BBVA','Monterrey'),
  (76,'NRG Stadium','Houston'),(77,'MetLife Stadium','New York New Jersey'),(78,'AT&T Stadium','Dallas'),
  (79,'Estadio Azteca','Mexico City'),(80,'Mercedes-Benz Stadium','Atlanta'),(81,'Levi''s Stadium','San Francisco Bay Area'),
  (82,'Lumen Field','Seattle'),(83,'BMO Field','Toronto'),(84,'SoFi Stadium','Los Angeles'),
  (85,'BC Place','Vancouver'),(86,'Hard Rock Stadium','Miami'),(87,'Arrowhead Stadium','Kansas City'),
  (88,'AT&T Stadium','Dallas'),(89,'Lincoln Financial Field','Philadelphia'),(90,'NRG Stadium','Houston'),
  (91,'MetLife Stadium','New York New Jersey'),(92,'Estadio Azteca','Mexico City'),(93,'AT&T Stadium','Dallas'),
  (94,'Lumen Field','Seattle'),(95,'Mercedes-Benz Stadium','Atlanta'),(96,'BC Place','Vancouver'),
  (97,'Gillette Stadium','Boston'),(98,'SoFi Stadium','Los Angeles'),(99,'Hard Rock Stadium','Miami'),
  (100,'Arrowhead Stadium','Kansas City'),(101,'AT&T Stadium','Dallas'),(102,'Mercedes-Benz Stadium','Atlanta'),
  (103,'Hard Rock Stadium','Miami'),(104,'MetLife Stadium','New York New Jersey')
) as v(match_no, name, city)
where m.match_no = v.match_no and m.stage <> 'group';
