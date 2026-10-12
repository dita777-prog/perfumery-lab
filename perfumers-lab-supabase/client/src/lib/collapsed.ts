import { useState } from "react";

/** Which category groups are folded in a list; remembered per browser (localStorage, failures ignored). */
export function useCollapsed(storageKey: string) {
  const [set, setSet] = useState<Set<string>>(() => {
    try { return new Set<string>(JSON.parse(localStorage.getItem(storageKey) || "[]")); } catch { return new Set<string>(); }
  });
  const save = (next: Set<string>) => {
    setSet(next);
    try { localStorage.setItem(storageKey, JSON.stringify(Array.from(next))); } catch { /* ignore */ }
  };
  return {
    isCollapsed: (key: string) => set.has(key),
    toggle: (key: string) => { const n = new Set(set); if (n.has(key)) n.delete(key); else n.add(key); save(n); },
    collapseAll: (keys: string[]) => save(new Set(keys)),
    expandAll: () => save(new Set<string>()),
  };
}
