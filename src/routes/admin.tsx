import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { SectionCard, EmptyState, StatusPill, TableSkeleton, Pager } from "@/components/crm/ui-bits";
import { useCrm, useCurrentUser, useHydrated, setState, uid, logActivity, resetDemoData } from "@/lib/store";
import { dateLabel, money } from "@/lib/format";
import type { Role, User, Settings } from "@/lib/types";
import lepdoaccountlogo from "@/assets/lepdoaccountlogo.png";
import { readImageFile } from "@/lib/quotation-helpers";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — LEPDO Sales CRM" },
      { name: "description", content: "Manage LEPDO users, roles, sales goals, CRM settings and the activity log." },
      { property: "og:title", content: "Admin — LEPDO Sales CRM" },
      { property: "og:description", content: "Super Admin controls for users, CRM settings and activity history." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const state = useCrm((s) => s);
  const me = useCurrentUser();
  const hydrated = useHydrated();

  if (!hydrated) return <TableSkeleton rows={8} />;

  if (me.role !== "super_admin") {
    return (
      <EmptyState
        title="Admin access only"
        description="Switch to the Super Admin profile in the header to open this section."
      />
    );
  }

  return (
    <Tabs defaultValue="users" className="space-y-4">
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
      </TabsList>
      <TabsContent value="users"><UsersTab /></TabsContent>
      <TabsContent value="settings"><SettingsTab /></TabsContent>
      <TabsContent value="activity"><ActivityTab /></TabsContent>
    </Tabs>
  );
}

function UsersTab() {
  const users = useCrm((s) => s.users);
  const state = useCrm((s) => s);
  const [editing, setEditing] = useState<User | null>(null);
  const [reassign, setReassign] = useState<User | null>(null);

  const blank = (): User => ({
    id: "", name: "", email: "", phone: "", role: "seller",
    department: "", monthlyGoal: 50000, active: true,
  });

  function save(user: User) {
    if (!user.name.trim() || !user.email.trim()) { toast.error("Name and email are required."); return; }
    if (users.some((u) => u.email.toLowerCase() === user.email.toLowerCase() && u.id !== user.id)) {
      toast.error("A user with this email already exists.");
      return;
    }
    const wasLastActiveAdmin =
      user.id &&
      users.find((u) => u.id === user.id)?.role === "super_admin" &&
      users.filter((u) => u.active && u.role === "super_admin").length <= 1;
    if (wasLastActiveAdmin && (user.role !== "super_admin" || !user.active)) {
      toast.error("This is the last active Super Admin — keep the role and keep it active.");
      return;
    }
    setState((s) => ({
      ...s,
      users: user.id ? s.users.map((u) => (u.id === user.id ? user : u)) : [...s.users, { ...user, id: uid("u") }],
    }));
    logActivity({ action: user.id ? "User updated" : "User created", module: "Admin", record: user.name });
    toast.success("User saved");
    setEditing(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setEditing(blank())}><Plus className="mr-1.5 h-4 w-4" /> Add user</Button>
        <Button size="sm" variant="outline" onClick={() => { resetDemoData(); toast.success("Demo data restored"); }}>
          <RotateCcw className="mr-1.5 h-4 w-4" /> Reset demo data
        </Button>
      </div>

      <div className="card-soft">
        <div>
          <table className="w-full table-fixed text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="w-[34%] p-2 font-medium">User</th>
                <th className="hidden w-[22%] p-2 font-medium md:table-cell">Role &amp; team</th>
                <th className="hidden w-[14%] p-2 font-medium lg:table-cell">Monthly goal</th>
                <th className="w-[30%] p-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t align-top hover:bg-accent/30">
                  <td className="min-w-0 p-2">
                    <div className="truncate font-medium">{u.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                    <div className="truncate text-xs text-muted-foreground">{u.phone}</div>
                    <div className="mt-1 flex flex-wrap gap-1 md:hidden">
                      <StatusPill value={u.role === "super_admin" ? "Super Admin" : "Salesperson"} />
                      <StatusPill value={u.active ? "Active" : "Inactive"} />
                    </div>
                  </td>
                  <td className="hidden min-w-0 space-y-1 p-2 md:table-cell">
                    <StatusPill value={u.role === "super_admin" ? "Super Admin" : "Salesperson"} />
                    <div className="truncate text-xs text-muted-foreground">{u.department}</div>
                    <div><StatusPill value={u.active ? "Active" : "Inactive"} /></div>
                  </td>
                  <td className="hidden min-w-0 p-2 text-xs whitespace-nowrap lg:table-cell">{money(u.monthlyGoal)}</td>
                  <td className="p-2 text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditing(u)}>Edit</Button>
                    <Button
                      size="sm" variant="ghost" className="h-7"
                      onClick={() => {
                        const lastAdmin =
                          u.active &&
                          u.role === "super_admin" &&
                          users.filter((x) => x.active && x.role === "super_admin").length <= 1;
                        if (lastAdmin) {
                          toast.error("This is the last active Super Admin — add another one first.");
                          return;
                        }
                        setState((s) => ({ ...s, users: s.users.map((x) => (x.id === u.id ? { ...x, active: !x.active } : x)) }));
                        logActivity({ action: u.active ? "User deactivated" : "User activated", module: "Admin", record: u.name });
                      }}
                    >
                      {u.active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => setReassign(u)}>Reassign</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <Dialog open onOpenChange={(v) => !v && setEditing(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>{editing.id ? "Edit user" : "Add user"}</DialogTitle></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full name *" value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} />
              <Field label="Email *" value={editing.email} onChange={(v) => setEditing({ ...editing, email: v })} />
              <Field label="Phone" value={editing.phone} onChange={(v) => setEditing({ ...editing, phone: v })} />
              <div className="space-y-1">
                <Label className="text-xs">Role</Label>
                <select className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value as Role })}>
                  <option value="seller">Salesperson</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <Field label="Department" value={editing.department} onChange={(v) => setEditing({ ...editing, department: v })} />
              <Field label="Monthly goal" value={String(editing.monthlyGoal)} type="number" onChange={(v) => setEditing({ ...editing, monthlyGoal: Number(v) })} />
              <div className="flex items-center gap-2 sm:col-span-2">
                <Switch checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} id="active" />
                <Label htmlFor="active" className="text-xs">Active user</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={() => save(editing)}>Save user</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {reassign && (
        <ReassignDialog user={reassign} users={state.users} onClose={() => setReassign(null)} />
      )}
    </div>
  );
}

