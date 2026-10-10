CREATE OR REPLACE FUNCTION public.reset_crm_data()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only Admins can reset data';
  END IF;
  DELETE FROM public.follow_ups WHERE id IS NOT NULL;
  DELETE FROM public.activities WHERE id IS NOT NULL;
  DELETE FROM public.tasks WHERE id IS NOT NULL;
  DELETE FROM public.orders WHERE id IS NOT NULL;
  DELETE FROM public.quotations WHERE id IS NOT NULL;
  DELETE FROM public.leads WHERE id IS NOT NULL;
  DELETE FROM public.clients WHERE id IS NOT NULL;
  DELETE FROM public.targets WHERE id IS NOT NULL;
  DELETE FROM public.audit_log WHERE id IS NOT NULL;
  DELETE FROM public.number_sequences WHERE key IS NOT NULL;
  INSERT INTO public.audit_log (user_id, action, module, record)
  VALUES (auth.uid(), 'Reset database', 'Admin', 'All transaction data');
END; $$;
REVOKE ALL ON FUNCTION public.reset_crm_data() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reset_crm_data() TO authenticated;