-- Server-side vangnet tegen HTML-entity-vervuiling in dossiers.
-- Achtergrond: oude gecachte client-JS heeft nog de dubbele-escape-bug in
-- het intake-formulier. Zolang die niet ververst is, kan een &amp; alsnog
-- in de DB belanden. Deze trigger draait 't automatisch terug bij elke
-- insert/update, zodat de DB altijd schone tekst bevat ongeacht de client.

CREATE OR REPLACE FUNCTION public.dossiers_html_decode()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  j        jsonb;
  cleaned  jsonb := '{}'::jsonb;
  rec      RECORD;
  decoded  text;
BEGIN
  j := to_jsonb(NEW);
  FOR rec IN SELECT key, value FROM jsonb_each_text(j) LOOP
    IF rec.value IS NOT NULL AND rec.value ~ '&(amp|lt|gt|quot|#39);' THEN
      -- Meerdere passes: '&amp;amp;' -> '&amp;' -> '&'. Vijf ronden dekt
      -- de theoretisch mogelijke escapes ruim af.
      decoded := rec.value;
      FOR i IN 1..5 LOOP
        EXIT WHEN decoded !~ '&(amp|lt|gt|quot|#39);';
        decoded := REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(decoded,
                   '&amp;',  '&'),
                   '&lt;',   '<'),
                   '&gt;',   '>'),
                   '&quot;', '"'),
                   '&#39;',  '''');
      END LOOP;
      IF decoded <> rec.value THEN
        cleaned := cleaned || jsonb_build_object(rec.key, decoded);
      END IF;
    END IF;
  END LOOP;

  IF cleaned <> '{}'::jsonb THEN
    NEW := jsonb_populate_record(NEW, cleaned);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dossiers_html_decode ON public.dossiers;
CREATE TRIGGER trg_dossiers_html_decode
  BEFORE INSERT OR UPDATE ON public.dossiers
  FOR EACH ROW EXECUTE FUNCTION public.dossiers_html_decode();

-- En meteen bestaande vervuiling opruimen die na de vorige cleanup nog
-- door oude clients is teruggeschreven.
UPDATE public.dossiers SET id = id
 WHERE to_jsonb(dossiers.*)::text ~ '&(amp|lt|gt|quot|#39);';

NOTIFY pgrst, 'reload schema';