function ReassignDialog({ user, users, onClose }: { user: User; users: User[]; onClose: () => void }) {
  const [target, setTarget] = useState(users.find((u) => u.id !== user.id)?.id ?? "");
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Reassign records from {user.name}</DialogTitle></DialogHeader>
        <div className="space-y-1">
          <Label className="text-xs">Move data, leads, follow-ups, quotations and tasks to</Label>
          <select className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={target} onChange={(e) => setTarget(e.target.value)}>
            {users.filter((u) => u.id !== user.id).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              const swap = <T extends { assignedTo: string }>(rows: T[]) =>
                rows.map((r) => (r.assignedTo === user.id ? { ...r, assignedTo: target } : r));
              setState((s) => ({
                ...s,
                data: swap(s.data), leads: swap(s.leads), followUps: swap(s.followUps),
                quotations: swap(s.quotations), tasks: swap(s.tasks),
              }));
              logActivity({ action: "Records reassigned", module: "Admin", record: user.name, to: users.find((u) => u.id === target)?.name });
              toast.success("Records reassigned");
              onClose();
            }}
          >
            Reassign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettingsTab() {
  const settings = useCrm((s) => s.settings);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const update = (patch: Partial<Settings>) => {
    setSaveState("saving");
    try {
      setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="lg:col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2 text-xs">
        <span>
          Settings save to this device as soon as you change them.
        </span>
        <span
          className={
            saveState === "error"
              ? "rounded-full bg-pastel-rose px-2 py-0.5 font-medium"
              : saveState === "saving"
                ? "rounded-full bg-pastel-yellow px-2 py-0.5 font-medium"
                : saveState === "saved"
                  ? "rounded-full bg-pastel-mint px-2 py-0.5 font-medium"
                  : "text-muted-foreground"
          }
        >
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Could not save" : "No changes yet"}
        </span>
      </div>
      <SectionCard title="Demo mode">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            While demo mode is on, anyone can switch between the sample profiles from the header.
            Turn it off for real use so only the signed-in account is available.
          </p>
          <Switch
            checked={settings.demoMode !== false}
            onCheckedChange={(v) => update({ demoMode: v })}
            aria-label="Demo mode"
          />
        </div>
      </SectionCard>
      <ListEditor title="Tags" items={settings.tags} onChange={(tags) => update({ tags })} />
      <ListEditor title="Data sources" items={settings.sources} onChange={(sources) => update({ sources })} />
      <ListEditor title="Product categories" items={settings.categories} onChange={(categories) => update({ categories })} />
      <ListEditor title="Countries" items={settings.countries} onChange={(countries) => update({ countries })} />
      <ListEditor title="Currency options" items={settings.currencies} onChange={(currencies) => update({ currencies })} />

      <SectionCard title="Message templates">
        <div className="space-y-3">
          {settings.templates.map((t) => (
            <div key={t.id} className="space-y-1">
              <Input
                className="h-8 text-xs font-medium"
                value={t.name}
                onChange={(e) => update({ templates: settings.templates.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)) })}
              />
              <Textarea
                rows={2}
                value={t.body}
                onChange={(e) => update({ templates: settings.templates.map((x) => (x.id === t.id ? { ...x, body: e.target.value } : x)) })}
              />
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => update({ templates: [...settings.templates, { id: uid("tpl"), name: "New template", body: "Hello {{name}}," }] })}>
            <Plus className="mr-1.5 h-4 w-4" /> Add template
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Quotation & invoice terms">
        <div className="space-y-3">
          <div className="space-y-1"><Label className="text-xs">Quotation terms</Label><Textarea rows={3} value={settings.quotationTerms} onChange={(e) => update({ quotationTerms: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs">Invoice terms</Label><Textarea rows={3} value={settings.invoiceTerms} onChange={(e) => update({ invoiceTerms: e.target.value })} /></div>
        </div>
      </SectionCard>

      <SectionCard title="Company information & PDF branding">
        <div className="grid gap-3 sm:grid-cols-2">
          {(["name", "address", "email", "phone", "website"] as const).map((k) => (
            <Field key={k} label={k[0]!.toUpperCase() + k.slice(1)} value={settings.company[k]} onChange={(v) => update({ company: { ...settings.company, [k]: v } })} />
          ))}
        </div>
        <div className="mt-3 space-y-2">
          <Label className="text-xs">Logo used on quotation and invoice PDFs</Label>
          <div className="flex flex-wrap items-center gap-3">
            <img
              src={settings.company.logo || lepdoaccountlogo}
              alt="Current logo"
              className="h-12 w-auto rounded border bg-white object-contain p-1"
            />
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="h-9 max-w-64"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const dataUrl = await readImageFile(file);
                  update({ company: { ...settings.company, logo: dataUrl } });
                  toast.success("Logo updated");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not read that image.");
                }
              }}
            />
            {settings.company.logo ? (
              <Button size="sm" variant="outline" onClick={() => update({ company: { ...settings.company, logo: null } })}>
                Use default logo
              </Button>
            ) : null}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function ListEditor({ title, items, onChange }: { title: string; items: string[]; onChange: (items: string[]) => void }) {
  const [value, setValue] = useState("");
  return (
    <SectionCard title={title}>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
            {item}
            <button className="text-muted-foreground hover:text-destructive" onClick={() => onChange(items.filter((x) => x !== item))} aria-label={`Remove ${item}`}>×</button>
          </span>
        ))}
        {!items.length && <span className="text-xs text-muted-foreground">Nothing added yet.</span>}
      </div>
      <div className="mt-2 flex gap-2">
        <Input className="h-8" value={value} placeholder={`Add ${title.toLowerCase()}`} onChange={(e) => setValue(e.target.value)} />
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const v = value.trim();
            if (!v) return;
            if (items.includes(v)) { toast.error("Already exists"); return; }
            onChange([...items, v]);
            setValue("");
          }}
        >
          Add
        </Button>
      </div>
    </SectionCard>
  );
}

