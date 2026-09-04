-- Extra personeel per dossier + auto-archief.
-- Wordt toegepast vóór de bijbehorende frontend live gaat (anders zou opslaan
-- met een onbekende kolom mislukken).

-- 1) Extra personeel: lijst met namen (gekozen uit de accounts/profielen).
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS extra_personeel JSONB DEFAULT '[]'::jsonb;

-- 2) Archief: een afgehandeld + gecheckt dossier gaat naar het archief.
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS gearchiveerd     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS gearchiveerd_op  TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS dossiers_gearchiveerd_idx ON public.dossiers(gearchiveerd);

-- 3) Instelling-gestuurd: mogen medewerkers het archief zien? Leest de
--    gedeelde app-instelling 'medewerker_ziet_archief' (default false).
CREATE OR REPLACE FUNCTION public.medewerker_ziet_archief()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
  SELECT COALESCE(
    (SELECT (data->>'medewerker_ziet_archief')::boolean FROM public.app_instellingen WHERE id = 1),
    false);
$$;
GRANT EXECUTE ON FUNCTION public.medewerker_ziet_archief() TO authenticated, anon;

-- 4) RLS bijwerken: medewerkers zien geen afgesloten (voltooid/geannuleerd)
--    én geen gearchiveerde dossiers — tenzij de instelling het toestaat.
DROP POLICY IF EXISTS "dossiers_select" ON public.dossiers;
CREATE POLICY "dossiers_select" ON public.dossiers FOR SELECT TO authenticated
  USING (
    public.is_beheerder() OR (
      COALESCE(status,'nieuw') NOT IN ('voltooid','geannuleerd')
      AND (NOT COALESCE(gearchiveerd,false) OR public.medewerker_ziet_archief())
    )
  );
DROP POLICY IF EXISTS "dossiers_update" ON public.dossiers;
CREATE POLICY "dossiers_update" ON public.dossiers FOR UPDATE TO authenticated
  USING (
    public.is_beheerder() OR (
      COALESCE(status,'nieuw') NOT IN ('voltooid','geannuleerd')
      AND (NOT COALESCE(gearchiveerd,false) OR public.medewerker_ziet_archief())
    )
  )
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
