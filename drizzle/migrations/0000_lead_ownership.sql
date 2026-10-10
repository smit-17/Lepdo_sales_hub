-- Team members see/manage only leads they created; admins see all. Inactive users get nothing.
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT active FROM public.profiles WHERE id = auth.uid()), false)
$$;
REVOKE EXECUTE ON FUNCTION public.is_active_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated;

DROP POLICY IF EXISTS "leads visible" ON public.leads;
DROP POLICY IF EXISTS "leads insert" ON public.leads;
DROP POLICY IF EXISTS "leads update" ON public.leads;
DROP POLICY IF EXISTS "leads delete" ON public.leads;

CREATE POLICY "leads visible" ON public.leads FOR SELECT TO authenticated
  USING (public.is_active_user() AND (public.is_admin() OR created_by = auth.uid()));
CREATE POLICY "leads insert" ON public.leads FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user() AND (public.is_admin() OR created_by = auth.uid()));
CREATE POLICY "leads update" ON public.leads FOR UPDATE TO authenticated
  USING (public.is_active_user() AND (public.is_admin() OR created_by = auth.uid()))
  WITH CHECK (public.is_active_user() AND (public.is_admin() OR created_by = auth.uid()));
CREATE POLICY "leads delete" ON public.leads FOR DELETE TO authenticated
  USING (public.is_admin());

-- Owner is stamped by the database and cannot be changed by team members.
CREATE OR REPLACE FUNCTION public.stamp_lead_owner()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS NULL OR NOT public.is_admin() THEN
      NEW.created_by := auth.uid();
    END IF;
  ELSIF NEW.created_by IS DISTINCT FROM OLD.created_by AND NOT public.is_admin() THEN
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS leads_owner ON public.leads;
CREATE TRIGGER leads_owner BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.stamp_lead_owner();