import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Fragment, useMemo, useState } from "react";
import { ChevronRight, ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { COMPONENT_CATEGORIES } from "./components";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { postJson, patchJson, deleteJson, fmtNum } from "@/lib/api";

const PRODUCT_TYPES = ["candle", "reed", "nebulizer refill", "ultrasonic oil", "perfume", "sample", "other"];
const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

// grams / millilitres are easier to type than kg / l, so those components are entered in the small unit
// litres with a known density (components.specs.density, g/ml) are entered in grams as well
const entryUnit = (unit: string, comp?: any) => {
  if (unit === "kg") return { label: "g", factor: 1000 };
  if (unit === "l") {
    const d = Number(String(comp?.specs?.density ?? "").replace(",", "."));
    return d > 0 ? { label: "g", factor: 1000 * d } : { label: "ml", factor: 1000 };
  }
  return { label: unit, factor: 1 };
};

const invalidate = () => {
  for (const key of [
    "/api/products", "/api/product-components", "/api/product-batches", "/api/components",
    "/api/component-sources", "/api/component-movements", "/api/component-cost-current",
    "/api/formula-inventory-movements", "/api/materials", "/api/stock-movements",
  ]) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
};

type Row = { componentId: string; perUnit: string };
const r4 = (n: number) => Math.round(n * 10000) / 10000;

/**
 * "Create product": assembles finished products from the components and the fragrance of ONE
 * Formula Inventory entry. The fragrance grams are deducted from that entry (not from the raw materials),
 * the components are consumed FIFO from the purchases, and the real cost per unit is frozen on the batch.
 */
export function CreateProductDialog({
  agg, onOpenChange,
}: {
  agg: { formulaId: string; formulaName: string; availableGrams: number; avgCostPerGram: number } | null;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const { data: products = [] } = useQuery<any[]>({ queryKey: ["/api/products"] });
  const { data: bom = [] } = useQuery<any[]>({ queryKey: ["/api/product-components"] });
  const { data: components = [] } = useQuery<any[]>({ queryKey: ["/api/components"] });
  const { data: lineList = [] } = useQuery<any[]>({ queryKey: ["/api/component-lines"] });
  const { data: batches = [] } = useQuery<any[]>({ queryKey: ["/api/product-batches"] });

  const [productId, setProductId] = useState("new");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("candle");
  const [label, setLabel] = useState("");
  const [units, setUnits] = useState("");
  const [fragrance, setFragrance] = useState(""); // grams for ONE unit
  const [rows, setRows] = useState<Row[]>([]);
  const [mats, setMats] = useState<Row[]>([]); // raw materials from the Materials stock (e.g. EtOH), grams per 1 pc
  const { data: materials = [] } = useQuery<any[]>({ queryKey: ["/api/materials"] });
  const [saveTemplate, setSaveTemplate] = useState(true);

  const matById = useMemo(() => new Map(materials.map((m: any) => [m.id, m])), [materials]);
  const compById = useMemo(() => new Map(components.map((c: any) => [c.id, c])), [components]);
  const unitsNum = num(units) ?? 0;
  const product = products.find((p: any) => p.id === productId);
  // the product type decides which components are offered first (candle -> Candle line, reed -> Reed ...)
  const productType = (productId === "new" ? newType : product?.productType) ?? "";
  const preferredLine = lineList.find((l: any) => l.name.toLowerCase() === String(productType).toLowerCase())?.name ?? null;

  // amount for the whole batch = amount for one unit x units made (entry units)
  const totalOf = (r: { perUnit: string }) => r4((num(r.perUnit) ?? 0) * unitsNum);

  const reset = () => {
    setProductId("new"); setNewName(""); setLabel(""); setUnits(""); setFragrance(""); setRows([]); setMats([]);
  };

  const pickProduct = (id: string) => {
    setProductId(id);
    if (id === "new") { setRows([]); setMats([]); setFragrance(""); return; }
    // fragrance per unit from the latest batch of this product
    const lb = batches.find((b: any) => b.productId === id && Number(b.units) > 0 && Number(b.fragranceGrams) > 0);
    try {
      const saved = JSON.parse(localStorage.getItem(`product-mats-${id}`) ?? "[]");
      setMats(Array.isArray(saved) ? saved.filter((m: any) => m?.componentId) : []);
    } catch { setMats([]); }
    setFragrance(lb ? String(r4(Number(lb.fragranceGrams) / Number(lb.units))) : "");
    // prefill from the saved bill of materials (quantities per unit, shown in g / ml where useful)
    setRows(bom.filter((b: any) => b.productId === id).map((b: any) => {
      const eu = entryUnit((compById.get(b.componentId) as any)?.unit ?? "pcs", compById.get(b.componentId));
      return { componentId: b.componentId, perUnit: String(r4(Number(b.quantityPerUnit) * eu.factor)) };
    }));
  };

  const fragPerUnit = num(fragrance) ?? 0;
  const fragGrams = r4(fragPerUnit * unitsNum);
  const avail = agg?.availableGrams ?? 0;
  const avgCost = agg?.avgCostPerGram ?? 0;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!agg) throw new Error("No fragrance selected");
      let pid = productId;
      if (pid === "new") {
        const p = await postJson<any>("/api/products", {
          name: newName.trim(), productType: newType, formulaId: agg.formulaId,
        });
        pid = p.id;
      } else if (product && product.formulaId !== agg.formulaId) {
        await patchJson(`/api/products/${pid}`, { formulaId: agg.formulaId });
      }
      const lines = rows
        .map(r => {
          const eu = entryUnit((compById.get(r.componentId) as any)?.unit ?? "pcs", compById.get(r.componentId));
          return { component_id: r.componentId, qty: totalOf(r) / eu.factor, factor: eu.factor };
        })
        .filter(l => l.qty > 0);
      const { data, error } = await supabase.rpc("create_product_batch_v2", {
        p_product_id: pid,
        p_label: label.trim(),
        p_units: unitsNum,
        p_fragrance_grams: fragGrams,
        p_deduct_fragrance: true,
        p_lines: lines.map(l => ({ component_id: l.component_id, qty: l.qty })),
        p_materials: mats
          .map(m => ({ material_id: m.componentId, grams: totalOf(m) }))
          .filter(m => m.grams > 0),
      });
      if (error) throw new Error(error.message);

      let templateError: string | null = null;
      if (saveTemplate) {
        try {
          localStorage.setItem(`product-mats-${pid}`, JSON.stringify(mats));
          for (const b of bom.filter((b: any) => b.productId === pid)) {
            await deleteJson(`/api/product-components/${b.id}`);
          }
          for (const l of lines) {
            await postJson("/api/product-components", {
              productId: pid, componentId: l.component_id, quantityPerUnit: l.qty / unitsNum,
            });
          }
        } catch (e: any) {
          templateError = e.message;
        }
      }
      return { batch: data as any, templateError };
    },
    onSuccess: ({ batch, templateError }) => {
      invalidate();
      onOpenChange(false);
      reset();
      toast({
        title: "Product created",
        description: `Real cost per unit: € ${fmtNum(batch.unit_cost_eur, 4)}` +
          (templateError ? ` (component list was not saved: ${templateError})` : ""),
      });
    },
    onError: (e: any) => {
      invalidate();
      toast({ title: "Product not created", description: e.message, variant: "destructive" });
    },
  });

  const valid =
    !!agg && label.trim() && unitsNum > 0 && fragGrams >= 0 && fragGrams <= avail + 1e-9 &&
    (productId !== "new" || newName.trim()) && (rows.length > 0 || mats.length > 0) &&
    rows.every(r => (num(r.perUnit) ?? 0) > 0) && mats.every(m => (num(m.perUnit) ?? 0) > 0);

  const usedIds = new Set(rows.map(r => r.componentId));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={!!agg} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="bg-card border-border max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create product — {agg?.formulaName}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Select value={productId} onValueChange={pickProduct}>
            <SelectTrigger data-testid="select-product"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="new">+ New product</SelectItem>
              {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {productId === "new" && (
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Product name, e.g. Rose Noir candle" value={newName}
                onChange={e => setNewName(e.target.value)} data-testid="input-product-name" />
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRODUCT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <Input placeholder={`Label, e.g. ${today}-RoseNoir-01`} value={label}
            onChange={e => setLabel(e.target.value)} data-testid="input-product-label" />

          <div className="border border-border rounded-md p-3 space-y-2">
            <p className="text-[10px] text-muted-foreground">
              Enter the amounts for ONE piece. The app multiplies them by the number of units below
              and takes the components from the oldest purchases first, so the cost is exact.
            </p>
            <p className="text-[10px] text-muted-foreground">Type into the framed box: amount for 1 piece (wax in g, vessel/wick in pcs).</p>
            {rows.map((r, i) => {
              const eu = entryUnit((compById.get(r.componentId) as any)?.unit ?? "pcs", compById.get(r.componentId));
              return (
                <div key={r.componentId} className="flex items-center gap-2">
                  <span className="text-xs flex-1">{(compById.get(r.componentId) as any)?.name ?? "?"}</span>
                  <Input className="h-8 w-24 text-xs text-right border-primary/60 bg-background" inputMode="decimal" value={r.perUnit} placeholder="0"
                    onChange={e => setRows(rows.map((x, j) => (j === i ? { ...x, perUnit: e.target.value } : x)))} />
                  <span className="text-xs text-muted-foreground w-8">{eu.label}</span>
                  <span className="text-[10px] text-muted-foreground w-24 text-right">
                    {unitsNum > 0 && (num(r.perUnit) ?? 0) > 0 ? `= ${fmtNum(totalOf(r), 4)} ${eu.label}` : ""}
                  </span>
                  <button className="text-muted-foreground hover:text-destructive" aria-label="Remove"
                    onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
            <ComponentPicker components={components.filter((c: any) => !usedIds.has(c.id))} lines={lineList}
              preferredLine={preferredLine}
              onPick={(id: string) => {
                // counted items (vessel, wick, label...) default to 1 per piece; weighed ones (wax, fragrance) are typed
                const eu = entryUnit((compById.get(id) as any)?.unit ?? "pcs", compById.get(id));
                setRows([...rows, { componentId: id, perUnit: eu.factor === 1 && !["g", "ml"].includes(eu.label) ? "1" : "" }]);
              }} />
          </div>

          <div className="border border-border rounded-md p-3 space-y-2">
            <p className="text-[10px] text-muted-foreground">
              Raw materials from the Materials stock (e.g. EtOH), grams per 1 pc. Taken from the oldest source first.
            </p>
            {mats.map((m, i) => (
              <div key={m.componentId} className="flex items-center gap-2">
                <span className="text-xs flex-1">{(matById.get(m.componentId) as any)?.name ?? "?"}</span>
                <Input className="h-8 w-24 text-xs text-right border-primary/60 bg-background" inputMode="decimal" placeholder="0"
                  value={m.perUnit}
                  onChange={e => setMats(mats.map((x, j) => (j === i ? { ...x, perUnit: e.target.value } : x)))} />
                <span className="text-xs text-muted-foreground w-8">g</span>
                <span className="text-[10px] text-muted-foreground w-24 text-right">
                  {unitsNum > 0 && (num(m.perUnit) ?? 0) > 0 ? `= ${fmtNum(totalOf(m), 4)} g` : ""}
                </span>
                <button className="text-muted-foreground hover:text-destructive" aria-label="Remove"
                  onClick={() => setMats(mats.filter((_, j) => j !== i))}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <MaterialPicker materials={materials.filter((m: any) => !mats.some(x => x.componentId === m.id))}
              onPick={(id: string) => setMats([...mats, { componentId: id, perUnit: "" }])} />
          </div>

          <div className="border border-border rounded-md p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs flex-1">Fragrance per 1 pc (from this entry)</span>
              <Input className="h-8 w-24 text-xs text-right border-primary/60 bg-background" inputMode="decimal" placeholder="0" value={fragrance}
                onChange={e => setFragrance(e.target.value)} data-testid="input-product-fragrance" />
              <span className="text-xs text-muted-foreground w-8">g</span>
              <span className="text-[10px] text-muted-foreground w-24 text-right">
                {unitsNum > 0 && fragPerUnit > 0 ? `= ${fmtNum(fragGrams, 4)} g` : ""}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Available: {fmtNum(avail, 4)} g at € {fmtNum(avgCost, 4)}/g
              {fragPerUnit > 0 && avgCost > 0 ? ` → € ${fmtNum(fragPerUnit * avgCost, 4)} fragrance per pc` : ""}
              . The total is deducted from this Formula Inventory entry.
            </p>
            {fragGrams > avail + 1e-9 && (
              <p className="text-[11px] text-red-400">More than is available in this entry.</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs flex-1 font-medium">Units made</span>
            <Input className="h-8 w-28 text-xs text-right" placeholder="e.g. 20" value={units}
              onChange={e => setUnits(e.target.value)} data-testid="input-product-units" />
            <span className="text-xs text-muted-foreground w-8">pcs</span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Switch checked={saveTemplate} onCheckedChange={setSaveTemplate} />
            <span>Remember this component list for the next "Create product"</span>
          </div>

          <Button className="w-full" disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}
            data-testid="button-save-product">
            Create product
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Finished goods: one row per product, expandable into the batches with their frozen real cost. */
export function FinishedProductsView() {
  const { data: products = [] } = useQuery<any[]>({ queryKey: ["/api/products"] });
  const { data: batches = [] } = useQuery<any[]>({ queryKey: ["/api/product-batches"] });
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const rows = products
    .map((p: any) => {
      const bs = batches.filter((b: any) => b.productId === p.id);
      const stock = bs.reduce((a: number, b: any) => a + Number(b.stockQty), 0);
      const value = bs.reduce((a: number, b: any) => a + Number(b.stockQty) * Number(b.unitCostEur), 0);
      return {
        p, bs, stock, value,
        avg: stock > 0 ? value / stock : null,
        last: bs.length > 0 ? Number(bs[0].unitCostEur) : null,
      };
    })
    .filter(r => r.bs.length > 0);

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="w-8 p-2 pl-3" />
            <th className="text-left p-2">Product</th>
            <th className="text-left p-2">Type</th>
            <th className="text-right p-2">Units in stock</th>
            <th className="text-right p-2">Real cost / unit (stock avg.)</th>
            <th className="text-right p-2">Last batch / unit</th>
            <th className="text-right p-2 pr-3">Stock value</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={7} className="p-6 text-center text-xs text-muted-foreground">
              No finished products yet. Use "Create product" on a fragrance in the "Fragrance" tab.
            </td></tr>
          )}
          {rows.map(({ p, bs, stock, value, avg, last }) => {
            const isOpen = !!open[p.id];
            return (
              <Fragment key={p.id}>
                <tr className="border-b border-border/30 hover:bg-secondary/30 cursor-pointer"
                  onClick={() => setOpen({ ...open, [p.id]: !isOpen })} data-testid={`row-product-${p.id}`}>
                  <td className="p-2 pl-3 text-muted-foreground">{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                  <td className="p-2 font-medium">{p.name}</td>
                  <td className="p-2 text-xs text-muted-foreground">{p.productType}</td>
                  <td className="p-2 text-right font-mono text-xs">{fmtNum(stock, 2)}</td>
                  <td className="p-2 text-right font-mono text-xs font-semibold">{avg != null ? `€ ${fmtNum(avg, 4)}` : "—"}</td>
                  <td className="p-2 text-right font-mono text-xs">{last != null ? `€ ${fmtNum(last, 4)}` : "—"}</td>
                  <td className="p-2 pr-3 text-right font-mono text-xs">€ {fmtNum(value, 2)}</td>
                </tr>
                {isOpen && (
                  <tr className="border-b border-border/30 bg-secondary/10">
                    <td colSpan={7} className="p-3">
                      <div className="bg-card rounded border border-border/60 overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-muted-foreground border-b border-border">
                              <th className="p-2">Batch</th>
                              <th className="p-2 text-right">Made</th>
                              <th className="p-2 text-right">In stock</th>
                              <th className="p-2 text-right">Components €</th>
                              <th className="p-2 text-right">Materials €</th>
                              <th className="p-2 text-right">Fragrance €</th>
                              <th className="p-2 text-right">Tooling €</th>
                              <th className="p-2 text-right">Total €</th>
                              <th className="p-2 text-right">Per unit €</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bs.map((b: any) => (
                              <tr key={b.id} className="border-b border-border/30">
                                <td className="p-2">{b.batchLabel}<div className="text-[10px] text-muted-foreground">{String(b.producedAt).slice(0, 10)}</div></td>
                                <td className="p-2 text-right font-mono">{fmtNum(b.producedQty, 2)}</td>
                                <td className="p-2 text-right font-mono">{fmtNum(b.stockQty, 2)}</td>
                                <td className="p-2 text-right font-mono">{fmtNum(b.componentsCostEur, 2)}</td>
                                <td className="p-2 text-right font-mono">{fmtNum(b.materialsCostEur ?? 0, 2)}</td>
                                <td className="p-2 text-right font-mono">{fmtNum(b.fragranceCostEur, 2)} <span className="text-muted-foreground">({fmtNum(b.fragranceGrams, 4)} g)</span></td>
                                <td className="p-2 text-right font-mono">{fmtNum(b.toolingCostEur, 2)}</td>
                                <td className="p-2 text-right font-mono">{fmtNum(b.totalCostEur, 2)}</td>
                                <td className="p-2 text-right font-mono font-semibold">{fmtNum(b.unitCostEur, 4)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Searchable component chooser: type to filter by name, type or line; the product's own line is listed first. */
function ComponentPicker({ components, lines, preferredLine, onPick }: {
  components: any[]; lines: any[]; preferredLine: string | null; onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const groups = useMemo(() => {
    const order = [
      ...(preferredLine ? lines.filter((l: any) => l.name === preferredLine) : []),
      ...lines.filter((l: any) => ["Glass", "Caps", "Boxes"].includes(l.name) && l.name !== preferredLine),
      ...lines.filter((l: any) => !["Glass", "Caps", "Boxes"].includes(l.name) && l.name !== preferredLine),
    ];
    const placed = new Set<string>();
    const out: { label: string; items: any[] }[] = [];
    for (const l of order) {
      const items = components.filter((c: any) => !placed.has(c.id) && (c.lines ?? []).includes(l.name));
      items.forEach((c: any) => placed.add(c.id));
      if (items.length > 0) out.push({ label: l.name === preferredLine ? `${l.name} (suggested)` : l.name, items });
    }
    const rest = components.filter((c: any) => !placed.has(c.id));
    if (rest.length > 0) out.push({ label: "Other", items: rest });
    return out;
  }, [components, lines, preferredLine]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start text-xs text-muted-foreground h-8"
          data-testid="button-add-component-line">
          <Plus size={12} className="mr-1" /> Add component (vessel, wick, wax, label...)
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] max-w-[90vw] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search by name, type or line (Candle, Glass, Caps...)" />
          <CommandList className="max-h-72">
            <CommandEmpty>No component found</CommandEmpty>
            {groups.map(g => (
              <CommandGroup key={g.label} heading={g.label}>
                {g.items.map((c: any) => (
                  <CommandItem key={c.id}
                    value={`${c.name} ${COMPONENT_CATEGORIES[c.category] ?? c.category} ${(c.lines ?? []).join(" ")}`}
                    onSelect={() => { onPick(c.id); setOpen(false); }}>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-2 whitespace-nowrap">
                      {COMPONENT_CATEGORIES[c.category] ?? c.category} · {fmtNum(c.stockQty, 0)} {c.unit}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Searchable chooser for raw materials (EtOH, solvents...). */
function MaterialPicker({ materials, onPick }: { materials: any[]; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start text-xs text-muted-foreground h-8"
          data-testid="button-add-material-line">
          <Plus size={12} className="mr-1" /> Add material (EtOH, solvent...)
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] max-w-[90vw] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search materials" />
          <CommandList className="max-h-72">
            <CommandEmpty>No material found</CommandEmpty>
            <CommandGroup>
              {materials.map((m: any) => (
                <CommandItem key={m.id} value={`${m.name} ${(m.altNames ?? []).join(" ")}`}
                  onSelect={() => { onPick(m.id); setOpen(false); }}>
                  <span className="flex-1">{m.name}</span>
                  <span className="text-[10px] text-muted-foreground">{fmtNum(Number(m.stockGrams ?? 0), 1)} g</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
