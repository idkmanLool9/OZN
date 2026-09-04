-- Audit-batch: server-side security-fixes uit de 7-agent audit.

-- ─── 1. overledenen-bucket: SELECT ook door dossier-gate ─────────────────────
-- Voorheen las elke authenticated user álle rouwkaart-foto's uit welk
-- dossier dan ook (inclusief geannuleerd/voltooid die anders verborgen zijn).
drop policy if exists overledenen_read on storage.objects;
create policy overledenen_read on storage.objects
  for select to authenticated
  using (bucket_id = 'overledenen' and public.storage_dossier_gate(name));

-- ─── 2. get_personeel_namen: alleen beheerders ──────────────────────────────
-- Deze RPC returnde alle user_id + naam-paren van álle profielen aan élke
-- authenticated user. Info-lek → phishing-doelwit. Vanaf nu alleen beheerders.
drop function if exists public.get_personeel_namen();
create function public.get_personeel_namen()
returns table (user_id uuid, naam text)
language sql security definer stable
set search_path = public, pg_temp as $$
  select p.id as user_id,
         coalesce(p.naam, u.email) as naam
    from public.profiles p
    join auth.users u on u.id = p.id
   where public.is_beheerder();
$$;
grant execute on function public.get_personeel_namen() to authenticated;

-- ─── 3. HTML-decode trigger: skip jsonb-kolommen ───────────────────────────
-- De vorige trigger itereerde OVER ALLE kolommen via jsonb_each_text (dus
-- ook jsonb-kolommen). Als een cached client per ongeluk '&amp;quot;' in een
-- jsonb-array zou zetten, kon de decode de JSON-syntax breken en aborteerde
-- de INSERT/UPDATE met 22P02. Nu alleen text/varchar/char-kolommen
-- decoderen — de rest wordt overgeslagen.
create or replace function public.dossiers_html_decode()
returns trigger language plpgsql as $$
declare
  j        jsonb;
  cleaned  jsonb := '{}'::jsonb;
  rec      record;
  decoded  text;
  text_cols text[];
begin
  -- Verzamel alleen text-achtige kolommen éénmaal.
  select coalesce(array_agg(column_name), '{}')
    into text_cols
    from information_schema.columns
   where table_schema = 'public'
     and table_name   = 'dossiers'
     and data_type in ('text', 'character varying', 'character');

  j := to_jsonb(NEW);
  for rec in select key, value from jsonb_each_text(j) loop
    if rec.key = any(text_cols)
       and rec.value is not null
       and rec.value ~ '&(amp|lt|gt|quot|#39);' then
      decoded := rec.value;
      for i in 1..5 loop
        exit when decoded !~ '&(amp|lt|gt|quot|#39);';
        decoded := replace(replace(replace(replace(replace(decoded,
                   '&amp;',  '&'),
                   '&lt;',   '<'),
                   '&gt;',   '>'),
                   '&quot;', '"'),
                   '&#39;',  '''');
      end loop;
      if decoded <> rec.value then
        cleaned := cleaned || jsonb_build_object(rec.key, decoded);
      end if;
    end if;
  end loop;

  if cleaned <> '{}'::jsonb then
    NEW := jsonb_populate_record(NEW, cleaned);
  end if;
  return NEW;
end;
$$;

-- ─── 4. Indexen op dossiers-hotpath ─────────────────────────────────────────
-- Views doen 'order by updated_at desc' + filter op status/opdrachtgever.
-- Bij groei naar 10k+ rijen wordt seq-scan traag; RLS-eval per rij ook.
create index if not exists dossiers_updated_at_idx on public.dossiers (updated_at desc);
create index if not exists dossiers_status_idx     on public.dossiers (status)          where status is not null;
create index if not exists dossiers_opdrachtgever_idx on public.dossiers (lower(opdrachtgever_naam)) where opdrachtgever_naam is not null;

notify pgrst, 'reload schema';
