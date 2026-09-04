-- Rollen: server-side rechten voor 'beheerder' vs 'medewerker'.
-- - profiles-tabel houdt de rol per Supabase-account bij.
-- - is_beheerder() helper (SECURITY DEFINER, omzeilt RLS → geen recursie).
-- - dossiers-RLS: medewerkers zien/bewerken geen afgesloten dossiers
--   (status 'voltooid' of 'geannuleerd').
-- Bestaande accounts worden beheerder; nieuwe accounts krijgen automatisch
-- rol 'medewerker'.

CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  naam       TEXT,
  rol        TEXT NOT NULL DEFAULT 'medewerker' CHECK (rol IN ('beheerder','medewerker')),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_beheerder()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'beheerder');
$$;
GRANT EXECUTE ON FUNCTION public.is_beheerder() TO authenticated, anon;

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_beheerder());
DROP POLICY IF EXISTS "profiles_admin_write" ON public.profiles;
CREATE POLICY "profiles_admin_write" ON public.profiles FOR ALL TO authenticated
  USING (public.is_beheerder()) WITH CHECK (public.is_beheerder());

INSERT INTO public.profiles (id, naam, rol)
SELECT id, COALESCE(raw_user_meta_data->>'name', email), 'beheerder' FROM auth.users
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.profiles (id, naam, rol)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), 'medewerker')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP POLICY IF EXISTS "auth_all" ON public.dossiers;
DROP POLICY IF EXISTS "dossiers_select" ON public.dossiers;
CREATE POLICY "dossiers_select" ON public.dossiers FOR SELECT TO authenticated
  USING (public.is_beheerder() OR COALESCE(status,'nieuw') NOT IN ('voltooid','geannuleerd'));
DROP POLICY IF EXISTS "dossiers_insert" ON public.dossiers;
CREATE POLICY "dossiers_insert" ON public.dossiers FOR INSERT TO authenticated
  WITH CHECK (true);
DROP POLICY IF EXISTS "dossiers_update" ON public.dossiers;
CREATE POLICY "dossiers_update" ON public.dossiers FOR UPDATE TO authenticated
  USING (public.is_beheerder() OR COALESCE(status,'nieuw') NOT IN ('voltooid','geannuleerd'))
  WITH CHECK (true);
DROP POLICY IF EXISTS "dossiers_delete" ON public.dossiers;
CREATE POLICY "dossiers_delete" ON public.dossiers FOR DELETE TO authenticated
  USING (public.is_beheerder());

NOTIFY pgrst, 'reload schema';
