-- Nieuwe notatie voor dossiernummers: 'JAAR-XXXX' i.p.v. 'SOK-JAAR-XXXX'.
-- Bestaande dossiers behouden hun oude nummer; alleen nieuwe rijen krijgen
-- het korte formaat. De volgnummer-MAX kijkt naar BEIDE notaties zodat we
-- binnen hetzelfde jaar nooit dubbele uitgeven.
--
-- Voer dit script eenmalig uit in de Supabase SQL editor.

CREATE OR REPLACE FUNCTION public.set_dossier_nummer() RETURNS TRIGGER AS $$
DECLARE
  jaar TEXT := to_char(CURRENT_DATE, 'YYYY');
  volgnr INT;
BEGIN
  IF NEW.dossier_nummer IS NULL OR NEW.dossier_nummer = '' THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(dossier_nummer FROM '[0-9]+$') AS INT)), 0) + 1
      INTO volgnr
      FROM public.dossiers
     WHERE dossier_nummer LIKE jaar || '-%'
        OR dossier_nummer LIKE 'SOK-' || jaar || '-%';
    NEW.dossier_nummer := jaar || '-' || LPAD(volgnr::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
