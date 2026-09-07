import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const TONES = {
  blue: "bg-pastel-blue",
  lavender: "bg-pastel-lavender",
  mint: "bg-pastel-mint",
  peach: "bg-pastel-peach",
  yellow: "bg-pastel-yellow",
  rose: "bg-pastel-rose",
  plain: "bg-card",
} as const;

export type Tone = keyof typeof TONES;

export function StatCard({
  label,
  value,
  hint,
  tone = "plain",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string | undefined;
  tone?: Tone | undefined;
  icon?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "card-soft flex min-w-0 flex-col gap-1 p-3",
        TONES[tone],
        tone !== "plain" && "border-transparent",
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon ? <span className="shrink-0">{icon}</span> : null}
        <span className="truncate">{label}</span>
      </div>
      <div className="truncate text-xl font-semibold text-foreground">{value}</div>
      {hint ? <div className="truncate text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export function SectionCard({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("card-soft flex min-w-0 flex-col", className)}>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b px-4 py-3">
        <h2 className="truncate text-sm font-semibold">{title}</h2>
        {action}
      </header>
      <div className="min-w-0 p-4">{children}</div>
    </section>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
      ) : null}
      {action}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 pl-8"
        aria-label={placeholder}
      />
    </div>
  );
}

const BADGE_TONES: Record<string, string> = {
  New: "bg-pastel-blue text-foreground",
  Contacted: "bg-pastel-lavender text-foreground",
  Qualified: "bg-pastel-mint text-foreground",
  Interested: "bg-pastel-mint text-foreground",
  "Requirement Received": "bg-pastel-yellow text-foreground",
  "Quotation Sent": "bg-pastel-peach text-foreground",
  Negotiation: "bg-pastel-peach text-foreground",
  Won: "bg-pastel-mint text-foreground",
  Converted: "bg-pastel-mint text-foreground",
  "Converted to Lead": "bg-pastel-mint text-foreground",
  Lost: "bg-pastel-rose text-foreground",
  "Not Interested": "bg-pastel-rose text-foreground",
  Invalid: "bg-pastel-rose text-foreground",
  Pending: "bg-pastel-yellow text-foreground",
  "No Response": "bg-muted text-muted-foreground",
  "Follow-Up Later": "bg-pastel-blue text-foreground",
  "Follow-Up Required": "bg-pastel-yellow text-foreground",
  Draft: "bg-muted text-muted-foreground",
  Sent: "bg-pastel-blue text-foreground",
  Viewed: "bg-pastel-lavender text-foreground",
  Accepted: "bg-pastel-mint text-foreground",
  Rejected: "bg-pastel-rose text-foreground",
  Expired: "bg-muted text-muted-foreground",
  Paid: "bg-pastel-mint text-foreground",
  Unpaid: "bg-pastel-yellow text-foreground",
  "Partially Paid": "bg-pastel-peach text-foreground",
  Overdue: "bg-pastel-rose text-foreground",
  Cancelled: "bg-muted text-muted-foreground",
  "To Do": "bg-pastel-blue text-foreground",
  "In Progress": "bg-pastel-lavender text-foreground",
  Completed: "bg-pastel-mint text-foreground",
  Low: "bg-muted text-muted-foreground",
  Medium: "bg-pastel-blue text-foreground",
  High: "bg-pastel-peach text-foreground",
  Urgent: "bg-pastel-rose text-foreground",
};

export function StatusPill({ value, className }: { value: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-[11px] font-medium",
        BADGE_TONES[value] ?? "bg-secondary text-secondary-foreground",
        className,
      )}
    >
      {value}
    </span>
  );
}

export function Pager({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
      <span>
        Showing {from}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="flex items-center gap-2">
        <select
          value={pageSize}
          onChange={(e) => {
            onPageSize(Number(e.target.value));
            onPage(1);
          }}
          aria-label="Rows per page"
          className="h-8 rounded-md border bg-background px-2"
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>
        <span>
          {page} / {pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function DemoTag() {
  return (
    <span className="rounded bg-pastel-yellow px-1.5 py-0.5 text-[10px] font-medium text-foreground">
      DEMO
    </span>
  );
}
