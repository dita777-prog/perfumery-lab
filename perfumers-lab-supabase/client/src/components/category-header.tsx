import { ChevronRight, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

/** Clickable group heading used by the list panels: chevron, label, item count. */
export function CategoryHeader({ label, count, collapsed, onToggle, className = "", style, children }: {
  label: string; count: number; collapsed: boolean; onToggle: () => void;
  className?: string; style?: React.CSSProperties; children?: ReactNode;
}) {
  return (
    <div role="button" tabIndex={0} onClick={onToggle}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
      className={`flex items-center gap-1.5 cursor-pointer select-none hover:bg-secondary/70 ${className}`}
      style={style} aria-expanded={!collapsed} data-testid={`category-header-${label}`}>
      {collapsed ? <ChevronRight size={12} className="shrink-0" /> : <ChevronDown size={12} className="shrink-0" />}
      <span className="flex-1 truncate">{label}</span>
      <span className="text-[10px] font-normal opacity-70">{count}</span>
      {children}
    </div>
  );
}

/** Small "collapse all / expand all" pair */
export function CollapseAllButtons({ onCollapse, onExpand }: { onCollapse: () => void; onExpand: () => void }) {
  const cls = "text-[10px] px-1.5 py-0.5 rounded text-muted-foreground hover:text-foreground";
  return (
    <span className="ml-auto flex gap-1">
      <button className={cls} onClick={onCollapse} data-testid="collapse-all">Collapse all</button>
      <button className={cls} onClick={onExpand} data-testid="expand-all">Expand all</button>
    </span>
  );
}
