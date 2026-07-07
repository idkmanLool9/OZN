-- Medewerkers mogen kosten toevoegen / bewerken / verwijderen, maar zonder
-- de prijzen te zien. De bestaande kosten_zicht view maskeert 'bedrag' al voor
-- medewerkers; we laten hier alleen de RLS van de basistabel weer open voor
-- iedereen die het onderliggende dossier mag zien. Beheerders blijven natuurlijk
-- ook toegang houden.

drop policy if exists kosten_beheer_all on public.kosten;

create policy kosten_dossier_toegang on public.kosten
  for all to authenticated
  using (
    exists (
      select 1 from public.dossiers d
      where d.id = kosten.dossier_id
        and (public.is_beheerder()
             or ((coalesce(d.status,'nieuw') <> all (array['voltooid','geannuleerd']))
                  and ((not coalesce(d.gearchiveerd,false)) or public.medewerker_ziet_archief())))
    )
  )
  with check (
    exists (
      select 1 from public.dossiers d
      where d.id = kosten.dossier_id
        and (public.is_beheerder()
             or ((coalesce(d.status,'nieuw') <> all (array['voltooid','geannuleerd']))
                  and ((not coalesce(d.gearchiveerd,false)) or public.medewerker_ziet_archief())))
    )
  );
