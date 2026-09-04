-- Retentie: audit_log en email_log groeien anders eindeloos. pg_cron doet
-- elke dag om 03:15 een schoonmaak-run. Beheerder-only handmatige RPC voor
-- een ad-hoc opschoning is ook aanwezig.

-- audit_log: 365 dagen bewaren (compliance-buffer)
-- email_log: 90 dagen (alleen voor rate-limit-window + auditing korte termijn)

create or replace function public.retention_cleanup()
  returns table(audit_deleted bigint, email_deleted bigint)
  language plpgsql security definer
  set search_path to 'public','pg_temp'
as $$
declare
  a_del bigint := 0;
  e_del bigint := 0;
begin
  delete from public.audit_log where created_at < now() - interval '365 days';
  get diagnostics a_del = row_count;
  delete from public.email_log where sent_at    < now() - interval '90 days';
  get diagnostics e_del = row_count;
  return query select a_del, e_del;
end;
$$;

revoke all on function public.retention_cleanup() from public;
grant execute on function public.retention_cleanup() to authenticated;

-- Alleen beheerders mogen handmatig triggeren
create or replace function public.retention_cleanup_beheer()
  returns table(audit_deleted bigint, email_deleted bigint)
  language plpgsql security definer
  set search_path to 'public','pg_temp'
as $$
begin
  if not public.is_beheerder() then
    raise exception 'niet_toegestaan' using errcode = '42501';
  end if;
  return query select * from public.retention_cleanup();
end;
$$;

grant execute on function public.retention_cleanup_beheer() to authenticated;

-- pg_cron: elke dag om 03:15 UTC (04:15 NL-zomertijd / 05:15 wintertijd)
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return;
  end if;
  -- Bestaand job weghalen (idempotent)
  perform cron.unschedule(jobid) from cron.job where jobname = 'ozn_retention_cleanup';
  perform cron.schedule('ozn_retention_cleanup', '15 3 * * *',
    'select public.retention_cleanup();');
end $$;

notify pgrst, 'reload schema';
