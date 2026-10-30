CREATE TABLE public.user_invites (
  email text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  role public.app_role NOT NULL DEFAULT 'seller',
  phone text NOT NULL DEFAULT '',
  department text NOT NULL DEFAULT '',
  monthly_goal numeric NOT NULL DEFAULT 0,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_invites TO authenticated;
GRANT ALL ON public.user_invites TO service_role;
ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage invites" ON public.user_invites FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE first_user boolean; inv public.user_invites%ROWTYPE;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO first_user;
  SELECT * INTO inv FROM public.user_invites WHERE lower(email) = lower(COALESCE(NEW.email, ''));
  IF FOUND THEN
    INSERT INTO public.profiles (id, name, email, phone, department, monthly_goal, active)
    VALUES (NEW.id, COALESCE(NULLIF(inv.name, ''), split_part(NEW.email, '@', 1)), NEW.email, inv.phone, inv.department, inv.monthly_goal, true);
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, inv.role);
    DELETE FROM public.user_invites WHERE email = inv.email;
  ELSE
    -- Uninvited sign-ups get an inactive account with no data access.
    INSERT INTO public.profiles (id, name, email, active)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), COALESCE(NEW.email, ''), first_user);
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, CASE WHEN first_user THEN 'super_admin'::public.app_role ELSE 'seller'::public.app_role END);
  END IF;
  RETURN NEW;
END; $$;