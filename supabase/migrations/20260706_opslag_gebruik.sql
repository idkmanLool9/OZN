-- Opslaggebruik tonen in Instellingen: database-grootte + bestandsopslag.
-- SECURITY DEFINER zodat de authenticated rol ook storage.objects en de
-- databasegrootte mag uitlezen. Alleen beheerders zien dit in de UI.
create or replace function public.opslag_gebruik()
  returns json
  language plpgsql stable security definer
  set search_path to 'public','storage','pg_temp'
as $$
declare
  v_db bigint := 0;
  v_storage bigint := 0;
  v_files bigint := 0;
  v_dossiers bigint := 0;
begin
  begin v_db := pg_database_size(current_database()); exception when others then v_db := 0; end;
  begin
    select coalesce(sum((metadata->>'size')::bigint),0), count(*)
      into v_storage, v_files from storage.objects;
  exception when others then v_storage := 0; v_files := 0; end;
  begin select count(*) into v_dossiers from public.dossiers; exception when others then v_dossiers := 0; end;
  return json_build_object(
    'db_bytes', v_db,
    'storage_bytes', v_storage,
    'files', v_files,
    'dossiers', v_dossiers
  );
end;
$$;

grant execute on function public.opslag_gebruik() to authenticated;
