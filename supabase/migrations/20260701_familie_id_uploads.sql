-- Familie-portaal: optionele ID-kaart-upload door de familie.
-- De contactpersoon kan via de portal een foto van de identiteitskaart
-- uploaden — voor- en achterkant, van de overledene én van zichzelf.
-- Opgeslagen als base64 data-URL in een aparte tabel (klein gecomprimeerd),
-- token-beveiligd via een SECURITY DEFINER RPC (geen login nodig, maar wel
-- een geldige portaal-token).
--
-- Voer dit script eenmalig uit in de Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.familie_id_uploads (
  id BIGSERIAL PRIMARY KEY,
  dossier_id BIGINT NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  slot TEXT NOT NULL,          -- overledene_voor | overledene_achter | contact_voor | contact_achter
  data_url TEXT NOT NULL,      -- data:image/jpeg;base64,...
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (dossier_id, slot)
);
CREATE INDEX IF NOT EXISTS familie_id_uploads_dossier_idx
  ON public.familie_id_uploads(dossier_id);

ALTER TABLE public.familie_id_uploads ENABLE ROW LEVEL SECURITY;
-- Ingelogde uitvaartleiders mogen alles beheren; anon NIETS direct
-- (alleen via de token-beveiligde RPC hieronder).
DROP POLICY IF EXISTS "auth_all_id_uploads" ON public.familie_id_uploads;
CREATE POLICY "auth_all_id_uploads" ON public.familie_id_uploads
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RPC: anonieme upload met token. Verifieert token + verloop, valideert de
-- afbeelding, en upsert de slot. Retourneert { ok: bool, error?: text }.
CREATE OR REPLACE FUNCTION public.familie_portaal_upload_id(
  p_token TEXT, p_slot TEXT, p_data_url TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_dossier_id BIGINT;
BEGIN
  IF p_slot NOT IN ('overledene_voor','overledene_achter','contact_voor','contact_achter') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ongeldige_slot');
  END IF;
  -- Alleen afbeeldingen; ruwe bovengrens ~4MB base64 (voorkomt misbruik)
  IF p_data_url IS NULL OR p_data_url NOT LIKE 'data:image/%'
     OR length(p_data_url) > 4000000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ongeldige_afbeelding');
  END IF;
  SELECT dossier_id INTO v_dossier_id
    FROM public.familie_portaal_tokens
   WHERE token = p_token AND expires_at > now();
  IF v_dossier_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ongeldige_link');
  END IF;

  INSERT INTO public.familie_id_uploads (dossier_id, slot, data_url, uploaded_at)
    VALUES (v_dossier_id, p_slot, p_data_url, now())
  ON CONFLICT (dossier_id, slot) DO UPDATE
    SET data_url = EXCLUDED.data_url, uploaded_at = now();

  RETURN jsonb_build_object('ok', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.familie_portaal_upload_id(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.familie_portaal_upload_id(TEXT, TEXT, TEXT) TO authenticated;

-- get_familie_portaal uitbreiden met de status van de ID-uploads (alleen
-- WELKE slots gevuld zijn + wanneer — niet de afbeeldingen zelf, klein houden).
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
    'familie_welkomtekst',familie_welkomtekst,
    'familie_id_status', (
      SELECT COALESCE(jsonb_object_agg(slot, uploaded_at), '{}'::jsonb)
        FROM public.familie_id_uploads WHERE dossier_id = v_dossier_id
    )
  ) INTO v_result
    FROM public.dossiers
   WHERE id = v_dossier_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_familie_portaal(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_familie_portaal(TEXT) TO authenticated;
