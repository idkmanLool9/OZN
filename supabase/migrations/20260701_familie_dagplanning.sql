-- Familie-portaal: dagplanning (tijdschema) toevoegen.
-- Een array van { tijd, moment, locatie }-objecten dat de contactpersoon
-- op de portaal-pagina ziet als tijdlijn van de uitvaartdag.
--
-- Voer dit script eenmalig uit in de Supabase SQL editor (of via de CLI).

ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS familie_dagplanning JSONB DEFAULT '[]'::jsonb;

-- RPC bijwerken zodat de anonieme portaal-lezing de dagplanning meestuurt.
CREATE OR REPLACE FUNCTION public.get_familie_portaal(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dossier_id BIGINT;
  v_result JSONB;
BEGIN
  SELECT dossier_id INTO v_dossier_id
    FROM public.familie_portaal_tokens
   WHERE token = p_token AND expires_at > now();

  IF v_dossier_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Veilige publieke subset (GEEN BSN, GEEN kosten, GEEN notities)
  SELECT jsonb_build_object(
    'dossier_nummer',     dossier_nummer,
    'voornaam',           voornaam,
    'achternaam',         achternaam,
    'geboortedatum',      geboortedatum,
    'overlijdensdatum',   overlijdensdatum,
    'uitvaart_datum',     uitvaart_datum,
    'uitvaart_tijd',      uitvaart_tijd,
    'uitvaart_type',      uitvaart_type,
    'kerk_locatie',       kerk_locatie,
    'begraafplaats',      begraafplaats,
    'parochie',           parochie,
    'priester',           priester,
    'huisbezoek_datum',   huisbezoek_datum,
    'huisbezoek_tijd',    huisbezoek_tijd,
    'avondwake_datum',    avondwake_datum,
    'avondwake_tijd',     avondwake_tijd,
    'avondwake_locatie',  avondwake_locatie,
    'condoleance_locatie',condoleance_locatie,
    'familie_checklist',  COALESCE(familie_checklist, '[]'::jsonb),
    'familie_dagplanning',COALESCE(familie_dagplanning, '[]'::jsonb),
    'familie_welkomtekst',familie_welkomtekst
  ) INTO v_result
    FROM public.dossiers
   WHERE id = v_dossier_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_familie_portaal(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_familie_portaal(TEXT) TO authenticated;
