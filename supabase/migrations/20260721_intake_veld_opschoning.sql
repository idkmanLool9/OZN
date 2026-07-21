-- Nieuwe kolommen voor de intake-verbouwing van 21-07:
--   registratienummer_uitvaartleider — eigen nummer per uitvaartleider
--   aula_gebruikt                    — checkbox
--   centrale_koeling_vanaf           — datum
--   familiekamer_vanaf               — datum
--
-- Bestaande kolommen die niet meer via de UI worden ingevuld blijven
-- gewoon in de tabel staan (met hun oude waarden). Zo verliezen dossiers
-- die eerder wel voornaam / geboorteplaats / overlijdensdatum /
-- peacemaker_verwijderd_datum / thanatopraxie_datum / thanatopraxie_waar
-- hadden, die informatie niet.

alter table public.dossiers
  add column if not exists registratienummer_uitvaartleider text,
  add column if not exists aula_gebruikt boolean not null default false,
  add column if not exists centrale_koeling_vanaf date,
  add column if not exists familiekamer_vanaf date;

notify pgrst, 'reload schema';
