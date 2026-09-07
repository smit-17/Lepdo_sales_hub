import { useEffect } from "react";
import { consumeQuickAdd, onQuickAdd, type QuickAddModule } from "./quick-add";

export function useQuickAdd(module: QuickAddModule, open: () => void) {
  useEffect(() => {
    if (consumeQuickAdd(module)) open();
    const off = onQuickAdd((m) => {
      if (m === module && consumeQuickAdd(module)) open();
    });
    return () => {
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module]);
}
