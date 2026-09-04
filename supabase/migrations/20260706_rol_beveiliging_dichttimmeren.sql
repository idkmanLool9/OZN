-- Dichttimmeren van gaten die de rol-beveiliging ondermijnden:
--  1) app_instellingen was door iedereen schrijfbaar → medewerker kon de
--     vlaggen medewerker_ziet_prijzen/-archief zelf aanzetten.
--  2) notities & documenten stonden op USING(true) → medewerker kon notities
--     en (medische) scans van verborgen dossiers lezen.
--  3) branding/kisten-buckets waren door iedereen overschrijfbaar.
--  4) profiles lekte 'rol' aan iedereen; opslag_gebruik zonder rolcheck.

-- Hulpfunctie: mag de huidige gebruiker dit dossier zien? (spiegelt dossiers_select)
create or replace function public.dossier_zichtbaar(p_id bigint)
  returns boolean language sql stable security definer
  set search_path to 'public','pg_temp'
as $$
  select exists (
    select 1 from public.dossiers d
    where d.id = p_id
      and (public.is_beheerder()
           or ((coalesce(d.status,'nieuw') <> all (array['voltooid','geannuleerd']))
                and ((not coalesce(d.gearchiveerd,false)) or public.medewerker_ziet_archief())))
  );
$$;
grant execute on function public.dossier_zichtbaar(bigint) to authenticated;

-- 1) app_instellingen: iedereen (ingelogd) mag lezen (branding nodig), alleen
--    beheerder mag schrijven. Zo zijn de rol-vlaggen niet meer vervalsbaar.
drop policy if exists app_instellingen_all_auth on public.app_instellingen;
drop policy if exists app_instellingen_select  on public.app_instellingen;
drop policy if exists app_instellingen_write   on public.app_instellingen;
create policy app_instellingen_select on public.app_instellingen
  for select to authenticated using (true);
create policy app_instellingen_write on public.app_instellingen
  for all to authenticated using (public.is_beheerder()) with check (public.is_beheerder());

-- 2a) notities: alleen van zichtbare dossiers
drop policy if exists auth_all on public.notities;
drop policy if exists notities_zicht on public.notities;
create policy notities_zicht on public.notities
  for all to authenticated
  using (public.dossier_zichtbaar(dossier_id))
  with check (public.dossier_zichtbaar(dossier_id));

-- 2b) documenten: alleen van zichtbare dossiers
drop policy if exists auth_all on public.documenten;
drop policy if exists documenten_zicht on public.documenten;
create policy documenten_zicht on public.documenten
  for all to authenticated
  using (public.dossier_zichtbaar(dossier_id))
  with check (public.dossier_zichtbaar(dossier_id));

-- 3) storage: lezen open houden (public buckets), schrijven alleen beheerder.
drop policy if exists auth_branding_insert on storage.objects;
drop policy if exists auth_branding_update on storage.objects;
drop policy if exists auth_branding_delete on storage.objects;
create policy auth_branding_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and public.is_beheerder());
create policy auth_branding_update on storage.objects for update to authenticated
  using (bucket_id = 'branding' and public.is_beheerder())
  with check (bucket_id = 'branding' and public.is_beheerder());
create policy auth_branding_delete on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and public.is_beheerder());

drop policy if exists auth_kisten_insert on storage.objects;
drop policy if exists auth_kisten_update on storage.objects;
drop policy if exists auth_kisten_delete on storage.objects;
create policy auth_kisten_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'kisten' and public.is_beheerder());
create policy auth_kisten_update on storage.objects for update to authenticated
  using (bucket_id = 'kisten' and public.is_beheerder())
  with check (bucket_id = 'kisten' and public.is_beheerder());
create policy auth_kisten_delete on storage.objects for delete to authenticated
  using (bucket_id = 'kisten' and public.is_beheerder());

-- 4a) profiles: 'rol' niet meer aan iedereen lekken. Medewerker ziet enkel
--     eigen rij; beheerder ziet alles. De personeelskiezer gebruikt de view.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_beheerder());

-- Alleen id + naam voor de "extra personeel"-kiezer (geen rol-lek).
drop view if exists public.personeel_namen;
create view public.personeel_namen as select id, naam from public.profiles;
grant select on public.personeel_namen to authenticated;

-- 4b) opslag_gebruik alleen voor beheerders (UI-gate is geen beveiliging).
create or replace function public.opslag_gebruik()
  returns json language plpgsql stable security definer
  set search_path to 'public','storage','pg_temp'
as $$
declare
  v_db bigint := 0; v_storage bigint := 0; v_files bigint := 0; v_dossiers bigint := 0;
begin
  if not public.is_beheerder() then raise exception 'alleen beheerder'; end if;
  begin v_db := pg_database_size(current_database()); exception when others then v_db := 0; end;
  begin
    select coalesce(sum((metadata->>'size')::bigint),0), count(*)
      into v_storage, v_files from storage.objects;
  exception when others then v_storage := 0; v_files := 0; end;
  begin select count(*) into v_dossiers from public.dossiers; exception when others then v_dossiers := 0; end;
  return json_build_object('db_bytes', v_db, 'storage_bytes', v_storage, 'files', v_files, 'dossiers', v_dossiers);
end;
$$;
grant execute on function public.opslag_gebruik() to authenticated;
