-- ============ roles & profiles ============
CREATE TYPE public.app_role AS ENUM ('super_admin', 'seller');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  department text NOT NULL DEFAULT 'Sales',
  monthly_goal numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'super_admin')
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by signed-in users" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin()) WITH CHECK (id = auth.uid() OR public.is_admin());
CREATE POLICY "admins insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid() OR public.is_admin());
CREATE POLICY "admins delete profiles" ON public.profiles FOR DELETE TO authenticated USING (public.is_admin());
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles readable" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- first signed-up user becomes super admin, everyone else a seller
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE first_user boolean;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO first_user;
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), COALESCE(NEW.email, ''));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN first_user THEN 'super_admin'::public.app_role ELSE 'seller'::public.app_role END);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ clients: the single source of truth ============
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company text NOT NULL DEFAULT '',
  contact_person text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  whatsapp text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'New',
  tags text[] NOT NULL DEFAULT '{}',
  notes text NOT NULL DEFAULT '',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  added_date date NOT NULL DEFAULT current_date,
  archived boolean NOT NULL DEFAULT false,
  demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
CREATE INDEX clients_assigned_idx ON public.clients (assigned_to);
CREATE INDEX clients_company_idx ON public.clients (lower(company));
CREATE INDEX clients_phone_idx ON public.clients (phone);
CREATE INDEX clients_email_idx ON public.clients (lower(email));

CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  lead_id uuid,
  quotation_id uuid,
  order_id uuid,
  activity_type text NOT NULL,
  activity_date date NOT NULL DEFAULT current_date,
  activity_time text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  next_follow_up date,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  auto_generated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activities TO authenticated;
GRANT ALL ON public.activities TO service_role;
CREATE INDEX activities_client_idx ON public.activities (client_id, activity_date DESC);

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  stage text NOT NULL DEFAULT 'New',
  priority text NOT NULL DEFAULT 'Medium',
  value numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  requirement jsonb NOT NULL DEFAULT '{}'::jsonb,
  loss_reason text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  archived boolean NOT NULL DEFAULT false,
  demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
CREATE INDEX leads_stage_idx ON public.leads (stage);

