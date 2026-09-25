-- Erst beim abgestimmten Wechsel zur neuen Website ausführen!
-- Die alte Website verliert dadurch ihren Datenzugriff. Daten bleiben erhalten.
begin;
do $$ declare t text; begin
 foreach t in array array['employees','vacations','sick_leaves'] loop
  if to_regclass('public.'||t) is not null then
   execute format('alter table public.%I enable row level security',t);
   execute format('revoke all on public.%I from public, anon, authenticated',t);
  end if;
 end loop;
end $$;
commit;
