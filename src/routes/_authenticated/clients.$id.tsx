import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SectionCard, StatusPill, EmptyState, DemoTag } from "@/components/crm/ui-bits";
import { useCrm, useCurrentUser, setState, uid } from "@/lib/store";
import { amount, dateLabel, todayIso, quotationTotals } from "@/lib/format";
import { followUpsFor, nextFollowUpDate, timezoneLabel } from "@/lib/links";
import { ACTIVITY_TYPES, addTimelineEntry, moveToLead } from "@/lib/workflow";
import type { FollowUp } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/clients/$id")({
  head: () => ({
    meta: [
      { title: "Client Profile — LEPDO Sales CRM" },
      {
        name: "description",
        content:
          "One connected client record with its full activity timeline, leads, quotations and orders.",
      },
      { property: "og:title", content: "Client Profile — LEPDO Sales CRM" },
      {
        property: "og:description",
        content: "Client activity timeline, quotations and order history in one place.",
      },
    ],
  }),
  component: ClientProfilePage,
});

function ClientProfilePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const me = useCurrentUser();
  const state = useCrm((s) => s);
  const client = state.data.find((d) => d.id === id);
  const [actionOpen, setActionOpen] = useState(false);

  const lead = state.leads.find((l) => l.dataId === id && !l.archived);
  const quotations = useMemo(
    () => state.quotations.filter((q) => q.dataId === id && !q.archived),
    [state.quotations, id],
  );
  const orders = useMemo(
    () => state.orders.filter((o) => o.clientId === id && !o.archived),
    [state.orders, id],
  );
  const timeline = useMemo(
    () =>
      state.timeline
        .filter((t) => t.clientId === id)
        .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)),
    [state.timeline, id],
  );
  const followUps = client ? followUpsFor(state.followUps, { id: client.id, company: client.company }) : [];

  if (!client) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: "/data" })}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Data
        </Button>
        <EmptyState title="Client not found" description="This record may have been archived." />
      </div>
    );
  }

  const nextDate = nextFollowUpDate(state, {
    id: client.id,
    company: client.company,
    nextFollowUp: client.nextFollowUp,
  });
  const sellerName = (uid2: string) => state.users.find((u) => u.id === uid2)?.name ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => void navigate({ to: "/data" })}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Data
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">
          {client.company || client.phone || "Client"} {client.demo && <DemoTag />}
        </h1>
        <Button size="sm" onClick={() => setActionOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Add action
        </Button>
        {!lead && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const created = moveToLead(client.id);
              if (created) toast.success("Added to Leads");
            }}
          >
            <Sparkles className="mr-1 h-4 w-4" /> Move to Leads
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => void navigate({ to: "/quotations" })}>
          Create quotation
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Client information" className="lg:col-span-1">
          <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-1">
            {[
              ["Contact person", client.contactPerson || "—"],
              ["Phone", client.phone || "—"],
              ["WhatsApp", client.whatsapp || "—"],
              ["Email", client.email || "—"],
              ["Website", client.website || "—"],
              ["Country / City", [client.country, client.city].filter(Boolean).join(" · ") || "—"],
              ["Source", client.source || "—"],
              ["Product interest", client.productInterest || "—"],
              ["Owner", sellerName(client.assignedTo)],
              ["Date added", dateLabel(client.createdAt)],
              ["Next follow-up", nextDate ? `${dateLabel(nextDate)} (${timezoneLabel()})` : "None scheduled"],
              ["Notes", client.notes || "—"],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="break-words">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusPill value={client.status} />
            {lead && <StatusPill value={lead.stage} />}
          </div>
        </SectionCard>

        <SectionCard title="Activity timeline" className="lg:col-span-2">
          {timeline.length === 0 ? (
            <EmptyState
              title="No activity yet"
              description="Record the first approach or follow-up with “Add action”."
            />
          ) : (
            <ol className="space-y-3">
              {timeline.map((t) => (
                <li key={t.id} className="relative border-l pl-4">
                  <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-medium">{t.type}</span>
                    <span className="text-xs text-muted-foreground">
                      {dateLabel(t.date)} · {t.time} · {sellerName(t.createdBy)}
                    </span>
                  </div>
                  {t.notes && <p className="mt-0.5 break-words text-sm text-muted-foreground">{t.notes}</p>}
                  {t.nextFollowUp && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Next follow-up: {dateLabel(t.nextFollowUp)}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title={`Quotations (${quotations.length})`}>
          {quotations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No quotations yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {quotations.map((qt) => (
                <li key={qt.id} className="flex items-center justify-between gap-2">
                  <Link to="/quotations" className="truncate underline-offset-2 hover:underline">
                    {qt.number}
                  </Link>
                  <span className="shrink-0 text-muted-foreground">
                    {amount(quotationTotals(qt).total, qt.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title={`Orders (${orders.length})`}>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{o.orderNo}</span>
                  <span className="shrink-0 text-muted-foreground">{amount(o.amount, o.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title={`Follow-ups (${followUps.length})`}>
          {followUps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No follow-ups scheduled.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {followUps.slice(0, 8).map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{dateLabel(f.nextDate)} · {f.channel}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {f.completed ? "Done" : f.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <AddActionDialog
        open={actionOpen}
        onOpenChange={setActionOpen}
        clientId={client.id}
        company={client.company}
        contactPerson={client.contactPerson}
        country={client.country}
        phone={client.phone}
        whatsapp={client.whatsapp}
        leadId={lead?.id}
        userId={me.id}
      />
    </div>
  );
}

function AddActionDialog({
  open,
  onOpenChange,
  clientId,
  company,
  contactPerson,
  country,
  phone,
  whatsapp,
  leadId,
  userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  company: string;
  contactPerson: string;
  country: string;
  phone: string;
  whatsapp: string;
  leadId?: string | undefined;
  userId: string;
}) {
  const [type, setType] = useState<string>("Approached");
  const [custom, setCustom] = useState("");
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  const [notes, setNotes] = useState("");
  const [next, setNext] = useState("");
  const [channel, setChannel] = useState<FollowUp["channel"]>("WhatsApp");

  function save() {
    const finalType = type === "Custom Activity" ? custom.trim() || "Custom Activity" : type;
    addTimelineEntry({
      clientId,
      type: finalType,
      notes,
      date,
      time,
      nextFollowUp: next || null,
      leadId,
      auto: false,
    });
    if (next) {
      const followUp: FollowUp = {
        id: uid(),
        company,
        contactPerson,
        country,
        phone,
        whatsapp,
        channel,
        lastContact: date,
        nextDate: next,
        nextTime: "10:00",
        status: "Pending",
        priority: "Medium",
        tags: [],
        assignedTo: userId,
        notes,
        completed: false,
        dataId: clientId,
        ...(leadId ? { leadId } : {}),
      };
      setState((s) => ({ ...s, followUps: [followUp, ...s.followUps] }));
    }
    toast.success(next ? "Action saved and follow-up scheduled" : "Action saved");
    setNotes("");
    setNext("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add action</DialogTitle>
          <DialogDescription>
            Everything you record here appears on this client's timeline.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Action type</Label>
            <select
              className="h-9 w-full rounded-lg border bg-background px-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {ACTIVITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          {type === "Custom Activity" && (
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Custom action name</Label>
              <Input className="h-9" value={custom} onChange={(e) => setCustom(e.target.value)} />
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Date</Label>
            <Input type="date" className="h-9" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Time</Label>
            <Input type="time" className="h-9" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Notes</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Next follow-up (optional)</Label>
            <Input type="date" className="h-9" value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Follow-up channel</Label>
            <select
              className="h-9 w-full rounded-lg border bg-background px-2 text-sm"
              value={channel}
              onChange={(e) => setChannel(e.target.value as FollowUp["channel"])}
            >
              {["WhatsApp", "Call", "Email"].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save}>Save action</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
