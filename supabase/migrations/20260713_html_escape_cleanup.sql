-- Eenmalige opschoning van dubbel-geëscapete waarden in dossiers.
-- Achtergrond: op 11 plekken in het intake-formulier stond esc(v(...)) waar
-- v() al escaped. Bij submit las de browser value="Sandra &amp;amp; Lia" als
-- "Sandra &amp; Lia" en die letterlijke &amp; belandde in de DB.
--
-- Deze migratie draait 't terug: overal waar in een affected kolom &amp;,
-- &lt;, &gt;, &quot; of &#39; staat, wordt 't vervangen door het originele
-- teken. Alleen kolommen die door de bug geraakt konden zijn.

DO $$
DECLARE
  cols text[] := ARRAY[
    'bsn',
    'overlijdensplaats',
    'artsverklaring_pad',
    'overdraagformulier_pad',
    'opbaarlocatie_type',
    'benodigde_rouwgoederen',
    'verzorgd_gekleed_waar',
    'gekist_waar',
    'thanatopraxie_waar',
    'kist_type',
    'opdrachtgever_naam',
    'rouwauto'
  ];
  c text;
BEGIN
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
         AND (%1$I LIKE '%%&amp;%%'
           OR %1$I LIKE '%%&lt;%%'
           OR %1$I LIKE '%%&gt;%%'
           OR %1$I LIKE '%%&quot;%%'
           OR %1$I LIKE '%%&#39;%%')
    $f$, c);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
