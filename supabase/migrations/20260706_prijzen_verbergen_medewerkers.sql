-- Prijzen (bedrag) server-side verbergen voor medewerkers.
-- Beheerders (of wanneer de instelling 'medewerker_ziet_prijzen' aanstaat)
-- zien alle bedragen; gewone medewerkers zien de kostenposten wél maar
-- zonder euro's, en kunnen posten aftikken via een RPC.

-- 1) Helper: mag de huidige gebruiker prijzen zien?
create or replace function public.mag_prijzen_zien()
  returns boolean
  language sql stable security definer
  set search_path to 'public','pg_temp'
as $$
  select public.is_beheerder() or coalesce(
    (select (data->>'medewerker_ziet_prijzen')::boolean
       from public.app_instellingen where id = 1), false);
$$;

-- 2) Gemaskeerde, rij-gefilterde weergave op kosten.
--    Definer-rechten (security_invoker uit = standaard): de eigenaar
--    (postgres) leest de basistabel; de CASE maskeert bedrag per gebruiker.
--    De WHERE spiegelt exact het zicht van dossiers_select.
drop view if exists public.kosten_zicht;
create view public.kosten_zicht as
  select
    k.id, k.dossier_id, k.omschrijving, k.categorie,
    case when public.mag_prijzen_zien() then k.bedrag else null::numeric end as bedrag,
    public.mag_prijzen_zien() as prijs_zichtbaar,
    k.betaald, k.created_at, k.gedekt, k.aantal, k.bijgewerkt_door
  from public.kosten k
  where exists (
    select 1 from public.dossiers d
    where d.id = k.dossier_id
      and (public.is_beheerder()
           or ((coalesce(d.status,'nieuw') <> all (array['voltooid','geannuleerd']))
                and ((not coalesce(d.gearchiveerd,false)) or public.medewerker_ziet_archief())))
  );

grant select on public.kosten_zicht to authenticated;

-- 3) Basistabel afsluiten: alleen beheerders hebben direct toegang.
--    Medewerkers lezen via kosten_zicht en tikken af via de RPC hieronder.
drop policy if exists auth_all on public.kosten;
drop policy if exists kosten_beheer_all on public.kosten;
create policy kosten_beheer_all on public.kosten
  for all to authenticated
  using (public.is_beheerder())
  with check (public.is_beheerder());

-- 4) RPC: kostenposten van één dossier als betaald/onbetaald markeren.
--    Werkt voor iedereen die het dossier mag zien (medewerker mag aftikken),
--    zonder direct schrijfrecht op de kosten-tabel.
create or replace function public.kosten_zet_betaald_dossier(
    p_dossier_id bigint, p_betaald boolean)
  returns void
  language plpgsql security definer
  set search_path to 'public','pg_temp'
as $$
begin
  if not exists (
    select 1 from public.dossiers d
    where d.id = p_dossier_id
      and (public.is_beheerder()
           or ((coalesce(d.status,'nieuw') <> all (array['voltooid','geannuleerd']))
                and ((not coalesce(d.gearchiveerd,false)) or public.medewerker_ziet_archief())))
  ) then
    raise exception 'geen toegang tot dit dossier';
  end if;
  update public.kosten set betaald = p_betaald where dossier_id = p_dossier_id;
end;
$$;

grant execute on function public.kosten_zet_betaald_dossier(bigint, boolean) to authenticated;
grant execute on function public.mag_prijzen_zien() to authenticated;
