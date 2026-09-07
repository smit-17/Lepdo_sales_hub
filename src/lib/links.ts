/**
 * Record linkage helpers.
 *
 * Data records, leads and follow-ups describe the same customer, so the
 * "next follow-up" date must be derived from a single source of truth — the
 * pending follow-up activities — instead of being stored separately on each
 * record and drifting apart.
 */
import type { CrmState, FollowUp } from "./types";

const key = (v?: string | null) => (v ?? "").trim().toLowerCase();

/** Every follow-up that belongs to the same customer as the given record. */
export function followUpsFor(
  followUps: FollowUp[],
  ref: { id?: string; dataId?: string | undefined; company?: string },
): FollowUp[] {
  return followUps.filter((f) => {
    if (f.archived) return false;
    if (ref.id && (f.relatedId === ref.id || f.leadId === ref.id || f.dataId === ref.id)) return true;
    if (ref.dataId && (f.relatedId === ref.dataId || f.dataId === ref.dataId)) return true;
    return !!ref.company && key(f.company) === key(ref.company);
  });
}

/** The earliest pending follow-up for a customer, or null when none is open. */
export function nextPendingFollowUp(
  followUps: FollowUp[],
  ref: { id?: string; dataId?: string | undefined; company?: string },
): FollowUp | null {
  const open = followUpsFor(followUps, ref)
    .filter((f) => !f.completed)
    .sort((a, b) => `${a.nextDate}${a.nextTime}`.localeCompare(`${b.nextDate}${b.nextTime}`));
  return open[0] ?? null;
}

/** Consistent next follow-up date shown in Data, Leads and the Dashboard. */
export function nextFollowUpDate(
  state: Pick<CrmState, "followUps">,
  ref: { id?: string; dataId?: string | undefined; company?: string; nextFollowUp?: string | null },
): string | null {
  const next = nextPendingFollowUp(state.followUps, ref);
  return next ? next.nextDate : (ref.nextFollowUp ?? null);
}

/** The local IANA timezone label shown next to dates. */
export function timezoneLabel() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Local time";
  } catch {
    return "Local time";
  }
}
