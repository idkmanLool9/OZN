-- ====================================================================
-- Uitvaartbeheer SOK Antiochië — Supabase schema
-- Plak dit in: Supabase dashboard → SQL Editor → New query → Run
-- Dit script is idempotent: meerdere keren runnen is veilig.
-- ====================================================================

-- ──────────────────────────────────────────────────────────────────
-- 1. Tabellen
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dossiers (
  id BIGSERIAL PRIMARY KEY,
  dossier_nummer TEXT UNIQUE,
  status TEXT DEFAULT 'nieuw',

  -- Overledene
  voornaam TEXT, achternaam TEXT, doopnaam TEXT, geslacht TEXT,
  geboortedatum DATE, geboorteplaats TEXT,
  overlijdensdatum DATE, overlijdenstijd TEXT, overlijdensplaats TEXT,
  adres_overledene TEXT, postcode_overledene TEXT, woonplaats_overledene TEXT,
  bsn TEXT, burgerlijke_staat TEXT, nationaliteit TEXT, beroep TEXT,
  syrisch_orthodox_lid TEXT, gezinsnummer TEXT, grafnummer TEXT,

  -- Contactpersoon
  contact_naam TEXT, contact_voornaam TEXT, contact_relatie TEXT,
  contact_telefoon TEXT, contact_email TEXT,
  contact_adres TEXT, contact_postcode TEXT, contact_woonplaats TEXT,

  -- Kerkelijk
  parochie TEXT, priester TEXT,
  huisbezoek_datum DATE, huisbezoek_tijd TEXT,
  avondwake_datum DATE, avondwake_tijd TEXT, avondwake_locatie TEXT,

  -- Uitvaart
  uitvaart_type TEXT, uitvaart_datum DATE, uitvaart_tijd TEXT,
  kerk_locatie TEXT, begraafplaats TEXT, graf_type TEXT,

  -- Logistiek
  kist_type TEXT, rouwauto TEXT, aantal_volgauto TEXT,
  dragers TEXT, bloemstukken TEXT, rouwkaarten_aantal TEXT,
  condoleance_locatie TEXT, catering TEXT, muziek_zang TEXT,

  -- Verzekering
  verzekering_status TEXT, verzekering_maatschappij TEXT, polisnummer TEXT,
  opdrachtgever_naam TEXT, opdrachtgever_telefoon TEXT,

  bijzonderheden TEXT,
  handtekeningen JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Voor bestaande databases: kolom achteraf toevoegen
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS handtekeningen JSONB DEFAULT '{}'::jsonb;

-- Verzekering-uitbreiding (alleen relevant bij 'met verzekering')
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS verzekering_polishouder TEXT,
  ADD COLUMN IF NOT EXISTS verzekering_dekking NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS verzekering_pakket TEXT,
  ADD COLUMN IF NOT EXISTS verzekering_aanmelding_status TEXT,
  ADD COLUMN IF NOT EXISTS verzekering_contact_naam TEXT,
  ADD COLUMN IF NOT EXISTS verzekering_contact_telefoon TEXT;

-- Betaling (alleen relevant bij 'zonder verzekering')
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS betaalwijze TEXT,
  ADD COLUMN IF NOT EXISTS aanbetaling_bedrag NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS aanbetaling_datum DATE,
  ADD COLUMN IF NOT EXISTS eindafrekening_bedrag NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS eindafrekening_status TEXT,
  ADD COLUMN IF NOT EXISTS betalingstermijn TEXT,
  ADD COLUMN IF NOT EXISTS verantwoordelijke_persoon TEXT;

-- Kosten: 'gedekt door verzekering' markering
ALTER TABLE public.kosten
  ADD COLUMN IF NOT EXISTS gedekt BOOLEAN DEFAULT false;

-- Kosten: aantal (voor per-stuk-posten zoals 'Smiet broodje per stuk')
-- Stukprijs wordt afgeleid uit bedrag/aantal; bedrag blijft het totaal.
ALTER TABLE public.kosten
  ADD COLUMN IF NOT EXISTS aantal NUMERIC(10,2) DEFAULT 1;

-- Foto van de overledene (optioneel) — voor rouwkaart en dossier-overzicht
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS foto_overledene_pad TEXT;

-- Gerenderde paspoort-card visualisatie (door Android app gemaakt) —
-- toont het hele paspoort in originele NL-layout. Pad naar overledenen/
-- bucket; webapp kan via getPublicUrl ophalen.
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS paspoort_kaart_pad TEXT;

-- Tracking: welk lokaal profiel (Rume / Robert) deed de laatste wijziging?
-- Wordt automatisch geset door de client (ActiveProfile.current().name) bij
-- elke insert/update op dossiers. Notities en kosten gebruiken hun eigen
-- 'auteur'-veld.
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS bijgewerkt_door TEXT;

ALTER TABLE public.kosten
  ADD COLUMN IF NOT EXISTS bijgewerkt_door TEXT;

ALTER TABLE public.documenten
  ADD COLUMN IF NOT EXISTS bijgewerkt_door TEXT;

-- PostgREST-cache vernieuwen zodat de nieuwe kolommen meteen bruikbaar zijn
NOTIFY pgrst, 'reload schema';

-- Aangifte-formulier (papieren formulier "Aangifte van overlijden")
ALTER TABLE public.dossiers
  -- Overledene: partner + kinderen
  ADD COLUMN IF NOT EXISTS partner_naam TEXT,
  ADD COLUMN IF NOT EXISTS kinderen_status TEXT,         -- 'ja' / 'nee'
  ADD COLUMN IF NOT EXISTS minderjarige_kinderen TEXT,   -- 'ja' / 'nee'
  ADD COLUMN IF NOT EXISTS kinderen_namen TEXT,
  -- Contactpersoon: aanvullingen
  ADD COLUMN IF NOT EXISTS contact_bsn TEXT,
  ADD COLUMN IF NOT EXISTS contact_geboortedatum DATE,
  ADD COLUMN IF NOT EXISTS contact_huisnummer TEXT,
  -- Aangever (vaak zelfde als contactpersoon)
  ADD COLUMN IF NOT EXISTS aangever_zelfde_als_contact TEXT, -- 'ja' / 'nee'
  ADD COLUMN IF NOT EXISTS aangever_naam TEXT,
  ADD COLUMN IF NOT EXISTS aangever_geboortedatum DATE,
  ADD COLUMN IF NOT EXISTS aangever_geboorteplaats TEXT,
  -- Aangifte: status + toestemming + datum
  ADD COLUMN IF NOT EXISTS akte_overlijden TEXT,         -- 'ja' / 'nee'
  ADD COLUMN IF NOT EXISTS publicatie_krant TEXT,        -- 'wel' / 'geen'
  ADD COLUMN IF NOT EXISTS aangifte_datum DATE;

-- Storage-bucket 'overledenen' (publiek) voor foto's gebruikt op rouwkaarten
INSERT INTO storage.buckets (id, name, public)
VALUES ('overledenen', 'overledenen', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "auth_overledenen_insert" ON storage.objects;
CREATE POLICY "auth_overledenen_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'overledenen');

DROP POLICY IF EXISTS "auth_overledenen_select" ON storage.objects;
CREATE POLICY "auth_overledenen_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'overledenen');

DROP POLICY IF EXISTS "auth_overledenen_update" ON storage.objects;
CREATE POLICY "auth_overledenen_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'overledenen')
  WITH CHECK (bucket_id = 'overledenen');

DROP POLICY IF EXISTS "auth_overledenen_delete" ON storage.objects;
CREATE POLICY "auth_overledenen_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'overledenen');

CREATE TABLE IF NOT EXISTS public.taken (
  id BIGSERIAL PRIMARY KEY,
  dossier_id BIGINT NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  omschrijving TEXT NOT NULL,
  deadline DATE,
  voltooid BOOLEAN DEFAULT false,
  voltooid_op TIMESTAMPTZ,
  volgorde INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kosten (
  id BIGSERIAL PRIMARY KEY,
  dossier_id BIGINT NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  omschrijving TEXT NOT NULL,
  categorie TEXT,
  bedrag NUMERIC(10,2) DEFAULT 0,
  betaald BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notities (
  id BIGSERIAL PRIMARY KEY,
  dossier_id BIGINT NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  tekst TEXT NOT NULL,
  auteur TEXT,
  auteur_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.documenten (
  id BIGSERIAL PRIMARY KEY,
  dossier_id BIGINT NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  naam TEXT NOT NULL,
  type TEXT,
  storage_pad TEXT NOT NULL,
  grootte BIGINT,
  geupload_op TIMESTAMPTZ DEFAULT now(),
  geupload_door UUID REFERENCES auth.users(id)
);

-- ──────────────────────────────────────────────────────────────────
-- 2. Triggers: automatisch dossiernummer + updated_at
-- ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_dossier_nummer() RETURNS TRIGGER AS $$
DECLARE
  jaar TEXT := to_char(CURRENT_DATE, 'YYYY');
  volgnr INT;
BEGIN
  IF NEW.dossier_nummer IS NULL OR NEW.dossier_nummer = '' THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(dossier_nummer FROM '[0-9]+$') AS INT)), 0) + 1
      INTO volgnr
      FROM public.dossiers
     WHERE dossier_nummer LIKE 'SOK-' || jaar || '-%';
    NEW.dossier_nummer := 'SOK-' || jaar || '-' || LPAD(volgnr::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dossier_nummer ON public.dossiers;
CREATE TRIGGER trg_dossier_nummer
  BEFORE INSERT ON public.dossiers
  FOR EACH ROW EXECUTE FUNCTION public.set_dossier_nummer();

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dossiers_updated_at ON public.dossiers;
CREATE TRIGGER trg_dossiers_updated_at
  BEFORE UPDATE ON public.dossiers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────────────────────────
-- 3. Row Level Security: alleen ingelogde gebruikers
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE public.dossiers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taken      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kosten     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notities   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documenten ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all" ON public.dossiers;
CREATE POLICY "auth_all" ON public.dossiers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all" ON public.taken;
CREATE POLICY "auth_all" ON public.taken
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all" ON public.kosten;
CREATE POLICY "auth_all" ON public.kosten
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all" ON public.notities;
CREATE POLICY "auth_all" ON public.notities
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all" ON public.documenten;
CREATE POLICY "auth_all" ON public.documenten
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ──────────────────────────────────────────────────────────────────
-- 4. Storage bucket voor documenten (privé)
-- ──────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('documenten', 'documenten', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "auth_documenten_select" ON storage.objects;
CREATE POLICY "auth_documenten_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'documenten');

DROP POLICY IF EXISTS "auth_documenten_insert" ON storage.objects;
CREATE POLICY "auth_documenten_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documenten');

DROP POLICY IF EXISTS "auth_documenten_update" ON storage.objects;
CREATE POLICY "auth_documenten_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'documenten') WITH CHECK (bucket_id = 'documenten');

DROP POLICY IF EXISTS "auth_documenten_delete" ON storage.objects;
CREATE POLICY "auth_documenten_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'documenten');

-- ──────────────────────────────────────────────────────────────────
-- 5. Storage bucket voor kistfoto's (publiek leesbaar)
-- ──────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('kisten', 'kisten', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "auth_kisten_insert" ON storage.objects;
CREATE POLICY "auth_kisten_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'kisten');

DROP POLICY IF EXISTS "auth_kisten_update" ON storage.objects;
CREATE POLICY "auth_kisten_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'kisten') WITH CHECK (bucket_id = 'kisten');

DROP POLICY IF EXISTS "auth_kisten_delete" ON storage.objects;
CREATE POLICY "auth_kisten_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'kisten');

-- Tabel die kist-modelnamen koppelt aan hun foto-pad in storage
CREATE TABLE IF NOT EXISTS public.kist_afbeeldingen (
  naam TEXT PRIMARY KEY,
  storage_pad TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.kist_afbeeldingen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kist_select_all" ON public.kist_afbeeldingen;
CREATE POLICY "kist_select_all" ON public.kist_afbeeldingen
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "kist_write_auth" ON public.kist_afbeeldingen;
CREATE POLICY "kist_write_auth" ON public.kist_afbeeldingen
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ──────────────────────────────────────────────────────────────────
-- 6. Storage bucket + catalogustabel voor bloemstukken
-- ──────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('bloemen', 'bloemen', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "auth_bloemen_insert" ON storage.objects;
CREATE POLICY "auth_bloemen_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'bloemen');

DROP POLICY IF EXISTS "auth_bloemen_update" ON storage.objects;
CREATE POLICY "auth_bloemen_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'bloemen') WITH CHECK (bucket_id = 'bloemen');

DROP POLICY IF EXISTS "auth_bloemen_delete" ON storage.objects;
CREATE POLICY "auth_bloemen_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'bloemen');

CREATE TABLE IF NOT EXISTS public.bloemen_catalogus (
  id BIGSERIAL PRIMARY KEY,
  naam TEXT UNIQUE NOT NULL,
  omschrijving TEXT,
  bedrag NUMERIC(10,2) DEFAULT 0,
  storage_pad TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_bloemen_updated_at ON public.bloemen_catalogus;
CREATE TRIGGER trg_bloemen_updated_at
  BEFORE UPDATE ON public.bloemen_catalogus
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.bloemen_catalogus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bloemen_all_auth" ON public.bloemen_catalogus;
CREATE POLICY "bloemen_all_auth" ON public.bloemen_catalogus
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ──────────────────────────────────────────────────────────────────
-- 7. Storage bucket + catalogustabel voor eten & drinken
-- ──────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('eten_drinken', 'eten_drinken', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "auth_eten_drinken_insert" ON storage.objects;
CREATE POLICY "auth_eten_drinken_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'eten_drinken');

DROP POLICY IF EXISTS "auth_eten_drinken_update" ON storage.objects;
CREATE POLICY "auth_eten_drinken_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'eten_drinken') WITH CHECK (bucket_id = 'eten_drinken');

DROP POLICY IF EXISTS "auth_eten_drinken_delete" ON storage.objects;
CREATE POLICY "auth_eten_drinken_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'eten_drinken');

CREATE TABLE IF NOT EXISTS public.eten_drinken_catalogus (
  id BIGSERIAL PRIMARY KEY,
  naam TEXT UNIQUE NOT NULL,
  omschrijving TEXT,
  bedrag NUMERIC(10,2) DEFAULT 0,
  storage_pad TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_eten_drinken_updated_at ON public.eten_drinken_catalogus;
CREATE TRIGGER trg_eten_drinken_updated_at
  BEFORE UPDATE ON public.eten_drinken_catalogus
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.eten_drinken_catalogus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eten_drinken_all_auth" ON public.eten_drinken_catalogus;
CREATE POLICY "eten_drinken_all_auth" ON public.eten_drinken_catalogus
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ──────────────────────────────────────────────────────────────────
-- 8. App-brede instellingen (gedeeld tussen alle apparaten/gebruikers)
-- ──────────────────────────────────────────────────────────────────

-- Eén-rij-tabel met alle app-instellingen als JSONB.
-- Branding, welkomscherm, lettertype, weergave — gesynct over apparaten.
CREATE TABLE IF NOT EXISTS public.app_instellingen (
  id INT PRIMARY KEY,
  data JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Initiele lege rij
INSERT INTO public.app_instellingen (id, data)
VALUES (1, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_app_instellingen_updated_at ON public.app_instellingen;
CREATE TRIGGER trg_app_instellingen_updated_at
  BEFORE UPDATE ON public.app_instellingen
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.app_instellingen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_instellingen_all_auth" ON public.app_instellingen;
CREATE POLICY "app_instellingen_all_auth" ON public.app_instellingen
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage-bucket voor het logo (publiek leesbaar)
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "auth_branding_insert" ON storage.objects;
CREATE POLICY "auth_branding_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'branding');

DROP POLICY IF EXISTS "auth_branding_update" ON storage.objects;
CREATE POLICY "auth_branding_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'branding') WITH CHECK (bucket_id = 'branding');

DROP POLICY IF EXISTS "auth_branding_delete" ON storage.objects;
CREATE POLICY "auth_branding_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'branding');