CREATE TABLE public.follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  activity_id uuid REFERENCES public.activities(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'WhatsApp',
  next_date date NOT NULL DEFAULT current_date,
  next_time text NOT NULL DEFAULT '10:00',
  last_contact date,
  status text NOT NULL DEFAULT 'Pending',
  priority text NOT NULL DEFAULT 'Medium',
  notes text NOT NULL DEFAULT '',
  outcome text NOT NULL DEFAULT '',
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  archived boolean NOT NULL DEFAULT false,
  demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_ups TO authenticated;
GRANT ALL ON public.follow_ups TO service_role;
CREATE INDEX follow_ups_due_idx ON public.follow_ups (completed, next_date);
CREATE INDEX follow_ups_client_idx ON public.follow_ups (client_id);

CREATE TABLE public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  quotation_type text NOT NULL DEFAULT 'Diamond',
  quote_date date NOT NULL DEFAULT current_date,
  valid_until date,
  currency text NOT NULL DEFAULT 'USD',
  billing_address text NOT NULL DEFAULT '',
  payment_terms text NOT NULL DEFAULT '',
  delivery_terms text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  terms text NOT NULL DEFAULT '',
  diamond_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  jewelry_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  discount numeric NOT NULL DEFAULT 0,
  shipping numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  other_charges numeric NOT NULL DEFAULT 0,
  grand_total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Draft',
  revision integer NOT NULL DEFAULT 1,
  company_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  invoice jsonb,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  archived boolean NOT NULL DEFAULT false,
  demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotations TO authenticated;
GRANT ALL ON public.quotations TO service_role;
CREATE INDEX quotations_client_idx ON public.quotations (client_id);
CREATE INDEX quotations_status_idx ON public.quotations (status);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no text NOT NULL UNIQUE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  quotation_id uuid UNIQUE REFERENCES public.quotations(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  order_date date NOT NULL DEFAULT current_date,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  order_status text NOT NULL DEFAULT 'Order Done',
  payment_status text NOT NULL DEFAULT 'Pending',
  amount_paid numeric NOT NULL DEFAULT 0,
  products jsonb NOT NULL DEFAULT '[]'::jsonb,
  tracking text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  archived boolean NOT NULL DEFAULT false,
  demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
CREATE INDEX orders_client_idx ON public.orders (client_id);
CREATE INDEX orders_date_idx ON public.orders (order_date);

CREATE TABLE public.targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  period text NOT NULL DEFAULT 'Monthly',
  start_date date NOT NULL DEFAULT current_date,
  end_date date NOT NULL DEFAULT current_date,
  currency text NOT NULL DEFAULT 'USD',
  amount numeric NOT NULL DEFAULT 0,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  company_wide boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  archived boolean NOT NULL DEFAULT false,
  demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.targets TO authenticated;
GRANT ALL ON public.targets TO service_role;

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  quotation_id uuid REFERENCES public.quotations(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  priority text NOT NULL DEFAULT 'Medium',
  start_date date,
  due_date date NOT NULL DEFAULT current_date,
  due_time text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Pending',
  goal_category text NOT NULL DEFAULT '',
  reminder boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  archived boolean NOT NULL DEFAULT false,
  demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
CREATE INDEX tasks_due_idx ON public.tasks (status, due_date);

ALTER TABLE public.activities
  ADD CONSTRAINT activities_lead_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD CONSTRAINT activities_quotation_fk FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE SET NULL,
  ADD CONSTRAINT activities_order_fk FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;

-- ============ settings & numbering ============
CREATE TABLE public.app_settings (
  id integer PRIMARY KEY DEFAULT 1,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_single_row CHECK (id = 1)
);
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
INSERT INTO public.app_settings (id, settings) VALUES (1, '{}'::jsonb);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings readable" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins update settings" ON public.app_settings FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.number_sequences (
  key text PRIMARY KEY,
  next_value integer NOT NULL DEFAULT 1
);
GRANT SELECT ON public.number_sequences TO authenticated;
GRANT ALL ON public.number_sequences TO service_role;
ALTER TABLE public.number_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sequences readable" ON public.number_sequences FOR SELECT TO authenticated USING (true);
INSERT INTO public.number_sequences (key, next_value) VALUES ('quotation', 1), ('order', 1);

-- concurrency-safe sequential numbers (QT-0001 / ORD-0001)
CREATE OR REPLACE FUNCTION public.next_number(_key text, _prefix text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v integer; p text;
BEGIN
  INSERT INTO public.number_sequences (key, next_value) VALUES (_key, 1)
  ON CONFLICT (key) DO UPDATE SET next_value = public.number_sequences.next_value + 1
  RETURNING next_value INTO v;
  p := COALESCE(_prefix, CASE WHEN _key = 'order' THEN 'ORD-' ELSE 'QT-' END);
  RETURN p || lpad(v::text, 4, '0');
END; $$;
REVOKE ALL ON FUNCTION public.next_number(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.next_number(text, text) TO authenticated, service_role;

-- ============ row level security: admins see all, sellers see their own ============
CREATE OR REPLACE FUNCTION public.can_see(_assigned uuid, _created uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'super_admin')
     OR _assigned = auth.uid() OR _created = auth.uid()
$$;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients visible" ON public.clients FOR SELECT TO authenticated USING (public.can_see(assigned_to, created_by));
CREATE POLICY "clients insert" ON public.clients FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_admin());
CREATE POLICY "clients update" ON public.clients FOR UPDATE TO authenticated USING (public.can_see(assigned_to, created_by)) WITH CHECK (public.can_see(assigned_to, created_by));
CREATE POLICY "clients delete" ON public.clients FOR DELETE TO authenticated USING (public.is_admin());
CREATE TRIGGER clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads visible" ON public.leads FOR SELECT TO authenticated USING (public.can_see(assigned_to, created_by));
CREATE POLICY "leads insert" ON public.leads FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_admin());
CREATE POLICY "leads update" ON public.leads FOR UPDATE TO authenticated USING (public.can_see(assigned_to, created_by)) WITH CHECK (public.can_see(assigned_to, created_by));
CREATE POLICY "leads delete" ON public.leads FOR DELETE TO authenticated USING (public.is_admin());
CREATE TRIGGER leads_updated BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follow_ups visible" ON public.follow_ups FOR SELECT TO authenticated USING (public.can_see(assigned_to, created_by));
CREATE POLICY "follow_ups insert" ON public.follow_ups FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_admin());
CREATE POLICY "follow_ups update" ON public.follow_ups FOR UPDATE TO authenticated USING (public.can_see(assigned_to, created_by)) WITH CHECK (public.can_see(assigned_to, created_by));
CREATE POLICY "follow_ups delete" ON public.follow_ups FOR DELETE TO authenticated USING (public.is_admin());
CREATE TRIGGER follow_ups_updated BEFORE UPDATE ON public.follow_ups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activities visible" ON public.activities FOR SELECT TO authenticated USING (public.can_see(assigned_to, created_by));
CREATE POLICY "activities insert" ON public.activities FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_admin());
CREATE POLICY "activities update" ON public.activities FOR UPDATE TO authenticated USING (public.can_see(assigned_to, created_by)) WITH CHECK (public.can_see(assigned_to, created_by));
CREATE POLICY "activities delete" ON public.activities FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_admin());

ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quotations visible" ON public.quotations FOR SELECT TO authenticated USING (public.can_see(assigned_to, created_by));
CREATE POLICY "quotations insert" ON public.quotations FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_admin());
CREATE POLICY "quotations update" ON public.quotations FOR UPDATE TO authenticated USING (public.can_see(assigned_to, created_by)) WITH CHECK (public.can_see(assigned_to, created_by));
CREATE POLICY "quotations delete" ON public.quotations FOR DELETE TO authenticated USING (public.is_admin());
CREATE TRIGGER quotations_updated BEFORE UPDATE ON public.quotations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders visible" ON public.orders FOR SELECT TO authenticated USING (public.can_see(assigned_to, created_by));
CREATE POLICY "orders insert" ON public.orders FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_admin());
CREATE POLICY "orders update" ON public.orders FOR UPDATE TO authenticated USING (public.can_see(assigned_to, created_by)) WITH CHECK (public.can_see(assigned_to, created_by));
CREATE POLICY "orders delete" ON public.orders FOR DELETE TO authenticated USING (public.is_admin());
CREATE TRIGGER orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks visible" ON public.tasks FOR SELECT TO authenticated USING (public.can_see(assigned_to, created_by));
CREATE POLICY "tasks insert" ON public.tasks FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_admin());
CREATE POLICY "tasks update" ON public.tasks FOR UPDATE TO authenticated USING (public.can_see(assigned_to, created_by)) WITH CHECK (public.can_see(assigned_to, created_by));
CREATE POLICY "tasks delete" ON public.tasks FOR DELETE TO authenticated USING (public.is_admin());
CREATE TRIGGER tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "targets readable" ON public.targets FOR SELECT TO authenticated USING (public.is_admin() OR assigned_to = auth.uid() OR company_wide);
CREATE POLICY "admins manage targets" ON public.targets FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER targets_updated BEFORE UPDATE ON public.targets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();