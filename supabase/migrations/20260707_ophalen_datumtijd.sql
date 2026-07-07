-- Voeg datum + tijd toe voor "Ophalen / overbrengen" — symmetrisch met
-- thuis_opbaren_datum/tijd. Zo kan de gebruiker ook voor Ophalen aangeven
-- wanneer de overledene wordt opgehaald.
alter table public.dossiers
  add column if not exists ophalen_datum date,
  add column if not exists ophalen_tijd  text;