function ActivityTab() {
  const activity = useCrm((s) => s.activity);
  const users = useCrm((s) => s.users);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const paged = activity.slice((page - 1) * pageSize, page * pageSize);

  if (!activity.length) return <EmptyState title="No activity yet" description="Important actions will be recorded here." />;

  return (
    <div className="card-soft">
      <div>
        <table className="w-full table-fixed text-sm">
          <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-[22%] p-2 font-medium">When &amp; who</th>
              <th className="w-[38%] p-2 font-medium">Action</th>
              <th className="w-[40%] p-2 font-medium">Change</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((a) => (
              <tr key={a.id} className="border-t align-top">
                <td className="min-w-0 p-2 text-xs">
                  <div>{dateLabel(a.at)}</div>
                  <div className="truncate text-muted-foreground">
                    {users.find((u) => u.id === a.userId)?.name ?? "—"}
                  </div>
                </td>
                <td className="min-w-0 p-2 text-xs break-words">
                  <div className="font-medium">{a.action}</div>
                  <div className="text-muted-foreground">{a.module} · {a.record}</div>
                </td>
                <td className="min-w-0 p-2 text-xs break-words text-muted-foreground">
                  {a.from || a.to ? `${a.from ?? "—"} → ${a.to ?? "—"}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} pageSize={pageSize} total={activity.length} onPage={setPage} onPageSize={setPageSize} />
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input className="h-9" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
