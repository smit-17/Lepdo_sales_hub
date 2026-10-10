import { useSyncExternalStore } from "react";
import { createInitialState } from "./demo-data";
import {
  isUuid,
  loadCloud,
  primeFingerprints,
  pushChanges,
  writeAudit,
} from "./cloud";
import type { Activity, CrmState } from "./types";

const KEY = "lepdo-crm-v1";

function emptyState(): CrmState {
  const base = createInitialState();
  return {
    ...base,
    users: [],
    currentUserId: "",
    data: [],
    followUps: [],
    leads: [],
    quotations: [],
    tasks: [],
    orders: [],
    targets: [],
    timeline: [],
    activity: [],
  };
}

let state: CrmState = emptyState();
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** Records saved in this browser before the shared database existed. */
function readLegacyLocal(): CrmState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    return { ...createInitialState(), ...(JSON.parse(raw) as CrmState) };
  } catch {
    return null;
  }
}

export async function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const cloud = await loadCloud();
    if (cloud) {
      state = { ...state, ...cloud } as CrmState;
      primeFingerprints(state);
      await importLegacyOnce();
    }
  } catch (err) {
    console.error("Could not load your workspace", err);
  }
  emit();
}

/**
 * The very first time an account opens the cloud workspace with an empty
 * database, any records still sitting in this browser are uploaded so nothing
 * the team entered before is lost.
 */
async function importLegacyOnce() {
  if (state.data.length) return;
  const legacy = readLegacyLocal();
  if (!legacy || !legacy.data.length) return;
  const me = state.currentUserId;
  const ids = new Map<string, string>();
  const id = (old?: string | null) => {
    if (!old) return undefined;
    if (isUuid(old)) return old;
    if (!ids.has(old)) ids.set(old, crypto.randomUUID());
    return ids.get(old)!;
  };
  const imported: CrmState = {
    ...state,
    data: legacy.data.map((d) => ({
      ...d,
      id: id(d.id)!,
      assignedTo: me,
      createdBy: me,
    })),
    leads: legacy.leads.map((l) => ({
      ...l,
      id: id(l.id)!,
      dataId: id(l.dataId),
      assignedTo: me,
    })),
    followUps: legacy.followUps.map((f) => ({
      ...f,
      id: id(f.id)!,
      dataId: id(f.dataId ?? f.relatedId),
      leadId: id(f.leadId),
      assignedTo: me,
    })),
    quotations: legacy.quotations.map((q) => ({
      ...q,
      id: id(q.id)!,
      dataId: id(q.dataId),
      leadId: id(q.leadId),
      assignedTo: me,
      createdBy: me,
    })),
    tasks: legacy.tasks.map((t) => ({
      ...t,
      id: id(t.id)!,
      relatedDataId: id(t.relatedDataId),
      assignedTo: me,
    })),
  };
  // one lead per client only — the database keeps a single pipeline state
  const seen = new Set<string>();
  imported.leads = imported.leads.filter((l) => {
    if (!l.dataId || seen.has(l.dataId)) return false;
    seen.add(l.dataId);
    return true;
  });
  state = imported;
  pushChanges(state);
  try {
    window.localStorage.setItem(`${KEY}-imported`, new Date().toISOString());
    window.localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

export async function reloadFromCloud() {
  const cloud = await loadCloud();
  if (cloud) {
    state = { ...state, ...cloud } as CrmState;
    primeFingerprints(state);
    emit();
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useCrm<T>(selector: (s: CrmState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  );
}

export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => hydrated && !!state.currentUserId,
    () => false,
  );
}

export function setState(updater: (s: CrmState) => CrmState) {
  state = updater(state);
  pushChanges(state);
  emit();
}

export function getState() {
  return state;
}

const FALLBACK_USER = {
  id: "",
  name: "Loading…",
  email: "",
  phone: "",
  role: "seller" as const,
  department: "",
  monthlyGoal: 0,
  active: true,
};

export function useCurrentUser() {
  return useCrm(
    (s) => s.users.find((u) => u.id === s.currentUserId) ?? s.users[0] ?? FALLBACK_USER,
  );
}

export function isAdmin(userId: string, s: CrmState = state) {
  return s.users.find((u) => u.id === userId)?.role === "super_admin";
}

/** Row-level privacy: sellers only ever receive their own records. */
export function scope<T extends { assignedTo?: string; createdBy?: string; id?: string }>(
  rows: T[],
  s: CrmState = state,
): T[] {
  if (isAdmin(s.currentUserId, s)) return rows;
  return rows.filter(
    (r) => r.assignedTo === s.currentUserId || r.createdBy === s.currentUserId,
  );
}

export function logActivity(entry: Omit<Activity, "id" | "at" | "userId">) {
  const userId = state.currentUserId;
  void writeAudit(entry, userId);
  setState((s) => ({
    ...s,
    activity: [
      {
        ...entry,
        id: crypto.randomUUID(),
        at: new Date().toISOString().slice(0, 16).replace("T", " "),
        userId,
      },
      ...s.activity,
    ].slice(0, 200),
  }));
}

export function uid(_prefix?: string) {
  return crypto.randomUUID();
}
