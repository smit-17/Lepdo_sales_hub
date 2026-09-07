import { useEffect, useMemo, useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Database,
  PhoneCall,
  FileText,
  Sparkles,
  CheckSquare,
  BarChart3,
  Shield,
  Bell,
  Plus,
  LogOut,
  Search,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import lepdoaccountlogo from "@/assets/lepdoaccountlogo.png";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useCrm, useCurrentUser, setState, hydrate } from "@/lib/store";
import { isOverdue } from "@/lib/format";
import { requestQuickAdd, type QuickAddModule } from "@/lib/quick-add";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/data", label: "Data", icon: Database },
  { to: "/follow-up", label: "Follow-Up", icon: PhoneCall },
  { to: "/quotations", label: "Quotations", icon: FileText },
  { to: "/leads", label: "Leads", icon: Sparkles },
  { to: "/tasks", label: "Task", icon: CheckSquare },
  { to: "/reports", label: "Report & Analysis", icon: BarChart3 },
  { to: "/admin", label: "Admin", icon: Shield, adminOnly: true },
] as const;

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <img
      src={lepdoaccountlogo}
      alt="LEPDO"
      className={cn("rounded-md object-contain", compact ? "h-8 w-8 object-cover" : "h-9 w-auto")}
    />
  );
}

function NavList({ onNavigate, collapsed }: { onNavigate?: () => void; collapsed?: boolean }) {
  const user = useCurrentUser();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1 p-2">
      {NAV.filter((n) => !("adminOnly" in n && n.adminOnly) || user.role === "super_admin").map(
        (item) => {
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              title={item.label}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
                collapsed && "justify-center px-0",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        },
      )}
    </nav>
  );
}

