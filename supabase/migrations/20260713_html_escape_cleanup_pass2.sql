-- Tweede pass over dossiers voor rijen die drie- of vierdubbel geëscaped waren
-- (elke pass ontkoppelt één laag). Herhaalt tot geen HTML-entities meer over
-- zijn, met maximum van 5 passes als vangnet.

DO $$
DECLARE
  cols text[];
  c text;
  n_rows int;
  passes int := 0;
BEGIN
  SELECT array_agg(column_name) INTO cols
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='dossiers'
    AND data_type IN ('text','character varying');

  LOOP
    passes := passes + 1;
    n_rows := 0;
    FOREACH c IN ARRAY cols LOOP
      EXECUTE format($f$
        UPDATE public.dossiers
           SET %1$I = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(%1$I,
                      '&amp;',  '&'),
                      '&lt;',   '<'),
                      '&gt;',   '>'),
                      '&quot;', '"'),
                      '&#39;',  '''')
         WHERE %1$I IS NOT NULL
           AND %1$I ~ '&(amp|lt|gt|quot|#39);'
      $f$, c);
      GET DIAGNOSTICS n_rows = ROW_COUNT;
      IF n_rows > 0 THEN
        RAISE NOTICE 'Pass % - kolom %: % rijen', passes, c, n_rows;
      END IF;
    END LOOP;

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM information_schema.columns col
      WHERE table_schema='public' AND table_name='dossiers'
        AND data_type IN ('text','character varying')
        AND EXISTS (
          SELECT 1 FROM public.dossiers d
          WHERE (row_to_json(d) ->> col.column_name) ~ '&(amp|lt|gt|quot|#39);'
        )
    );
    EXIT WHEN passes >= 5;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
