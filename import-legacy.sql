-- OPTIONAL: Übernahme aus dem alten Braun Portal, nach database.sql und holidays-bw.sql.
-- Einmalig auf leerem v2-Datenbestand. Unklare Zuordnungen brechen ALLES ab.
-- Keine alten Passwörter übernehmen. Rollen aus Altbestand vor Inbetriebnahme prüfen.
begin;
do $$
declare r jsonb; target uuid; matches integer; source_name text; first_day date; last_day date; book date[]; kind_name text; table_name text; status_name text;
begin
 if exists(select 1 from public.bp_employees) or exists(select 1 from public.bp_absences) then
  raise exception 'Import nur in einen leeren v2-Datenbestand. Keine Daten wurden geändert.';
 end if;
 if to_regclass('public.employees') is null then raise exception 'Alte Mitarbeitertabelle nicht gefunden.'; end if;
 if exists(
   select 1 from public.employees
   group by lower(trim(email))
   having count(distinct trim(firstname)||chr(31)||trim(lastname)) > 1
 ) then
   raise exception 'Dieselbe E-Mail-Adresse gehört im Altbestand zu unterschiedlichen Namen. Import abgebrochen.';
 end if;
 -- Identische Dubletten aus dem bisherigen Portal werden einmal übernommen.
 for r in execute 'select distinct on (lower(trim(email))) to_jsonb(e) from public.employees e order by lower(trim(email)), id' loop
  if nullif(trim(r->>'email'),'') is null or nullif(trim(r->>'firstname'),'') is null or nullif(trim(r->>'lastname'),'') is null then
   raise exception 'Ein alter Mitarbeitereintrag ist unvollständig. Import abgebrochen.';
  end if;
  -- Rollen werden absichtlich nicht aus dem ungeschützten Altbestand als Berechtigung übernommen.
  insert into public.bp_employees(firstname,lastname,email,department,role)
   values(trim(r->>'firstname'),trim(r->>'lastname'),lower(trim(r->>'email')),coalesce(nullif(trim(r->>'department'),''),'Nicht zugeordnet'),'mitarbeiter');
 end loop;
 -- Die bisherige Tabelle "department" enthält tatsächlich Urlaubszeiträume.
 for table_name,kind_name in select * from (values('department','vacation'),('vacations','vacation'),('sick_leaves','sick')) s(t,k) loop
  if to_regclass('public.'||table_name) is null then continue; end if;
  for r in execute format('select to_jsonb(a) from public.%I a',table_name) loop
   source_name=trim(r->>'name');
   select count(*) into matches from public.bp_employees where firstname||' '||lastname=source_name;
   if matches<>1 then raise exception 'Eine Abwesenheit kann nicht eindeutig einem Mitarbeiter zugeordnet werden. Import abgebrochen; Altbestand prüfen.'; end if;
   select id into target from public.bp_employees where firstname||' '||lastname=source_name;
   first_day=(r->>'start')::date;last_day=(r->>'end')::date;
   if first_day is null or last_day is null or last_day<first_day or last_day-first_day>730 then raise exception 'Ungültiger Zeitraum im Altbestand.'; end if;
   book='{}';
   if kind_name='vacation' then
    if exists(select 1 from generate_series(extract(year from first_day)::integer,extract(year from last_day)::integer) y
      where not exists(select 1 from public.bp_calendar_years where year=y)) then raise exception 'Für alte Urlaubseinträge fehlt ein bestätigter Feiertagskalender.'; end if;
    select coalesce(array_agg(first_day+i order by i),'{}') into book from generate_series(0,last_day-first_day) i
      where extract(isodow from first_day+i) between 1 and 5 and not exists(select 1 from public.bp_holidays where day=first_day+i);
    status_name=coalesce(nullif(r->>'status',''),'Offen');
   else status_name=coalesce(nullif(r->>'status',''),'Gemeldet'); end if;
   if status_name not in ('Abgelehnt','Storniert') and exists(select 1 from public.bp_absences where employee_id=target and kind=kind_name
      and status not in ('Abgelehnt','Storniert') and start_date<=last_day and end_date>=first_day) then raise exception 'Überlappende Einträge im Altbestand. Vor dem Import prüfen.'; end if;
   insert into public.bp_absences(employee_id,kind,start_date,end_date,status,booked_dates,request_key,note)
    values(target,kind_name,first_day,last_day,status_name,book,gen_random_uuid(),case when kind_name='vacation' then 'Aus dem bisherigen Portal übernommen; Arbeitstage Mo–Fr.' else '' end);
  end loop;
 end loop;
end $$;
commit;
