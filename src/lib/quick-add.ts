export type QuickAddModule = "data" | "followup" | "lead" | "quotation" | "task";

const listeners = new Set<(m: QuickAddModule) => void>();
let pending: QuickAddModule | null = null;

export function requestQuickAdd(module: QuickAddModule) {
  pending = module;
  listeners.forEach((l) => l(module));
}

export function consumeQuickAdd(module: QuickAddModule) {
  if (pending === module) {
    pending = null;
    return true;
  }
  return false;
}

export function onQuickAdd(cb: (m: QuickAddModule) => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
