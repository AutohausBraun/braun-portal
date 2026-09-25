-- Braun Portal v2. In einem Testprojekt prüfen, dann koordiniert mit der Website aktivieren.
-- Bestehende Tabellen bleiben unverändert. Altzugriffe erst mit lock-legacy.sql sperren.
begin;
create table if not exists public.bp_employees (
 id uuid primary key default gen_random_uuid(), auth_user_id uuid unique references auth.users(id),
 firstname text not null check(length(trim(firstname)) between 1 and 80),
 lastname text not null check(length(trim(lastname)) between 1 and 80),
 email text not null unique check(email=lower(trim(email)) and position('@' in email)>1),
 department text not null check(length(trim(department)) between 1 and 80),
 role text not null default 'mitarbeiter' check(role in ('admin','teamleiter','mitarbeiter')),
 active boolean not null default true,
 workdays integer[] not null default array[1,2,3,4,5] check(cardinality(workdays)>0 and workdays <@ array[1,2,3,4,5,6,7]),
 created_at timestamptz not null default now()
);
create table if not exists public.bp_holidays(day date primary key, name text not null check(length(trim(name)) between 1 and 120));
create table if not exists public.bp_calendar_years(year integer primary key check(year between 2020 and 2100), region text not null);
create table if not exists public.bp_allowances (
 employee_id uuid references public.bp_employees(id), year integer check(year between 2020 and 2100),
 days integer not null check(days between 0 and 366), carry integer not null default 0 check(carry between 0 and 366),
 carry_until date not null, primary key(employee_id,year), check(extract(year from carry_until)=year)
);
create table if not exists public.bp_absences (
 id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.bp_employees(id),
 kind text not null check(kind in ('vacation','sick')), start_date date not null, end_date date not null,
 status text not null check(status in ('Offen','Genehmigt','Abgelehnt','Gemeldet','Storniert')),
 note text not null default '' check(length(note)<=500), decision_note text not null default '' check(length(decision_note)<=500),
 booked_dates date[] not null default '{}', request_key uuid not null unique,
 created_by uuid references public.bp_employees(id), decided_by uuid references public.bp_employees(id),
 created_at timestamptz not null default now(), decided_at timestamptz,
 check(end_date>=start_date and end_date-start_date<=730),
 check((kind='vacation' and status<>'Gemeldet') or (kind='sick' and status in ('Gemeldet','Storniert')))
);
create index if not exists bp_absences_employee on public.bp_absences(employee_id,start_date,end_date);
create table if not exists public.bp_audit (
 id bigint generated always as identity primary key, actor uuid references public.bp_employees(id),
 action text not null, record_id text, created_at timestamptz not null default now()
);

create or replace function public.bp_me() returns public.bp_employees
language sql stable security definer set search_path='' as $$
 select e from public.bp_employees e where e.auth_user_id=auth.uid() and e.active
$$;
create or replace function public.bp_can_read(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.bp_employees e, public.bp_me() m where e.id=target and m.id is not null
 and (m.role='admin' or m.id=e.id or (m.role='teamleiter' and e.department=m.department)))
$$;
create or replace function public.bp_claim_profile() returns public.bp_employees
language plpgsql security definer set search_path='' as $$
declare result public.bp_employees; confirmed_email text;
begin
 if auth.uid() is null then raise exception 'Bitte anmelden.'; end if;
 select lower(email) into confirmed_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if confirmed_email is null then raise exception 'Bitte zuerst die E-Mail-Adresse bestätigen.'; end if;
 update public.bp_employees set auth_user_id=auth.uid()
 where email=confirmed_email and auth_user_id is null and active;
 select * into result from public.bp_me();
 if result.id is null then raise exception 'Für diese Anmeldung ist kein aktiver Mitarbeiter freigeschaltet. Bitte den Admin kontaktieren.'; end if;
 return result;
end $$;

-- Interne Prüfung: offene Anträge reservieren Urlaub bereits. Übertrag wird chronologisch
-- nur bis zu seinem individuellen Ablaufdatum verwendet; keine automatische Rechtsannahme.
create or replace function public.bp_check_balance(target uuid) returns void
language plpgsql security definer set search_path='' as $$
declare y integer; allowance public.bp_allowances; total integer; early integer;
begin
 for y in select distinct extract(year from d)::integer from public.bp_absences a cross join lateral unnest(a.booked_dates) d
 where a.employee_id=target and a.kind='vacation' and a.status in ('Offen','Genehmigt') loop
  select * into allowance from public.bp_allowances where employee_id=target and year=y;
  if not found then raise exception 'Für % fehlt der Urlaubsanspruch.',y; end if;
  select count(*), count(*) filter(where d<=allowance.carry_until) into total,early
  from public.bp_absences a cross join lateral unnest(a.booked_dates) d
  where a.employee_id=target and a.kind='vacation' and a.status in ('Offen','Genehmigt') and extract(year from d)=y;
  if total-least(early,allowance.carry)>allowance.days then raise exception 'Der verfügbare Urlaub für % reicht nicht aus (offene Anträge sind bereits reserviert).',y; end if;
 end loop;
