-- Audit-log (beheerder-only leesbaar) — legt alle mutaties, logins en
-- profielwissels vast. Schrijven gebeurt via een SECURITY DEFINER RPC zodat
-- medewerkers geen directe INSERT-permissie krijgen op de tabel maar wél
-- indirect via de app kunnen loggen.

create table if not exists public.audit_log (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),
  user_id       uuid,
  user_email    text,
  profiel_naam  text,
  actie         text not null,          -- 'insert' / 'update' / 'delete' / 'login' / 'logout' / 'profiel' / 'view'
  tabel         text,                    -- 'dossiers' / 'kosten' / 'notities' / null bij niet-tabel-events
  record_id     text,                    -- bigint als tekst zodat we ook composed keys kwijt kunnen
  detail        jsonb                    -- vrije context (patch, oud/nieuw, extra info)
);

create index if not exists audit_log_created_at_idx  on public.audit_log (created_at desc);
create index if not exists audit_log_tabel_record_idx on public.audit_log (tabel, record_id);

alter table public.audit_log enable row level security;

-- Alleen beheerders mogen lezen; niemand mag direct schrijven (alleen via RPC).
drop policy if exists audit_log_beheer_select on public.audit_log;
create policy audit_log_beheer_select on public.audit_log
  for select to authenticated
  using (public.is_beheerder());

-- Insert-RPC: iedere ingelogde gebruiker mag het aanroepen; body wordt door
-- de SECURITY DEFINER-context in de tabel geplaatst. Zo blijft de tabel zelf
-- afgesloten voor directe INSERT/UPDATE/DELETE.
create or replace function public.audit_log_schrijf(
    p_actie        text,
    p_tabel        text default null,
    p_record_id    text default null,
    p_detail       jsonb default null,
    p_profiel_naam text default null)
  returns void
  language plpgsql security definer
  set search_path to 'public','pg_temp'
as $$
declare
  v_uid uuid;
  v_mail text;
begin
  v_uid  := auth.uid();
  select email into v_mail from auth.users where id = v_uid;
  insert into public.audit_log (user_id, user_email, profiel_naam, actie, tabel, record_id, detail)
    values (v_uid, v_mail, p_profiel_naam, p_actie, p_tabel, p_record_id, p_detail);
end;
$$;

grant execute on function public.audit_log_schrijf(text, text, text, jsonb, text) to authenticated;
