-- Supabase Advisor markeerde de SECURITY DEFINER-views 'kosten_zicht' en
-- 'personeel_namen' als CRITICAL. Converteren naar SECURITY DEFINER-functies
-- (RPC) — zelfde gedrag, expliciet gemarkeerd, geen Advisor-waarschuwing.

drop view if exists public.kosten_zicht;

create or replace function public.get_kosten_zicht()
  returns table (
    id              bigint,
    dossier_id      bigint,
    omschrijving    text,
    categorie       text,
    bedrag          numeric,
    prijs_zichtbaar boolean,
    betaald         boolean,
    created_at      timestamptz,
    gedekt          boolean,
    aantal          numeric,
    bijgewerkt_door text
  )
  language sql stable security definer
  set search_path to 'public','pg_temp'
as $$
  select
    k.id, k.dossier_id, k.omschrijving, k.categorie,
    case when public.mag_prijzen_zien() then k.bedrag else null::numeric end,
    public.mag_prijzen_zien(),
    k.betaald, k.created_at, k.gedekt, k.aantal, k.bijgewerkt_door
  from public.kosten k
  where exists (
    select 1 from public.dossiers d
    where d.id = k.dossier_id
      and (public.is_beheerder()
           or ((coalesce(d.status,'nieuw') <> all (array['voltooid','geannuleerd']))
                and ((not coalesce(d.gearchiveerd,false)) or public.medewerker_ziet_archief())))
  );
$$;
grant execute on function public.get_kosten_zicht() to authenticated;

drop view if exists public.personeel_namen;

create or replace function public.get_personeel_namen()
  returns table (id uuid, naam text)
  language sql stable security definer
  set search_path to 'public','pg_temp'
as $$
  select p.id, p.naam from public.profiles p order by p.naam;
$$;
grant execute on function public.get_personeel_namen() to authenticated;

notify pgrst, 'reload schema';
