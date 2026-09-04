-- Planning: één flexibele agenda-tabel voor 'wanneer moet wat' én
-- 'wanneer is wat (resource) bezet/vrij'. Een item kan een taak zijn,
-- een opbaring/rit/verzorging, of een blokkade op een resource
-- (Aula-kamer, rouwauto, medewerker).
CREATE TABLE IF NOT EXISTS public.planning_items (
  id          BIGSERIAL PRIMARY KEY,
  dossier_id  BIGINT REFERENCES public.dossiers(id) ON DELETE CASCADE,   -- optioneel
  titel       TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'taak',   -- taak | opbaring | rit | verzorging | blokkade
  resource    TEXT,                           -- bv 'Aula kamer 1', 'Rouwauto 1', medewerker
  start_ts    TIMESTAMPTZ,
  eind_ts     TIMESTAMPTZ,
  gedaan      BOOLEAN DEFAULT false,
  notitie     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  created_by  UUID DEFAULT auth.uid() REFERENCES auth.users(id),
  bijgewerkt_door TEXT
);
CREATE INDEX IF NOT EXISTS planning_items_start_idx    ON public.planning_items(start_ts);
CREATE INDEX IF NOT EXISTS planning_items_dossier_idx  ON public.planning_items(dossier_id);
CREATE INDEX IF NOT EXISTS planning_items_resource_idx ON public.planning_items(resource);

ALTER TABLE public.planning_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all" ON public.planning_items;
CREATE POLICY "auth_all" ON public.planning_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS set_updated_at ON public.planning_items;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.planning_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

NOTIFY pgrst, 'reload schema';
