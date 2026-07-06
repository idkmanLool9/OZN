-- Familie-portaal volledig verwijderd uit de app. Deze migratie ruimt de
-- (lege) database-objecten op. Veilig op het frisse OZN-project; draai
-- alleen als je zeker weet dat je het familie-portaal niet meer gebruikt.
DROP FUNCTION IF EXISTS public.familie_portaal_upload_id(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_familie_portaal(TEXT);
DROP TABLE IF EXISTS public.familie_id_uploads;
DROP TABLE IF EXISTS public.familie_portaal_tokens;
ALTER TABLE public.dossiers
  DROP COLUMN IF EXISTS familie_checklist,
  DROP COLUMN IF EXISTS familie_dagplanning,
  DROP COLUMN IF EXISTS familie_welkomtekst;
NOTIFY pgrst, 'reload schema';
