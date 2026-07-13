-- Logtabel voor uitgaande e-mails (Resend via send-email Edge Function).
-- Wordt gebruikt voor rate-limit + auditing (wie mailde wat wanneer).

CREATE TABLE IF NOT EXISTS public.email_log (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "to"       TEXT[] NOT NULL,
  subject    TEXT   NOT NULL,
  resend_id  TEXT,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_log_user_time_idx
  ON public.email_log (user_id, sent_at DESC);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

-- Alleen jij ziet je eigen log. Alleen de Edge Function (service-role) schrijft.
DROP POLICY IF EXISTS "email_log_select" ON public.email_log;
CREATE POLICY "email_log_select" ON public.email_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_beheerder());

REVOKE INSERT, UPDATE, DELETE ON public.email_log FROM authenticated, anon;

NOTIFY pgrst, 'reload schema';
