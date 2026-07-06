-- Voorraadbeheer voor kisten. Eén rij per kist-naam. Beheerders muteren;
-- medewerkers zien de eigen voorraad niet (past bij de rest van de rol-scheiding).
create table if not exists public.kist_voorraad (
  naam            text primary key,
  aantal          integer not null default 0 check (aantal >= 0),
  min_aantal      integer not null default 1 check (min_aantal >= 0),
  bestel_aantal   integer,
  laatst_besteld  date,
  besteld_aantal  integer,
  opmerking       text,
  bijgewerkt_op   timestamptz not null default now(),
  bijgewerkt_door text
);
alter table public.kist_voorraad enable row level security;

drop policy if exists kv_lezen  on public.kist_voorraad;
drop policy if exists kv_schrijven on public.kist_voorraad;
create policy kv_lezen on public.kist_voorraad
  for select to authenticated using (public.is_beheerder());
create policy kv_schrijven on public.kist_voorraad
  for all to authenticated
  using (public.is_beheerder()) with check (public.is_beheerder());

grant select, insert, update, delete on public.kist_voorraad to authenticated;

create or replace function public.kist_voorraad_touch()
  returns trigger language plpgsql as $$
begin new.bijgewerkt_op := now(); return new; end;
$$;
drop trigger if exists kv_touch on public.kist_voorraad;
create trigger kv_touch before update on public.kist_voorraad
  for each row execute function public.kist_voorraad_touch();

-- Uitbreiding: levertijd + gewenst peil voor slimmere besteladvies
alter table public.kist_voorraad
  add column if not exists levertijd_dagen integer check (levertijd_dagen is null or levertijd_dagen >= 0),
  add column if not exists gewenst_peil    integer check (gewenst_peil    is null or gewenst_peil    >= 0);
