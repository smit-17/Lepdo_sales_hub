ALTER TABLE public.clients ADD COLUMN product_interest text NOT NULL DEFAULT '';

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL DEFAULT '',
  module text NOT NULL DEFAULT '',
  record text NOT NULL DEFAULT '',
  from_value text,
  to_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
CREATE INDEX audit_log_created_idx ON public.audit_log (created_at DESC);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit visible" ON public.audit_log FOR SELECT TO authenticated USING (public.is_admin() OR user_id = auth.uid());
CREATE POLICY "audit insert" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());