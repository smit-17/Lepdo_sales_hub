import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "super_admin" | "seller";

/**
 * Admin-only user creation that works on any host (no service-role key):
 * the admin records an invite (RLS: admins only), then a session-less client
 * signs the account up. The DB trigger applies the invite's role/profile;
 * uninvited sign-ups become inactive with no data access.
 */
export async function adminCreateUser(d: {
  name: string; email: string; password: string; role: Role;
  phone: string; department: string; monthlyGoal: number;
}) {
  const email = d.email.trim().toLowerCase();
  const { error: invErr } = await supabase.from("user_invites").upsert({
    email, name: d.name.trim(), role: d.role, phone: d.phone, department: d.department, monthly_goal: d.monthlyGoal,
  });
  if (invErr) throw new Error(invErr.message.includes("row-level") ? "Only an Admin can create users." : invErr.message);

  const url = import.meta.env['VITE_SUPABASE_URL'] as string;
  const key = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string;
  const temp = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "lepdo-signup-temp" },
  });
  const { data, error } = await temp.auth.signUp({ email, password: d.password, options: { data: { name: d.name } } });
  if (error || !data.user) {
    await supabase.from("user_invites").delete().eq("email", email);
    throw new Error(error?.message ?? "Could not create user");
  }
  if (data.user.identities && data.user.identities.length === 0) {
    await supabase.from("user_invites").delete().eq("email", email);
    throw new Error("A user with this email already exists.");
  }
  return { id: data.user.id };
}

/** Admin-only (enforced by RLS on user_roles). */
export async function adminSetRole(d: { userId: string; role: Role }) {
  const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", d.userId);
  if (delErr) throw new Error(delErr.message);
  const { error } = await supabase.from("user_roles").insert({ user_id: d.userId, role: d.role });
  if (error) throw new Error(error.message);
}
