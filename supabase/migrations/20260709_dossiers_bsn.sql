-- BSN-kolom aan dossiers zodat gescande BSN's blijven bewaard en
-- dubbel-detectie via vindDubbelDossier() werkt.
alter table public.dossiers
  add column if not exists bsn text;

notify pgrst, 'reload schema';
