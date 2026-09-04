-- Security lock — audit-rapport 2026-07-09
-- ================================================
-- Sluit vier RLS-gaten en dwingt prijs-integriteit af.

-- 1) planning_items: alleen actieve, niet-gearchiveerde dossiers of tenzij
--    de gebruiker beheerder is c.q. medewerker_ziet_archief aanstaat.
drop policy if exists auth_all on public.planning_items;
create policy planning_items_dossier_gate on public.planning_items
  for all to authenticated
  using (
    dossier_id is null
    or exists (
      select 1 from public.dossiers d
      where d.id = planning_items.dossier_id
        and (public.is_beheerder()
             or ((coalesce(d.status,'nieuw') <> all (array['voltooid','geannuleerd']))
                  and ((not coalesce(d.gearchiveerd,false)) or public.medewerker_ziet_archief())))
    )
  )
  with check (
    dossier_id is null
    or exists (
      select 1 from public.dossiers d
      where d.id = planning_items.dossier_id
        and (public.is_beheerder()
             or ((coalesce(d.status,'nieuw') <> all (array['voltooid','geannuleerd']))
                  and ((not coalesce(d.gearchiveerd,false)) or public.medewerker_ziet_archief())))
    )
  );

-- 2) dossiers: WITH CHECK dichttimmeren. Medewerker mag géén status naar
--    voltooid/geannuleerd zetten en géén gearchiveerd toggle-en; alleen
--    beheerder mag dat. Overige velden mag medewerker wel bewerken.
drop policy if exists dossiers_update on public.dossiers;
create policy dossiers_update on public.dossiers
  for update to authenticated
  using (
    public.is_beheerder()
    or ((coalesce(status,'nieuw') <> all (array['voltooid','geannuleerd']))
        and ((not coalesce(gearchiveerd,false)) or public.medewerker_ziet_archief()))
  );

create or replace function public.dossiers_update_guard()
  returns trigger
  language plpgsql
  set search_path to 'public','pg_temp'
as $$
begin
  if public.is_beheerder() then
    return new;
  end if;
  -- Medewerker mag status niet naar voltooid/geannuleerd zetten
  if new.status is distinct from old.status
     and new.status in ('voltooid','geannuleerd') then
    raise exception 'alleen beheerder mag dossier voltooien of annuleren';
  end if;
  -- Medewerker mag gearchiveerd niet aan-/uitzetten
  if coalesce(new.gearchiveerd,false) is distinct from coalesce(old.gearchiveerd,false) then
    raise exception 'alleen beheerder mag archiveren of terughalen';
  end if;
  return new;
end;
$$;

drop trigger if exists dossiers_update_guard_trg on public.dossiers;
create trigger dossiers_update_guard_trg
  before update on public.dossiers
  for each row execute function public.dossiers_update_guard();

-- 3) kosten.bedrag: medewerker mag geen bedragen schrijven — trigger forceert
--    NULL bij INSERT en verhindert wijziging bij UPDATE. Beheerders gaan vrij.
create or replace function public.kosten_bedrag_guard()
  returns trigger
  language plpgsql
  set search_path to 'public','pg_temp'
as $$
begin
  if public.is_beheerder() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.bedrag := null;
  elsif tg_op = 'UPDATE' then
    -- niet-beheerder mag bedrag niet wijzigen
    if new.bedrag is distinct from old.bedrag then
      new.bedrag := old.bedrag;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists kosten_bedrag_guard_trg on public.kosten;
create trigger kosten_bedrag_guard_trg
  before insert or update on public.kosten
  for each row execute function public.kosten_bedrag_guard();

-- 4) kist_afbeeldingen: schrijven alleen door beheerder.
drop policy if exists auth_all on public.kist_afbeeldingen;
drop policy if exists kist_afbeeldingen_all on public.kist_afbeeldingen;
create policy kist_afbeeldingen_select on public.kist_afbeeldingen
  for select to authenticated using (true);
create policy kist_afbeeldingen_write on public.kist_afbeeldingen
  for all to authenticated
  using (public.is_beheerder())
  with check (public.is_beheerder());

-- 5) Storage-buckets: documenten en overledenen aan dossier-toegang koppelen.
--    Ons pad-model: '{dossier_id}/…' — de eerste segment van storage.name
--    bevat het dossier_id. Als het pad geen prefix heeft (bv. app-instelling
--    logo's), gaat 'ie alleen door voor beheerder.
create or replace function public.storage_dossier_gate(name text)
  returns boolean
  language plpgsql stable
  set search_path to 'public','pg_temp'
as $$
declare
  first_seg text;
  did       bigint;
begin
  if name is null then return false; end if;
  first_seg := split_part(name, '/', 1);
  begin
    did := first_seg::bigint;
  exception when others then
    -- geen dossier-id prefix → alleen beheerder mag
    return public.is_beheerder();
  end;
  return exists (
    select 1 from public.dossiers d
    where d.id = did
      and (public.is_beheerder()
           or ((coalesce(d.status,'nieuw') <> all (array['voltooid','geannuleerd']))
                and ((not coalesce(d.gearchiveerd,false)) or public.medewerker_ziet_archief())))
  );
end;
$$;

-- documenten: privé bucket
drop policy if exists auth_documenten_select on storage.objects;
drop policy if exists auth_documenten_insert on storage.objects;
drop policy if exists auth_documenten_update on storage.objects;
drop policy if exists auth_documenten_delete on storage.objects;
drop policy if exists documenten_gate on storage.objects;
create policy documenten_gate on storage.objects
  for all to authenticated
  using (bucket_id = 'documenten' and public.storage_dossier_gate(name))
  with check (bucket_id = 'documenten' and public.storage_dossier_gate(name));

-- overledenen: publieke bucket voor rouwkaart-foto's, maar SCHRIJVEN via
-- dossier-gate zodat medewerkers elkaars foto's niet overschrijven.
drop policy if exists auth_overledenen_select on storage.objects;
drop policy if exists auth_overledenen_insert on storage.objects;
drop policy if exists auth_overledenen_update on storage.objects;
drop policy if exists auth_overledenen_delete on storage.objects;
drop policy if exists overledenen_read on storage.objects;
drop policy if exists overledenen_write on storage.objects;
create policy overledenen_read on storage.objects
  for select to authenticated
  using (bucket_id = 'overledenen');
create policy overledenen_write on storage.objects
  for all to authenticated
  using (bucket_id = 'overledenen' and public.storage_dossier_gate(name))
  with check (bucket_id = 'overledenen' and public.storage_dossier_gate(name));

-- backups: alleen beheerder. (Ook expliciet in git zodat het reproduceerbaar is.)
drop policy if exists backups_beheer on storage.objects;
create policy backups_beheer on storage.objects
  for all to authenticated
  using (bucket_id = 'backups' and public.is_beheerder())
  with check (bucket_id = 'backups' and public.is_beheerder());

-- Laat PostgREST de nieuwe policies + kolommen oppikken.
notify pgrst, 'reload schema';
