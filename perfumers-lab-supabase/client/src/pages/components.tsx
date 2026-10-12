import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useMemo, useState } from "react";
import { Plus, Search, Pencil, Tag, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { postJson, patchJson, fmtNum } from "@/lib/api";
import { supabase } from "@/lib/supabase";

export const COMPONENT_CATEGORIES: Record<string, string> = {
  glass: "Glass",
  closure: "Closures",
  stick: "Diffuser sticks",
  wick: "Wicks",
  wax: "Wax",
  carrier: "Carrier base",
  label: "Labels",
  paper_box: "Paper packaging",
  ceramic: "Ceramic vessels",
  diffuser_device: "Diffuser devices",
  other: "Other (tools, marketing)",
};

const COST_TYPES = ["material", "sample", "tool", "marketing", "setup", "freight"];
const CURRENCIES = ["EUR", "CZK", "USD"];

const invalidateCosts = () => {
  for (const key of [
    "/api/components",
    "/api/component-sources",
    "/api/component-movements",
    "/api/purchase-documents",
    "/api/component-cost-current",
    "/api/product-cost",
  ]) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
};

const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

type SpecField = { key: string; label: string; col?: string; numeric?: boolean };
// real columns (col) or free-form values kept in components.specs (single-word keys only)
const SPEC_FIELDS: Record<string, SpecField[]> = {
  glass: [
    { key: "volumeMl", col: "volumeMl", label: "Volume (ml)", numeric: true },
    { key: "neckSize", col: "neckSize", label: "Neck size" },
    { key: "unitWeightG", col: "unitWeightG", label: "Weight (g)", numeric: true },
    { key: "color", label: "Colour" },
  ],
  ceramic: [
    { key: "volumeMl", col: "volumeMl", label: "Volume (ml)", numeric: true },
    { key: "unitWeightG", col: "unitWeightG", label: "Weight (g)", numeric: true },
    { key: "diameter", label: "Diameter (mm)" },
    { key: "height", label: "Height (mm)" },
    { key: "color", label: "Colour / glaze" },
  ],
  closure: [
    { key: "neckSize", col: "neckSize", label: "Neck size" },
    { key: "material", label: "Material" },
    { key: "color", label: "Colour" },
  ],
  stick: [
    { key: "length", label: "Length (mm)" },
    { key: "diameter", label: "Diameter (mm)" },
    { key: "material", label: "Material" },
  ],
  wick: [
    { key: "series", label: "Series" },
    { key: "diameter", label: "For vessel diameter (mm)" },
    { key: "material", label: "Material" },
  ],
  wax: [
    { key: "type", label: "Wax type" },
    { key: "melting", label: "Melting point (°C)" },
  ],
  carrier: [{ key: "type", label: "Type" }],
  label: [{ key: "size", label: "Size (mm)" }, { key: "material", label: "Material" }],
  paper_box: [{ key: "size", label: "Size (mm)" }, { key: "material", label: "Material" }],
  diffuser_device: [
    { key: "model", label: "Model" },
    { key: "power", label: "Power" },
    { key: "color", label: "Colour" },
  ],
  other: [],
};

export default function ComponentsPage() {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState<"line" | "type">("line");
  const [showCreate, setShowCreate] = useState(false);
  const [showAddLine, setShowAddLine] = useState(false);
  const [showPurchase, setShowPurchase] = useState(false);
  const [showMovement, setShowMovement] = useState(false);
  const [showTooling, setShowTooling] = useState(false);
  const [editSource, setEditSource] = useState<any>(null);
  const [fxDoc, setFxDoc] = useState<any>(null);

  const { data: components = [] } = useQuery<any[]>({ queryKey: ["/api/components"] });
  const { data: lines = [] } = useQuery<any[]>({ queryKey: ["/api/component-lines"] });
  const { data: costs = [] } = useQuery<any[]>({ queryKey: ["/api/component-cost-current"] });
  const { data: sources = [] } = useQuery<any[]>({ queryKey: ["/api/component-sources"] });
  const { data: documents = [] } = useQuery<any[]>({ queryKey: ["/api/purchase-documents"] });
  const { data: suppliers = [] } = useQuery<any[]>({ queryKey: ["/api/suppliers"] });
  const { data: tooling = [] } = useQuery<any[]>({ queryKey: ["/api/tooling-costs"] });

  const costById = useMemo(() => new Map(costs.map((c: any) => [c.componentId, c])), [costs]);
  const docById = useMemo(() => new Map(documents.map((d: any) => [d.id, d])), [documents]);
  const supplierById = useMemo(() => new Map(suppliers.map((s: any) => [s.id, s])), [suppliers]);

  const filtered = components.filter((c: any) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()));

  // a component with several lines is listed under each of them
  const grouped = useMemo(() => {
    if (groupBy === "type") {
      return Object.keys(COMPONENT_CATEGORIES)
        .map(k => ({ key: k, label: COMPONENT_CATEGORIES[k], items: filtered.filter((c: any) => c.category === k) }))
        .filter(g => g.items.length > 0);
    }
    const out = lines.map((l: any) => ({
      key: l.id, label: l.name,
      items: filtered.filter((c: any) => (c.lines ?? []).includes(l.name)),
    }));
    const known = new Set(lines.map((l: any) => l.name));
    out.push({
      key: "none", label: "No line yet",
      items: filtered.filter((c: any) => !(c.lines ?? []).some((n: string) => known.has(n))),
    });
    return out.filter(g => g.items.length > 0);
  }, [groupBy, filtered, lines]);

  const selected = components.find((c: any) => c.id === selectedId);
  const selCost = selected ? costById.get(selected.id) : null;
  const selTooling = selected ? tooling.filter((t: any) => t.componentId === selected.id) : [];
  const selSources = selected ? sources.filter((s: any) => s.componentId === selected.id) : [];

  const patch = useMutation({
    mutationFn: (body: any) => patchJson(`/api/components/${selected!.id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/components"] }),
    onError: (e: any) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  const toggleLine = (name: string) => {
    const cur: string[] = selected.lines ?? [];
    patch.mutate({ lines: cur.includes(name) ? cur.filter(n => n !== name) : [...cur, name] });
  };

  return (
    <div className="panel-layout h-full">
      <div className={`border-r border-border flex-col h-full overflow-hidden ${selectedId ? "hidden md:flex" : "flex"}`}>
        <div className="p-3 pl-12 md:pl-3 border-b border-border flex items-center gap-2">
          <h2 className="text-sm font-semibold flex-1">Components</h2>
          <Button size="sm" variant="ghost" onClick={() => setShowAddLine(true)} title="Add product line" data-testid="button-add-line">
            <Tag size={14} />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowCreate(true)} data-testid="button-add-component">
            <Plus size={14} />
          </Button>
        </div>
        <div className="px-3 pt-2 flex gap-1">
          {(["line", "type"] as const).map(g => (
            <button key={g} onClick={() => setGroupBy(g)} data-testid={`group-by-${g}`}
              className={`text-[10px] px-2 py-1 rounded-full border ${groupBy === g
                ? "border-[hsl(183,70%,36%)] bg-[hsl(183,70%,36%)]/15" : "border-border text-muted-foreground"}`}>
              {g === "line" ? "By product line" : "By type"}
            </button>
          ))}
        </div>
        <div className="px-3 py-2 relative">
          <Search size={12} className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-7 h-7 text-xs" placeholder="Filter..." value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex-1 overflow-y-auto">
          {grouped.map(g => (
            <div key={g.key}>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {g.label}
              </div>
              {g.items.map((c: any) => {
                const cost = costById.get(c.id);
                return (
                  <div key={`${g.key}-${c.id}`}
                    className={`px-3 py-2 cursor-pointer hover:bg-secondary/50 border-b border-border/30
                      ${selectedId === c.id ? "bg-[hsl(183,70%,36%)]/10" : ""}`}
                    onClick={() => setSelectedId(c.id)}
                    data-testid={`component-item-${c.id}`}>
                    <p className="text-sm font-medium">{c.name}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                      {groupBy === "line" && <span>{COMPONENT_CATEGORIES[c.category] ?? c.category}</span>}
                      <span>{fmtNum(c.stockQty, 2)} {c.unit}</span>
                      <span className="font-mono">
                        {cost?.wavgLandedCostEur != null ? `€ ${fmtNum(cost.wavgLandedCostEur, 4)}` : "€ —"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          {grouped.length === 0 && (
            <p className="p-4 text-xs text-muted-foreground">No components yet.</p>
          )}
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto ${selectedId ? "" : "hidden md:block"}`}>
        {selected ? (
          <div>
            <button className="md:hidden flex items-center gap-1 p-3 pl-12 text-sm text-muted-foreground hover:text-foreground border-b border-border w-full"
              onClick={() => setSelectedId(null)}>
              <ChevronRight className="rotate-180 h-4 w-4" /> Back to list
            </button>
            <div className="p-6 max-w-4xl space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <InlineText key={`name-${selected.id}`} className="text-xl font-semibold" value={selected.name}
                    onSave={(v) => v.trim() && patch.mutate({ name: v.trim() })} />
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge variant="secondary">{COMPONENT_CATEGORIES[selected.category] ?? selected.category}</Badge>
                    {(selected.lines ?? []).map((n: string) => <Badge key={n} variant="outline">{n}</Badge>)}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                  <Button size="sm" variant="outline" onClick={() => setShowMovement(true)}
                    disabled={selSources.length === 0} data-testid="button-component-movement">
                    Usage / correction
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowTooling(true)} data-testid="button-add-tooling">
                    Add tooling
                  </Button>
                  <Button size="sm" onClick={() => setShowPurchase(true)} data-testid="button-add-purchase">
                    <Plus size={14} className="mr-1" /> Add purchase
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="In stock" value={`${fmtNum(selected.stockQty, 2)} ${selected.unit}`} />
                <StatCard label="Last landed cost" hint="next production run"
                  value={selCost?.lastLandedCostEur != null ? `€ ${fmtNum(selCost.lastLandedCostEur, 4)}` : "—"} />
                <StatCard label="Weighted avg. of stock" hint="margin on goods in stock"
                  value={selCost?.wavgLandedCostEur != null ? `€ ${fmtNum(selCost.wavgLandedCostEur, 4)}` : "—"} />
                <StatCard label="Stock value"
                  value={selCost?.stockValueEur != null ? `€ ${fmtNum(selCost.stockValueEur, 2)}` : "—"} />
              </div>

              <section className="bg-card rounded-lg border border-border p-4 space-y-4">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1.5">Product lines (click to add or remove)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {lines.map((l: any) => {
                      const on = (selected.lines ?? []).includes(l.name);
                      return (
                        <button key={l.id} onClick={() => toggleLine(l.name)} data-testid={`toggle-line-${l.name}`}
                          className={`text-xs px-2.5 py-1 rounded-full border ${on
                            ? "border-[hsl(183,70%,36%)] bg-[hsl(183,70%,36%)]/15" : "border-border text-muted-foreground hover:bg-secondary/50"}`}>
                          {l.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="text-[10px] text-muted-foreground">Type
                    <Select value={selected.category} onValueChange={(v) => patch.mutate({ category: v })}>
                      <SelectTrigger className="mt-1 h-8 text-xs text-foreground"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(COMPONENT_CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="text-[10px] text-muted-foreground">Preferred supplier
                    <Select value={selected.supplierId ?? "none"}
                      onValueChange={(v) => patch.mutate({ supplierId: v === "none" ? null : v })}>
                      <SelectTrigger className="mt-1 h-8 text-xs text-foreground"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </label>
                  {(SPEC_FIELDS[selected.category] ?? []).map(f => {
                    const raw = f.col ? selected[f.col] : (selected.specs ?? {})[f.key];
                    return (
                      <InlineField key={`${selected.id}-${f.key}`} label={f.label}
                        value={raw == null ? "" : String(f.numeric ? Number(raw) : raw)}
                        onSave={(v) => {
                          if (f.col) patch.mutate({ [f.col]: f.numeric ? num(v) : (v.trim() || null) });
                          else patch.mutate({ specs: { ...(selected.specs ?? {}), [f.key]: v.trim() } });
                        }} />
                    );
                  })}
                  <InlineField key={`${selected.id}-reorder`} label={`Reorder threshold (${selected.unit})`}
                    value={selected.reorderThreshold == null ? "" : String(Number(selected.reorderThreshold))}
                    onSave={(v) => patch.mutate({ reorderThreshold: num(v) })} />
                </div>

                <label className="text-[10px] text-muted-foreground block">Notes
                  <Textarea key={`notes-${selected.id}`} className="mt-1 text-xs text-foreground min-h-[60px]"
                    defaultValue={selected.notes ?? ""}
                    onBlur={(e) => { if (e.target.value !== (selected.notes ?? "")) patch.mutate({ notes: e.target.value || null }); }} />
                </label>
              </section>

              <section>
                <h3 className="text-sm font-semibold mb-2">Purchases ({selSources.length})</h3>
                <div className="space-y-2">
                  {selSources.map((s: any) => {
                    const doc: any = docById.get(s.purchaseDocumentId);
                    const sup: any = doc ? supplierById.get(doc.supplierId) : null;
                    const cur = doc?.currency ?? "EUR";
                    return (
                      <div key={s.id} className="bg-card rounded-lg p-3 border border-border" data-testid={`purchase-card-${s.id}`}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="text-xs">
                            <span className="font-medium">{sup?.name ?? "No supplier"}</span>
                            <span className="text-muted-foreground"> · invoice {doc?.documentNo ?? "—"} · {s.purchaseDate}</span>
                            {s.costType !== "material" && <Badge variant="outline" className="ml-2 text-[9px]">{s.costType}</Badge>}
                            {doc && !doc.vatRecoverable && Number(s.vatRate) > 0 &&
                              <Badge variant="outline" className="ml-2 text-[9px]">VAT = cost</Badge>}
                          </div>
                          <button className="text-muted-foreground hover:text-foreground" aria-label="Edit purchase"
                            onClick={() => setEditSource(s)} data-testid={`button-edit-purchase-${s.id}`}>
                            <Pencil size={13} />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-xs">
                          <KV k="Quantity" v={fmtNum(s.purchaseQuantity, 2)} />
                          <KV k={`Unit net (${cur})`} v={fmtNum(s.unitPriceNet, 4)} />
                          <KV k="VAT %" v={fmtNum(s.vatRate, 2)} />
                          <KV k={`Unit gross (${cur})`} v={fmtNum(s.unitPriceGross, 4)} />
                          <KV k="Freight / unit" v={fmtNum(s.freightShare, 4)} />
                          <KV k={`Landed (${cur})`} v={fmtNum(s.landedUnitCost, 4)} />
                          <div>
                            <div className="text-[10px] text-muted-foreground">Landed €</div>
                            {s.landedUnitCostEur != null
                              ? (doc && cur !== "EUR"
                                ? <button className="font-mono underline decoration-dotted underline-offset-2 hover:text-foreground"
                                    title="Correct the FX rate" onClick={() => setFxDoc(doc)}>{fmtNum(s.landedUnitCostEur, 4)}</button>
                                : <span className="font-mono">{fmtNum(s.landedUnitCostEur, 4)}</span>)
                              : <button className="text-yellow-500 underline underline-offset-2 hover:text-yellow-400"
                                  onClick={() => doc && setFxDoc(doc)} data-testid={`button-fx-missing-${s.id}`}>FX missing — enter rate</button>}
                          </div>
                          <KV k="Left in stock" v={fmtNum(s.stockQty, 2)} />
                        </div>
                      </div>
                    );
                  })}
                  {selSources.length === 0 && (
                    <p className="text-xs text-muted-foreground bg-card border border-border rounded-lg p-4 text-center">No purchases yet.</p>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Landed cost = net price + allocated freight + per-unit setup (+ VAT when it is not recoverable).
                  Finished batches keep the cost they were made with.
                </p>
              </section>

              {selTooling.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold mb-2">One-off tooling (amortised per finished unit, not in landed cost)</h3>
                  <div className="space-y-2">
                    {selTooling.map((t: any) => (
                      <div key={t.id} className="bg-card rounded-lg p-3 border border-border flex flex-wrap justify-between gap-2 text-xs">
                        <span>{t.description}</span>
                        <span className="font-mono">{fmtNum(t.cost)} {t.currency}</span>
                        <span className="text-muted-foreground">over {t.amortiseOverUnits} units</span>
                        <span className="font-mono">
                          € {fmtNum((Number(t.cost) * Number(t.fxRateToEur)) / Number(t.amortiseOverUnits), 4)} / unit
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Select a component
          </div>
        )}
      </div>

      <CreateComponentDialog open={showCreate} onOpenChange={setShowCreate} onCreated={setSelectedId} />
      <AddLineDialog open={showAddLine} onOpenChange={setShowAddLine} count={lines.length} />
      <FxDialog doc={fxDoc} onClose={() => setFxDoc(null)} />
      <EditPurchaseDialog source={editSource} onClose={() => setEditSource(null)}
        currency={(docById.get(editSource?.purchaseDocumentId) as any)?.currency ?? "EUR"} />
      {selected && (
        <>
          <AddToolingDialog open={showTooling} onOpenChange={setShowTooling} component={selected} />
          <AddPurchaseDialog open={showPurchase} onOpenChange={setShowPurchase} component={selected}
            documents={documents} suppliers={suppliers} />
          <MovementDialog open={showMovement} onOpenChange={setShowMovement} component={selected}
            sources={selSources} docById={docById} />
        </>
      )}
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground">{k}</div>
      <span className="font-mono">{v}</span>
    </div>
  );
}

/** Text that saves when you leave the field */
function InlineText({ value, onSave, className }: { value: string; onSave: (v: string) => void; className?: string }) {
  const [v, setV] = useState(value);
  return (
    <input className={`bg-transparent w-full outline-none border-b border-transparent focus:border-border ${className ?? ""}`}
      value={v} onChange={e => setV(e.target.value)}
      onBlur={() => { if (v !== value) onSave(v); }} />
  );
}

function InlineField({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <label className="text-[10px] text-muted-foreground">
      {label}
      <Input className="mt-1 h-8 text-xs text-foreground" value={v} onChange={e => setV(e.target.value)}
        onBlur={() => { if (v !== value) onSave(v); }} />
    </label>
  );
}

function AddLineDialog({ open, onOpenChange, count }: any) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const mutation = useMutation({
    mutationFn: () => postJson("/api/component-lines", { name: name.trim(), sortOrder: count + 1 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/component-lines"] });
      setName(""); onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Could not add line", description: e.message, variant: "destructive" }),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader><DialogTitle>New product line</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="e.g. Room spray" value={name} onChange={e => setName(e.target.value)} data-testid="input-line-name" />
          <Button className="w-full" disabled={!name.trim() || mutation.isPending} onClick={() => mutation.mutate()}>Add</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-card rounded-lg p-3 border border-border">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <p className="text-sm mt-0.5 font-mono">{value}</p>
      {hint && <span className="text-[9px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

function CreateComponentDialog({ open, onOpenChange, onCreated }: any) {
  const { toast } = useToast();
  const [category, setCategory] = useState("glass");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [volumeMl, setVolumeMl] = useState("");
  const [neckSize, setNeckSize] = useState("");
  const [sku, setSku] = useState("");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: (data: any) => postJson<any>("/api/components", data),
    onSuccess: (created) => {
      invalidateCosts();
      onOpenChange(false);
      onCreated?.(created.id);
      setName(""); setVolumeMl(""); setNeckSize(""); setSku(""); setNotes("");
      toast({ title: "Component created" });
    },
    onError: (e: any) => toast({ title: "Could not create component", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader><DialogTitle>New component</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(COMPONENT_CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Name" value={name} onChange={e => setName(e.target.value)} data-testid="input-component-name" />
          <div className="grid grid-cols-2 gap-2">
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["pcs", "kg", "l", "m"].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="SKU (optional)" value={sku} onChange={e => setSku(e.target.value)} />
            <Input placeholder="Volume ml (optional)" value={volumeMl} onChange={e => setVolumeMl(e.target.value)} />
            <Input placeholder="Neck size, e.g. 24/410" value={neckSize} onChange={e => setNeckSize(e.target.value)} />
          </div>
          <Textarea placeholder="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
          <Button className="w-full" disabled={!name.trim() || mutation.isPending}
            onClick={() => mutation.mutate({
              category, name: name.trim(), unit, sku: sku || null,
              volumeMl: num(volumeMl), neckSize: neckSize || null, notes: notes || null,
            })} data-testid="button-create-component">
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddPurchaseDialog({ open, onOpenChange, component, documents, suppliers }: any) {
  const { toast } = useToast();
  const [docMode, setDocMode] = useState<string>("new"); // "new" or an existing document id
  // new invoice
  const [supplierId, setSupplierId] = useState("");
  const [documentNo, setDocumentNo] = useState("");
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().slice(0, 10));
  const [currency, setCurrency] = useState("EUR");
  const [fx, setFx] = useState("");
  const [goodsSubtotal, setGoodsSubtotal] = useState("");
  const [freight, setFreight] = useState("");
  const [otherCharges, setOtherCharges] = useState("");
  const [vatRate, setVatRate] = useState("0");
  const [vatRecoverable, setVatRecoverable] = useState(true);
  // line
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [qty, setQty] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [setup, setSetup] = useState("");
  const [costType, setCostType] = useState("material");
  const [notes, setNotes] = useState("");

  const existing = documents.find((d: any) => d.id === docMode);
  const freightNum = num(freight) ?? 0;
  const otherNum = num(otherCharges) ?? 0;
  const needsSubtotal = docMode === "new" && freightNum + otherNum > 0 && !num(goodsSubtotal);

  const mutation = useMutation({
    mutationFn: async () => {
      let docId: string | null = null;
      if (docMode === "new") {
        if (documentNo.trim()) {
          const doc = await postJson<any>("/api/purchase-documents", {
            supplierId: supplierId || null,
            documentNo: documentNo.trim(),
            documentDate,
            currency,
            fxRateToEur: currency === "EUR" ? 1 : ((num(fx) ?? 0) > 0 ? Math.round(1e6 / num(fx)!) / 1e6 : null),
            goodsSubtotal: num(goodsSubtotal),
            freightTotal: freightNum,
            otherCharges: otherNum,
            vatRate: num(vatRate) ?? 0,
            vatRecoverable,
          });
          docId = doc.id;
        }
      } else {
        docId = docMode;
      }
      return postJson("/api/component-sources", {
        componentId: component.id,
        purchaseDocumentId: docId,
        purchaseDate,
        purchaseQuantity: num(qty),
        unitPriceNet: num(unitPrice),
        setupCharge: num(setup) ?? 0,
        costType,
        notes: notes || null,
      });
    },
    onSuccess: () => {
      invalidateCosts();
      onOpenChange(false);
      setQty(""); setUnitPrice(""); setSetup(""); setNotes(""); setDocMode("new");
      setDocumentNo(""); setFx(""); setGoodsSubtotal(""); setFreight(""); setOtherCharges("");
      toast({ title: "Purchase added" });
    },
    onError: (e: any) => toast({ title: "Could not add purchase", description: e.message, variant: "destructive" }),
  });

  const valid = !!num(qty) && num(qty)! > 0 && num(unitPrice) != null && !needsSubtotal;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add purchase — {component.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-muted-foreground">Invoice</label>
            <Select value={docMode} onValueChange={setDocMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New invoice / no invoice</SelectItem>
                {documents.map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.documentNo} · {d.documentDate} · {d.currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {docMode === "new" ? (
            <div className="border border-border rounded-md p-3 space-y-2">
              <p className="text-[10px] text-muted-foreground">
                Leave the invoice number empty to record a purchase without an invoice (cost in EUR, no freight/VAT).
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue placeholder="Supplier" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input placeholder="Invoice no." value={documentNo} onChange={e => setDocumentNo(e.target.value)} />
                <Input type="date" value={documentDate} onChange={e => setDocumentDate(e.target.value)} />
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                {currency !== "EUR" && (
                  <Input placeholder={`FX: 1 EUR = ? ${currency} (can be added later)`} value={fx}
                    onChange={e => setFx(e.target.value)} className="col-span-2" />
                )}
                <Input placeholder="Goods subtotal (net)" value={goodsSubtotal} onChange={e => setGoodsSubtotal(e.target.value)} />
                <Input placeholder="Freight total" value={freight} onChange={e => setFreight(e.target.value)} />
                <Input placeholder="Other charges (customs, fees)" value={otherCharges} onChange={e => setOtherCharges(e.target.value)} />
                <Input placeholder="VAT rate %" value={vatRate} onChange={e => setVatRate(e.target.value)} />
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Switch checked={vatRecoverable} onCheckedChange={setVatRecoverable} />
                <span>VAT is recoverable</span>
                {!vatRecoverable && <span className="text-muted-foreground">(VAT is added to the cost)</span>}
              </div>
              {needsSubtotal && (
                <p className="text-[11px] text-yellow-500">
                  With freight, enter the invoice goods subtotal first, so every line is allocated against the same base.
                </p>
              )}
            </div>
          ) : (
            existing && (
              <p className="text-[11px] text-muted-foreground">
                Freight and VAT come from this invoice (freight {fmtNum(existing.freightTotal)} {existing.currency}, VAT {fmtNum(existing.vatRate)} %
                {existing.vatRecoverable ? ", recoverable" : ", not recoverable"}).
              </p>
            )
          )}

          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
            <Select value={costType} onValueChange={setCostType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{COST_TYPES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder={`Quantity (${component.unit})`} value={qty} onChange={e => setQty(e.target.value)} data-testid="input-purchase-qty" />
            <Input placeholder="Unit price net" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} data-testid="input-purchase-price" />
            <Input placeholder="Setup charge for this run (optional)" value={setup} onChange={e => setSetup(e.target.value)} className="col-span-2" />
          </div>
          <Textarea placeholder="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
          <Button className="w-full" disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}
            data-testid="button-save-purchase">
            Save purchase
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MovementDialog({ open, onOpenChange, component, sources, docById }: any) {
  const { toast } = useToast();
  const [sourceId, setSourceId] = useState("");
  const [type, setType] = useState("out");
  const [qty, setQty] = useState("");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: () => {
      const q = Math.abs(num(qty) ?? 0);
      // out = consumption (negative), in = added back (positive), correction = signed as typed
      const delta = type === "out" ? -q : type === "in" ? q : (num(qty) ?? 0);
      return postJson("/api/component-movements", {
        componentId: component.id,
        componentSourceId: sourceId,
        movementType: type,
        qtyDelta: delta,
        notes: notes || null,
      });
    },
    onSuccess: () => {
      invalidateCosts();
      onOpenChange(false);
      setQty(""); setNotes("");
      toast({ title: "Stock updated" });
    },
    onError: (e: any) => toast({ title: "Could not save movement", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader><DialogTitle>Usage / correction — {component.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Select value={sourceId} onValueChange={setSourceId}>
            <SelectTrigger><SelectValue placeholder="From which purchase" /></SelectTrigger>
            <SelectContent>
              {sources.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.purchaseDate} · {docById.get(s.purchaseDocumentId)?.documentNo ?? "no invoice"} · {fmtNum(s.stockQty, 2)} left
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="out">Used / consumed (−)</SelectItem>
              <SelectItem value="in">Added back (+)</SelectItem>
              <SelectItem value="correction">Correction (signed, e.g. -3 or 5)</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder={`Quantity (${component.unit})`} value={qty} onChange={e => setQty(e.target.value)} />
          <Input placeholder="Note" value={notes} onChange={e => setNotes(e.target.value)} />
          <Button className="w-full" disabled={!sourceId || !num(qty) || mutation.isPending}
            onClick={() => mutation.mutate()} data-testid="button-save-movement">
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddToolingDialog({ open, onOpenChange, component }: any) {
  const { toast } = useToast();
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [currency, setCurrency] = useState("CZK");
  const [fx, setFx] = useState("");
  const [units, setUnits] = useState("");

  const mutation = useMutation({
    mutationFn: () => postJson("/api/tooling-costs", {
      componentId: component.id, description: description.trim(), cost: num(cost), currency,
      fxRateToEur: currency === "EUR" ? 1 : Math.round(1e6 / num(fx)!) / 1e6,
      amortiseOverUnits: Math.round(num(units) ?? 0),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tooling-costs"] });
      onOpenChange(false); setDescription(""); setCost(""); setUnits(""); setFx("");
    },
    onError: (e: any) => toast({ title: "Could not save tooling", description: e.message, variant: "destructive" }),
  });

  const valid = description.trim() && num(cost) != null && (num(units) ?? 0) > 0 &&
    (currency === "EUR" || (num(fx) ?? 0) > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader><DialogTitle>One-off tooling — {component.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Description, e.g. cutting die" value={description} onChange={e => setDescription(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Cost" value={cost} onChange={e => setCost(e.target.value)} />
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["CZK", "EUR", "USD"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            {currency !== "EUR" && (
              <Input className="col-span-2" placeholder={`FX: 1 EUR = ? ${currency}`} value={fx} onChange={e => setFx(e.target.value)} />
            )}
            <Input className="col-span-2" placeholder="Expected lifetime volume (units) to spread it over" value={units} onChange={e => setUnits(e.target.value)} />
          </div>
          <Button className="w-full" disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}
            data-testid="button-save-tooling">
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditPurchaseDialog({ source, onClose, currency }: any) {
  const { toast } = useToast();
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const [vat, setVat] = useState("");
  const [freight, setFreight] = useState("");
  const [setup, setSetup] = useState("");
  const [loadedId, setLoadedId] = useState<string | null>(null);

  if (source && loadedId !== source.id) {
    setLoadedId(source.id);
    setPrice(String(Number(source.unitPriceNet)));
    setQty(String(Number(source.purchaseQuantity)));
    setVat(String(Number(source.vatRate)));
    setFreight(String(Number(source.freightShare)));
    setSetup(String(Number(source.setupCharge)));
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("update_component_purchase", {
        p_source_id: source.id,
        p_unit_price_net: num(price),
        p_purchase_quantity: num(qty),
        p_vat_rate: num(vat),
        p_freight_share: num(freight),
        p_setup_charge: num(setup),
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      for (const key of ["/api/component-sources", "/api/components", "/api/component-cost-current"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      setLoadedId(null);
      onClose();
      toast({ title: "Purchase updated", description: "Landed cost recalculated. Finished batches already made keep their cost." });
    },
    onError: (e: any) => toast({ title: "Could not update purchase", description: e.message, variant: "destructive" }),
  });

  const valid = num(price) != null && num(price)! >= 0 && (num(qty) ?? 0) > 0;
  const field = (label: string, value: string, set: (v: string) => void, testid: string) => (
    <label className="text-[10px] text-muted-foreground">
      {label}
      <Input className="mt-1 text-sm text-foreground" value={value} onChange={e => set(e.target.value)} data-testid={testid} />
    </label>
  );

  return (
    <Dialog open={!!source} onOpenChange={(v) => { if (!v) { setLoadedId(null); onClose(); } }}>
      <DialogContent className="bg-card border-border">
        <DialogHeader><DialogTitle>Edit purchase</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {field(`Unit price net (${currency})`, price, setPrice, "input-edit-price")}
            {field("Quantity purchased", qty, setQty, "input-edit-qty")}
            {field("VAT %", vat, setVat, "input-edit-vat")}
            {field(`Freight per unit (${currency})`, freight, setFreight, "input-edit-freight")}
            {field(`Setup charge, whole purchase (${currency})`, setup, setSetup, "input-edit-setup")}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Landed cost is recalculated. Changing the quantity moves the stock by the same amount. Batches of finished products
            that were already created keep the cost they had.
          </p>
          <Button className="w-full" disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}
            data-testid="button-save-edit-purchase">
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FxDialog({ doc, onClose }: any) {
  const { toast } = useToast();
  const [fx, setFx] = useState("");
  const [loadedId, setLoadedId] = useState<string | null>(null);
  if (doc && loadedId !== doc.id) {
    setLoadedId(doc.id);
    setFx(doc.fxRateToEur != null && Number(doc.fxRateToEur) > 0 ? String(Math.round(10000 / Number(doc.fxRateToEur)) / 10000) : "");
  }
  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("set_invoice_fx", { p_doc_id: doc.id, p_per_eur: num(fx) });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      for (const key of ["/api/purchase-documents", "/api/component-sources", "/api/component-cost-current"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      setLoadedId(null); setFx(""); onClose();
      toast({ title: "FX rate saved", description: "EUR cost of the invoice lines has been recalculated." });
    },
    onError: (e: any) => toast({ title: "Could not save FX rate", description: e.message, variant: "destructive" }),
  });
  return (
    <Dialog open={!!doc} onOpenChange={(v) => { if (!v) { setLoadedId(null); setFx(""); onClose(); } }}>
      <DialogContent className="bg-card border-border">
        <DialogHeader><DialogTitle>FX rate — invoice {doc?.documentNo}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <label className="text-[10px] text-muted-foreground block">1 EUR = ? {doc?.currency}
            <Input className="mt-1 text-sm text-foreground" placeholder="e.g. 24.3" value={fx}
              onChange={e => setFx(e.target.value)} data-testid="input-fx-rate" />
          </label>
          <p className="text-[10px] text-muted-foreground">
            Applies to all lines of this invoice and can be corrected any time. Finished batches already made keep the cost they had.
          </p>
          <Button className="w-full" disabled={!((num(fx) ?? 0) > 0) || mutation.isPending}
            onClick={() => mutation.mutate()} data-testid="button-save-fx-rate">
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
