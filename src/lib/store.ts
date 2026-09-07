import { useSyncExternalStore } from "react";
import { createInitialState } from "./demo-data";
import type { Activity, CrmState } from "./types";

const KEY = "lepdo-crm-v1";

let state: CrmState = createInitialState();
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
}

export function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = migrate({ ...createInitialState(), ...(JSON.parse(raw) as CrmState) });
  } catch {
    /* ignore corrupt storage */
  }
  emit();
}

/**
 * Refreshes the linkage fields (customer ↔ lead ↔ follow-up ↔ task) on demo
 * records saved before those links existed. Real records are left untouched.
 */
function migrate(s: CrmState): CrmState {
  const fresh = createInitialState();
  const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
  const freshFollowUps = byId(fresh.followUps);
  const freshLeads = byId(fresh.leads);
  const freshTasks = byId(fresh.tasks);
  return {
    ...s,
    data: s.data.map((d) => (d.demo ? { ...d, nextFollowUp: null } : d)),
    followUps: s.followUps.map((f) =>
      f.demo && !f.dataId ? { ...f, dataId: freshFollowUps.get(f.id)?.dataId } : f,
    ),
    leads: s.leads.map((l) =>
      l.demo && !l.dataId
        ? { ...l, dataId: freshLeads.get(l.id)?.dataId, nextFollowUp: null }
        : l,
    ),
    tasks: s.tasks.map((t) => {
      if (!t.demo || t.relatedDataId) return t;
      const f = freshTasks.get(t.id);
      return f ? { ...t, relatedTo: f.relatedTo, relatedDataId: f.relatedDataId } : t;
    }),
  };
}


export function resetDemoData() {
  state = createInitialState();
  persist();
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return state;
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
    () => hydrated,
    () => false,
  );
}

export function setState(updater: (s: CrmState) => CrmState) {
  state = updater(state);
  persist();
  emit();
}

export function getState() {
  return state;
}

export function useCurrentUser() {
  return useCrm((s) => s.users.find((u) => u.id === s.currentUserId) ?? s.users[0]!);
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
  setState((s) => ({
    ...s,
    activity: [
      {
        ...entry,
        id: `a-${Date.now()}`,
        at: new Date().toISOString().slice(0, 16).replace("T", " "),
        userId: s.currentUserId,
      },
      ...s.activity,
    ].slice(0, 200),
  }));
}

export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
