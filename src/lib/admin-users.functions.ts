import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  role: z.enum(["super_admin", "seller"]),
  phone: z.string().max(40).default(""),
  department: z.string().max(100).default(""),
  monthlyGoal: z.number().min(0).default(0),
});

/** Admin-only: creates a confirmed account and assigns its role. */
export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
    if (!isAdmin) throw new Error("Only an Admin can create users.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create user");
    const id = created.user.id;

    await supabaseAdmin
      .from("profiles")
      .update({ name: data.name, phone: data.phone, department: data.department, monthly_goal: data.monthlyGoal, active: true })
      .eq("id", id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", id);
    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({ user_id: id, role: data.role });
    if (roleErr) throw new Error(roleErr.message);
    return { id };
  });

/** Admin-only: changes a user's role. */
export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), role: z.enum(["super_admin", "seller"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
    if (!isAdmin) throw new Error("Only an Admin can change roles.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
