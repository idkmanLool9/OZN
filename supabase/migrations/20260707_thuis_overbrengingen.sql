-- Ook bij thuis opbaren kan er een 'route' zijn — bv. eerst kort naar een
-- verzorging-locatie en dan weer terug naar huis. Zelfde vorm als
-- brengen_naar (JSONB-array van strings).
alter table public.dossiers
  add column if not exists thuis_overbrengingen jsonb;

notify pgrst, 'reload schema';
