-- Ledenadministratie: gezinnen (huishoudens) + leden (personen).
-- De centrale ledenregistratie van de parochie/klooster. Elk gezin heeft een
-- gezinsnummer (waaraan uitvaartdossiers gekoppeld kunnen worden) en bevat
-- één of meer leden (personen) met o.a. doopgegevens.
--
-- Voer dit script eenmalig uit in de Supabase SQL editor.

-- ── Gezinnen (huishoudens) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gezinnen (
  id              BIGSERIAL PRIMARY KEY,
  gezinsnummer    TEXT UNIQUE,
  familienaam     TEXT,
  adres           TEXT,
  postcode        TEXT,
  woonplaats      TEXT,
  telefoon        TEXT,
  email           TEXT,
  parochie        TEXT,
  status          TEXT NOT NULL DEFAULT 'actief',   -- actief | inactief | verhuisd
  notities        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID DEFAULT auth.uid() REFERENCES auth.users(id),
  bijgewerkt_door TEXT
);

-- ── Leden (personen binnen een gezin) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.leden (
  id               BIGSERIAL PRIMARY KEY,
  gezin_id         BIGINT REFERENCES public.gezinnen(id) ON DELETE CASCADE,
  voornaam         TEXT,
  achternaam       TEXT,
  doopnaam         TEXT,
  geslacht         TEXT,
  geboortedatum    DATE,
  geboorteplaats   TEXT,
  relatie          TEXT,                             -- hoofd | partner | kind | inwonend | overig
  telefoon         TEXT,
  email            TEXT,
  doopdatum        DATE,
  doopplaats       TEXT,
  status           TEXT NOT NULL DEFAULT 'actief',   -- actief | overleden | verhuisd
  overlijdensdatum DATE,
  notities         TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       UUID DEFAULT auth.uid() REFERENCES auth.users(id),
  bijgewerkt_door  TEXT
);

CREATE INDEX IF NOT EXISTS leden_gezin_id_idx        ON public.leden(gezin_id);
CREATE INDEX IF NOT EXISTS gezinnen_gezinsnummer_idx ON public.gezinnen(gezinsnummer);

-- ── Row Level Security: ingelogde uitvaartleiders mogen alles ────────────────
ALTER TABLE public.gezinnen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leden    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON public.gezinnen;
CREATE POLICY "auth_all" ON public.gezinnen FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all" ON public.leden;
CREATE POLICY "auth_all" ON public.leden FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── updated_at automatisch bijwerken bij elke UPDATE ─────────────────────────
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS set_updated_at ON public.gezinnen;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.gezinnen
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.leden;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.leden
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