function UserFooter({ collapsed }: { collapsed?: boolean }) {
  const user = useCurrentUser();
  const users = useCrm((s) => s.users);
  const demoMode = useCrm((s) => s.settings.demoMode !== false);
  return (
    <div className="border-t p-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-sidebar-accent/60",
              collapsed && "justify-center",
            )}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {user.name.split(" ").map((n) => n[0]).join("")}
            </span>
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{user.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {user.role === "super_admin" ? "Super Admin" : "Salesperson"}
                </span>
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>{demoMode ? "Switch demo user" : "Signed in"}</DropdownMenuLabel>
          {!demoMode && (
            <div className="px-2 pb-1 text-[11px] text-muted-foreground">
              Profile switching is only available in demo mode. Accounts are managed in Admin.
            </div>
          )}
          {(demoMode ? users : [])
            .filter((u) => u.active)
            .map((u) => (
              <DropdownMenuItem
                key={u.id}
                onSelect={() => setState((s) => ({ ...s, currentUserId: u.id }))}
              >
                <span className="truncate">{u.name}</span>
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {u.role === "super_admin" ? "Admin" : "Seller"}
                </span>
              </DropdownMenuItem>
            ))}
          {demoMode && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setState((s) => ({ ...s, currentUserId: "u-admin" }))}>
                <LogOut className="mr-2 h-4 w-4" /> Log out (demo)
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function QuickAdd() {
  const navigate = useNavigate();
  const items: { label: string; module: QuickAddModule; to: string }[] = [
    { label: "Prospect data", module: "data", to: "/data" },
    { label: "Follow-up", module: "followup", to: "/follow-up" },
    { label: "Lead", module: "lead", to: "/leads" },
    { label: "Quotation", module: "quotation", to: "/quotations" },
    { label: "Task", module: "task", to: "/tasks" },
  ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="h-9 gap-1.5">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Quick Add</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {items.map((i) => (
          <DropdownMenuItem
            key={i.module}
            onSelect={async () => {
              await navigate({ to: i.to });
              requestQuickAdd(i.module);
            }}
          >
            {i.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Notifications() {
  const state = useCrm((s) => s);
  const user = useCurrentUser();
  const mine = <T extends { assignedTo: string }>(rows: T[]) =>
    user.role === "super_admin" ? rows : rows.filter((r) => r.assignedTo === user.id);
  const overdueFollowUps = mine(state.followUps).filter(
    (f) => !f.completed && isOverdue(f.nextDate),
  );
  const overdueTasks = mine(state.tasks).filter(
    (t) => t.status !== "Completed" && isOverdue(t.dueDate),
  );
  const count = overdueFollowUps.length + overdueTasks.length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-3 py-2 text-sm font-semibold">Notifications</div>
        <div className="max-h-72 overflow-y-auto p-2 text-sm">
          {count === 0 && <p className="p-3 text-xs text-muted-foreground">You are all caught up.</p>}
          {overdueFollowUps.slice(0, 6).map((f) => (
            <Link
              key={f.id}
              to="/follow-up"
              className="block rounded-md px-2 py-1.5 hover:bg-accent"
            >
              <span className="block truncate font-medium">Overdue follow-up · {f.company}</span>
              <span className="text-[11px] text-muted-foreground">Due {f.nextDate}</span>
            </Link>
          ))}
          {overdueTasks.slice(0, 6).map((t) => (
            <Link key={t.id} to="/tasks" className="block rounded-md px-2 py-1.5 hover:bg-accent">
              <span className="block truncate font-medium">Overdue task · {t.title}</span>
              <span className="text-[11px] text-muted-foreground">Due {t.dueDate}</span>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function UniversalSearch() {
  const [open, setOpen] = useState(false);
  const state = useCrm((s) => s);
  const navigate = useNavigate();
  const user = useCurrentUser();
  const admin = user.role === "super_admin";
  const results = useMemo(() => {
    const f = <T extends { assignedTo: string }>(rows: T[]) =>
      admin ? rows : rows.filter((r) => r.assignedTo === user.id);
    return {
      data: f(state.data).slice(0, 30),
      leads: f(state.leads).slice(0, 30),
      quotations: f(state.quotations).slice(0, 30),
      tasks: f(state.tasks).slice(0, 30),
    };
  }, [state, admin, user.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (to: string) => {
    setOpen(false);
    void navigate({ to });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border bg-background px-3 text-sm text-muted-foreground hover:bg-accent/50 md:max-w-sm"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">Search everything…</span>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search prospects, leads, quotations, tasks…" />
        <CommandList>
          <CommandEmpty>No matching records.</CommandEmpty>
          <CommandGroup heading="Data">
            {results.data.map((d) => (
              <CommandItem key={d.id} value={`${d.company} ${d.contactPerson} ${d.country}`} onSelect={() => go("/data")}>
                {d.company} · {d.country}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Leads">
            {results.leads.map((l) => (
              <CommandItem key={l.id} value={`${l.id} ${l.company}`} onSelect={() => go("/leads")}>
                {l.id} · {l.company}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Quotations">
            {results.quotations.map((q) => (
              <CommandItem key={q.id} value={`${q.number} ${q.company}`} onSelect={() => go("/quotations")}>
                {q.number} · {q.company}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Tasks">
            {results.tasks.map((t) => (
              <CommandItem key={t.id} value={t.title} onSelect={() => go("/tasks")}>
                {t.title}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = useCurrentUser();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title =
    NAV.find((n) => (n.to === "/" ? pathname === "/" : pathname.startsWith(n.to)))?.label ??
    "Dashboard";

  useEffect(() => {
    hydrate();
  }, []);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-sidebar md:flex",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div className={cn("flex items-center gap-2 border-b p-3", collapsed && "justify-center")}>
          <Logo compact={collapsed} />
          {!collapsed && (
            <span className="min-w-0 flex-1 truncate text-xs font-semibold tracking-wide text-muted-foreground">
              SALES CRM
            </span>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <NavList collapsed={collapsed} />
        </div>
        <div className="px-2 pb-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <>
                <PanelLeftClose className="mr-2 h-4 w-4" /> Collapse
              </>
            )}
          </Button>
        </div>
        <UserFooter collapsed={collapsed} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 md:hidden" aria-label="Menu">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0">
                  <SheetTitle className="sr-only">Navigation</SheetTitle>
                  <div className="flex items-center gap-2 border-b p-3">
                    <Logo />
                    <span className="text-xs font-semibold text-muted-foreground">SALES CRM</span>
                  </div>
                  <NavList onNavigate={() => setMobileOpen(false)} />
                  <UserFooter />
                </SheetContent>
              </Sheet>
              <h1 className="truncate text-base font-semibold sm:text-lg">{title}</h1>
            </div>
            <div className="flex min-w-0 justify-end md:justify-start">
              <UniversalSearch />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="hidden text-right text-[11px] leading-tight text-muted-foreground lg:block">
                <span className="block font-medium text-foreground">
                  {user.role === "super_admin" ? "Super Admin" : "Salesperson"}
                </span>
                <WorkingDay />
              </span>
              <Notifications />
              <QuickAdd />
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-3 sm:p-4">{children}</main>
      </div>
    </div>
  );
}

function WorkingDay() {
  const [label, setLabel] = useState("");
  useEffect(() => {
    setLabel(
      new Date().toLocaleDateString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      }),
    );
  }, []);
  return <span suppressHydrationWarning>{label}</span>;
}