end $$;

create or replace function public.bp_mutate(operation text, payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me public.bp_employees; emp public.bp_employees; rec public.bp_absences;
 target uuid; record_uuid uuid; first_day date; last_day date; book date[]; y integer; desired text; entry_key uuid;
begin
 select * into me from public.bp_me();
 if me.id is null then raise exception 'Bitte mit einem aktiven Mitarbeiterkonto anmelden.'; end if;
 if operation='employee' then
  if me.role<>'admin' then raise exception 'Nur Admins dürfen Mitarbeiter verwalten.'; end if;
  target=nullif(payload->>'id','')::uuid;
  -- Sperre verhindert gleichzeitig widersprüchliche Änderungen an den Administratoren.
  perform pg_advisory_xact_lock(832041);
  if target is not null then
   select * into emp from public.bp_employees where id=target for update;
   if not found then raise exception 'Mitarbeiter wurde nicht gefunden.'; end if;
   if target=me.id and ((payload->>'role')<>'admin' or not (payload->>'active')::boolean) then raise exception 'Das eigene Admin-Konto kann hier nicht deaktiviert oder herabgestuft werden.'; end if;
   if emp.auth_user_id is not null and lower(trim(payload->>'email'))<>emp.email then raise exception 'Bei angemeldeten Konten muss eine E-Mail-Änderung über die Kontoverwaltung erfolgen.'; end if;
   update public.bp_employees set firstname=trim(payload->>'firstname'), lastname=trim(payload->>'lastname'),
    email=lower(trim(payload->>'email')), department=trim(payload->>'department'), role=payload->>'role',
    active=(payload->>'active')::boolean, workdays=array(select jsonb_array_elements_text(payload->'workdays')::integer)
   where id=target;
  else
   insert into public.bp_employees(firstname,lastname,email,department,role,active,workdays)
   values(trim(payload->>'firstname'),trim(payload->>'lastname'),lower(trim(payload->>'email')),trim(payload->>'department'),payload->>'role',
    (payload->>'active')::boolean,array(select jsonb_array_elements_text(payload->'workdays')::integer)) returning id into target;
  end if;
 elsif operation in ('allowance','absence','decision') then
  if operation='decision' then
   select employee_id into target from public.bp_absences where id=(payload->>'id')::uuid;
  else target=(payload->>'employee_id')::uuid; end if;
  select * into emp from public.bp_employees where id=target for update;
  if not found then raise exception 'Mitarbeiter wurde nicht gefunden.'; end if;
  if not public.bp_can_read(target) then raise exception 'Keine Berechtigung für diesen Mitarbeiter.'; end if;
  if operation='allowance' then
   if me.role<>'admin' then raise exception 'Nur Admins dürfen den Urlaubsanspruch ändern.'; end if;
   insert into public.bp_allowances(employee_id,year,days,carry,carry_until)
   values(target,(payload->>'year')::integer,(payload->>'days')::integer,(payload->>'carry')::integer,(payload->>'carry_until')::date)
   on conflict(employee_id,year) do update set days=excluded.days,carry=excluded.carry,carry_until=excluded.carry_until;
   perform public.bp_check_balance(target);
  elsif operation='absence' then
   perform pg_advisory_xact_lock(832042);
   if not emp.active then raise exception 'Der Mitarbeiter ist deaktiviert.'; end if;
   if me.role<>'admin' and target<>me.id then raise exception 'Anträge und Krankmeldungen können nur für sich selbst erfasst werden.'; end if;
   entry_key=(payload->>'request_key')::uuid;
   if exists(select 1 from public.bp_absences where request_key=entry_key and employee_id=target and created_by=me.id) then return jsonb_build_object('ok',true); end if;
   first_day=(payload->>'start_date')::date; last_day=(payload->>'end_date')::date;
   if first_day is null or last_day is null or last_day<first_day or last_day-first_day>730 then raise exception 'Bitte einen gültigen Zeitraum mit höchstens zwei Jahren wählen.'; end if;
   if payload->>'kind' not in ('vacation','sick') then raise exception 'Ungültige Abwesenheitsart.'; end if;
   if exists(select 1 from public.bp_absences where employee_id=target and kind=payload->>'kind'
     and status not in ('Abgelehnt','Storniert') and start_date<=last_day and end_date>=first_day) then raise exception 'Für diesen Zeitraum gibt es bereits eine gleichartige Abwesenheit.'; end if;
   book='{}';
   if payload->>'kind'='vacation' then
    for y in extract(year from first_day)::integer..extract(year from last_day)::integer loop
     if not exists(select 1 from public.bp_calendar_years where year=y) then raise exception 'Der Feiertagskalender für % ist noch nicht bestätigt.',y; end if;
    end loop;
    select coalesce(array_agg(first_day+i order by i),'{}') into book from generate_series(0,last_day-first_day) i
     where extract(isodow from first_day+i)::integer=any(emp.workdays)
     and not exists(select 1 from public.bp_holidays where day=first_day+i);
    if cardinality(book)=0 then raise exception 'Der Zeitraum enthält keinen regulären Arbeitstag.'; end if;
   end if;
   insert into public.bp_absences(employee_id,kind,start_date,end_date,status,note,booked_dates,request_key,created_by)
   values(target,payload->>'kind',first_day,last_day,case when payload->>'kind'='vacation' then 'Offen' else 'Gemeldet' end,
    case when payload->>'kind'='vacation' then coalesce(payload->>'note','') else '' end,book,entry_key,me.id) returning id into record_uuid;
   perform public.bp_check_balance(target);
  else
   select * into rec from public.bp_absences where id=(payload->>'id')::uuid for update;
   if not found then raise exception 'Eintrag wurde nicht gefunden.'; end if;
   desired=payload->>'status';
   if desired not in ('Genehmigt','Abgelehnt','Storniert') then raise exception 'Ungültiger Status.'; end if;
   if desired='Storniert' then
    if rec.status not in ('Offen','Genehmigt','Gemeldet') then raise exception 'Dieser Eintrag kann nicht mehr storniert werden.'; end if;
    if me.role<>'admin' and not (rec.employee_id=me.id and rec.status='Offen') then raise exception 'Eine bestätigte Abwesenheit kann nur der Admin stornieren.'; end if;
   else
    if rec.kind<>'vacation' or rec.status<>'Offen' then raise exception 'Nur offene Urlaubsanträge können entschieden werden.'; end if;
    if me.role not in ('admin','teamleiter') or target=me.id then raise exception 'Eigene Anträge dürfen nicht selbst freigegeben oder abgelehnt werden.'; end if;
   end if;
   update public.bp_absences set status=desired,decided_by=me.id,decided_at=now(),decision_note=coalesce(payload->>'decision_note','') where id=rec.id;
   record_uuid=rec.id;
  end if;
 elsif operation in ('holiday','calendar') then
  perform pg_advisory_xact_lock(832042);
  if me.role<>'admin' then raise exception 'Nur Admins dürfen den Kalender ändern.'; end if;
  if operation='holiday' then
   first_day=(payload->>'day')::date;
   if exists(select 1 from public.bp_absences where kind='vacation' and status in ('Offen','Genehmigt') and first_day between start_date and end_date) then
    raise exception 'Für dieses Datum bestehen Urlaubsbuchungen. Betroffene Anträge zuerst prüfen und stornieren, dann nach der Kalenderänderung neu erfassen.';
   end if;
   if coalesce((payload->>'remove')::boolean,false) then delete from public.bp_holidays where day=first_day;
   else insert into public.bp_holidays(day,name) values(first_day,trim(payload->>'name')) on conflict(day) do update set name=excluded.name; end if;
   delete from public.bp_calendar_years where year=extract(year from first_day);
  else
   insert into public.bp_calendar_years(year,region) values((payload->>'year')::integer,trim(payload->>'region')) on conflict(year) do update set region=excluded.region;
  end if;
 else raise exception 'Unbekannte Aktion.';
 end if;
 insert into public.bp_audit(actor,action,record_id) values(me.id,operation,coalesce(record_uuid::text,target::text,payload->>'day',payload->>'year'));
 return jsonb_build_object('ok',true,'id',coalesce(record_uuid,target));
end $$;

alter table public.bp_employees enable row level security;
alter table public.bp_absences enable row level security;
alter table public.bp_allowances enable row level security;
alter table public.bp_holidays enable row level security;
alter table public.bp_calendar_years enable row level security;
alter table public.bp_audit enable row level security;
drop policy if exists bp_read on public.bp_employees;
create policy bp_read on public.bp_employees for select to authenticated using(public.bp_can_read(id));
drop policy if exists bp_read on public.bp_absences;
create policy bp_read on public.bp_absences for select to authenticated using(public.bp_can_read(employee_id));
drop policy if exists bp_read on public.bp_allowances;
create policy bp_read on public.bp_allowances for select to authenticated using(public.bp_can_read(employee_id));
drop policy if exists bp_read on public.bp_holidays;
create policy bp_read on public.bp_holidays for select to authenticated using((public.bp_me()).id is not null);
drop policy if exists bp_read on public.bp_calendar_years;
create policy bp_read on public.bp_calendar_years for select to authenticated using((public.bp_me()).id is not null);
drop policy if exists bp_read on public.bp_audit;
create policy bp_read on public.bp_audit for select to authenticated using((public.bp_me()).role='admin');
revoke all on public.bp_employees,public.bp_absences,public.bp_allowances,public.bp_holidays,public.bp_calendar_years,public.bp_audit from public,anon,authenticated;
grant select on public.bp_employees,public.bp_absences,public.bp_allowances,public.bp_holidays,public.bp_calendar_years,public.bp_audit to authenticated;
revoke all on function public.bp_me(),public.bp_can_read(uuid),public.bp_claim_profile(),public.bp_check_balance(uuid),public.bp_mutate(text,jsonb) from public,anon,authenticated;
grant execute on function public.bp_me(),public.bp_can_read(uuid),public.bp_claim_profile(),public.bp_mutate(text,jsonb) to authenticated;
commit;
