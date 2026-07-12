-- Atomaire kist-voorraad-delta zodat parallelle reserveringen niet
-- overschrijven (audit-bug K). GREATEST voorkomt negatieve aantallen.
create or replace function public.kist_voorraad_delta(p_naam text, p_delta int)
  returns int
  language plpgsql security definer
  set search_path to 'public','pg_temp'
as $$
declare
  v_nieuw int;
begin
  if p_naam is null or p_naam = '' then return null; end if;
  update public.kist_voorraad
     set aantal = greatest(0, coalesce(aantal, 0) + p_delta)
   where naam = p_naam
  returning aantal into v_nieuw;
  return v_nieuw;
end;
$$;

grant execute on function public.kist_voorraad_delta(text, int) to authenticated;

notify pgrst, 'reload schema';
