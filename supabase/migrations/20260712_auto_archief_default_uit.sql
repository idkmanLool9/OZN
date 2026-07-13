-- Auto-archief standaard UIT zetten.
-- Reden: automatische archivering veroorzaakte in de praktijk verwarring
-- (dossiers verdwenen "opeens" uit de lijst). Voortaan is 't opt-in via
-- Account -> Archief.

UPDATE public.app_instellingen
   SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{auto_archief_actief}', 'false'::jsonb)
 WHERE id = 1;

NOTIFY pgrst, 'reload schema';
