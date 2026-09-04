-- Fix: logo-upload gaf "new row violates row-level security policy".
-- De publieke buckets 'branding' en 'kisten' misten een SELECT-policy, die
-- Supabase Storage nodig heeft voor de bestaans-check bij een upsert-upload.
-- Hier zetten we voor beide de volledige set policies (select/insert/update/
-- delete) robuust neer.

INSERT INTO storage.buckets (id, name, public) VALUES ('branding','branding',true)
  ON CONFLICT (id) DO UPDATE SET public = true;
INSERT INTO storage.buckets (id, name, public) VALUES ('kisten','kisten',true)
  ON CONFLICT (id) DO UPDATE SET public = true;

-- branding
DROP POLICY IF EXISTS "auth_branding_select" ON storage.objects;
CREATE POLICY "auth_branding_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'branding');
DROP POLICY IF EXISTS "auth_branding_insert" ON storage.objects;
CREATE POLICY "auth_branding_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'branding');
DROP POLICY IF EXISTS "auth_branding_update" ON storage.objects;
CREATE POLICY "auth_branding_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'branding') WITH CHECK (bucket_id = 'branding');
DROP POLICY IF EXISTS "auth_branding_delete" ON storage.objects;
CREATE POLICY "auth_branding_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'branding');

-- kisten
DROP POLICY IF EXISTS "auth_kisten_select" ON storage.objects;
CREATE POLICY "auth_kisten_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'kisten');
DROP POLICY IF EXISTS "auth_kisten_insert" ON storage.objects;
CREATE POLICY "auth_kisten_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'kisten');
DROP POLICY IF EXISTS "auth_kisten_update" ON storage.objects;
CREATE POLICY "auth_kisten_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'kisten') WITH CHECK (bucket_id = 'kisten');
DROP POLICY IF EXISTS "auth_kisten_delete" ON storage.objects;
CREATE POLICY "auth_kisten_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'kisten');
