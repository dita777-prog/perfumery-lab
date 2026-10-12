import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { postJson, deleteJson, fmtNum } from "@/lib/api";

const PRODUCT_TYPES = ["perfume", "diffuser", "candle", "sample"];
const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

const invalidate = () => {
  for (const key of ["/api/products", "/api/product-components", "/api/tooling-costs", "/api/product-cost"]) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
};

export default function ProductsPage() {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showBom, setShowBom] = useState(false);
  const [showTooling, setShowTooling] = useState(false);

  const { data: products = [] } = useQuery<any[]>({ queryKey: ["/api/products"] });
  const { data: bom = [] } = useQuery<any[]>({ queryKey: ["/api/product-components"] });
  const { data: components = [] } = useQuery<any[]>({ queryKey: ["/api/components"] });
  const { data: costs = [] } = useQuery<any[]>({ queryKey: ["/api/component-cost-current"] });
  const { data: tooling = [] } = useQuery<any[]>({ queryKey: ["/api/tooling-costs"] });
  const { data: formulas = [] } = useQuery<any[]>({ queryKey: ["/api/formulas"] });

  const costById = useMemo(() => new Map(costs.map((c: any) => [c.componentId, c])), [costs]);
  const compById = useMemo(() => new Map(components.map((c: any) => [c.id, c])), [components]);

  const selected = products.find((p: any) => p.id === selectedId);
  const lines = selected ? bom.filter((b: any) => b.productId === selected.id) : [];
  const lineComponentIds = new Set(lines.map((l: any) => l.componentId));
  const toolingRows = tooling.filter((t: any) => lineComponentIds.has(t.componentId));

  // Components cost uses the weighted average of stock on hand (margin on goods that exist);
  // when a component has no EUR cost yet (FX missing) the total is flagged as incomplete.
  const lineCosts = lines.map((l: any) => {
    const c: any = costById.get(l.componentId);
    const unit = c?.wavgLandedCostEur ?? c?.lastLandedCostEur ?? null;
    return { line: l, unit, total: unit != null ? Number(unit) * Number(l.quantityPerUnit) : null };
  });
  const componentsCost = lineCosts.reduce((a, x) => a + (x.total ?? 0), 0);
  const missingCount = lineCosts.filter(x => x.total == null).length;
  const toolingPerUnit = toolingRows.reduce(
    (a: number, t: any) => a + (Number(t.cost) * Number(t.fxRateToEur)) / Number(t.amortiseOverUnits), 0);
  const total = componentsCost + toolingPerUnit;
  const sales = selected?.salesPriceNet != null ? Number(selected.salesPriceNet) : null;
  const margin = sales ? ((sales - total) / sales) * 100 : null;

  const removeLine = useMutation({
    mutationFn: (id: string) => deleteJson(`/api/product-components/${id}`),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast({ title: "Could not remove", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="panel-layout h-full">
      <div className="border-r border-border flex flex-col h-full overflow-hidden">
        <div className="p-3 border-b border-border flex items-center gap-2">
          <h2 className="text-sm font-semibold flex-1">Products</h2>
          <Button size="sm" variant="ghost" onClick={() => setShowCreate(true)} data-testid="button-add-product">
            <Plus size={14} />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {products.map((p: any) => (
            <div key={p.id}
              className={`px-3 py-2 cursor-pointer hover:bg-secondary/50 border-b border-border/30
                ${selectedId === p.id ? "bg-[hsl(183,70%,36%)]/10" : ""}`}
              onClick={() => setSelectedId(p.id)} data-testid={`product-item-${p.id}`}>
              <p className="text-sm font-medium">{p.name}</p>
              <span className="text-[10px] text-muted-foreground">{p.productType}</span>
            </div>
          ))}
          {products.length === 0 && <p className="p-4 text-xs text-muted-foreground">No products yet.</p>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <div className="p-6 max-w-4xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-xl font-semibold">{selected.name}</h1>
                <Badge variant="secondary" className="mt-1">{selected.productType}</Badge>
              </div>
              <Button size="sm" onClick={() => setShowBom(true)} data-testid="button-add-bom-line">
                <Plus size={14} className="mr-1" /> Add component
              </Button>
            </div>

            <h3 className="text-sm font-semibold mb-2">Bill of materials</h3>
            <div className="bg-card border border-border rounded-lg overflow-x-auto mb-6">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="p-2">Component</th>
                    <th className="p-2 text-right">Qty / unit</th>
                    <th className="p-2 text-right">Unit cost €</th>
                    <th className="p-2 text-right">Line cost €</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {lineCosts.map(({ line, unit, total: lt }) => (
                    <tr key={line.id} className="border-b border-border/30">
                      <td className="p-2">{(compById.get(line.componentId) as any)?.name ?? "?"}</td>
                      <td className="p-2 text-right font-mono">{fmtNum(line.quantityPerUnit, 4)}</td>
                      <td className="p-2 text-right font-mono">
                        {unit != null ? fmtNum(unit, 4) : <span className="text-yellow-500">no EUR cost</span>}
                      </td>
                      <td className="p-2 text-right font-mono">{lt != null ? fmtNum(lt, 4) : "—"}</td>
                      <td className="p-2 text-right">
                        <button className="text-muted-foreground hover:text-destructive"
                          onClick={() => removeLine.mutate(line.id)} aria-label="Remove">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {lineCosts.length === 0 && (
                    <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Add the glass, closure, box ... this product is made of.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">One-off tooling (amortised, not in landed cost)</h3>
              <Button size="sm" variant="outline" onClick={() => setShowTooling(true)}
                disabled={lines.length === 0} data-testid="button-add-tooling">
                <Plus size={12} className="mr-1" /> Add tooling
              </Button>
            </div>
            <div className="bg-card border border-border rounded-lg overflow-x-auto mb-6">
              <table className="w-full text-xs">
                <tbody>
                  {toolingRows.map((t: any) => (
                    <tr key={t.id} className="border-b border-border/30">
                      <td className="p-2">{t.description} · {(compById.get(t.componentId) as any)?.name}</td>
                      <td className="p-2 text-right font-mono">{fmtNum(t.cost)} {t.currency}</td>
                      <td className="p-2 text-right text-muted-foreground">over {t.amortiseOverUnits} units</td>
                      <td className="p-2 text-right font-mono">
                        € {fmtNum((Number(t.cost) * Number(t.fxRateToEur)) / Number(t.amortiseOverUnits), 4)} / unit
                      </td>
                    </tr>
                  ))}
                  {toolingRows.length === 0 && (
                    <tr><td className="p-3 text-center text-muted-foreground">No tooling for this product.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Components" value={`€ ${fmtNum(componentsCost, 4)}`} />
              <Stat label="Tooling / unit" value={`€ ${fmtNum(toolingPerUnit, 4)}`} />
              <Stat label="Cost per unit (excl. fragrance)" value={`€ ${fmtNum(total, 4)}`} strong />
              <Stat label="Margin (excl. fragrance)"
                value={margin != null ? `${fmtNum(margin, 1)} %` : "set a sales price"}
                hint={sales != null ? `sales net € ${fmtNum(sales)}` : undefined} />
            </div>
            {missingCount > 0 && (
              <p className="text-[11px] text-yellow-500 mt-3">
                {missingCount} component(s) have no EUR cost yet (missing FX rate on the invoice) — the total is incomplete.
              </p>
            )}
            <p className="text-[10px] text-muted-foreground mt-3">
              Fragrance cost is not included yet: formula ingredients have no unit cost in the database.
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Select a product</div>
        )}
      </div>

      <CreateProductDialog open={showCreate} onOpenChange={setShowCreate} formulas={formulas} onCreated={setSelectedId} />
      {selected && (
        <>
          <AddBomDialog open={showBom} onOpenChange={setShowBom} product={selected} components={components}
            existing={lineComponentIds} />
          <AddToolingDialog open={showTooling} onOpenChange={setShowTooling}
            components={components.filter((c: any) => lineComponentIds.has(c.id))} />
        </>
      )}
    </div>
  );
}

function Stat({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className={`rounded-lg p-3 border ${strong ? "border-[hsl(183,70%,36%)] bg-[hsl(183,70%,36%)]/10" : "border-border bg-card"}`}>
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <p className="text-sm mt-0.5 font-mono">{value}</p>
      {hint && <span className="text-[9px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

function CreateProductDialog({ open, onOpenChange, formulas, onCreated }: any) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [type, setType] = useState("perfume");
  const [price, setPrice] = useState("");
  const [formulaId, setFormulaId] = useState("none");
  const [grams, setGrams] = useState("");

  const mutation = useMutation({
    mutationFn: (data: any) => postJson<any>("/api/products", data),
    onSuccess: (p) => {
      invalidate();
      onOpenChange(false);
      onCreated?.(p.id);
      setName(""); setPrice(""); setGrams(""); setFormulaId("none");
      toast({ title: "Product created" });
    },
    onError: (e: any) => toast({ title: "Could not create product", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader><DialogTitle>New product</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Name, e.g. Reed diffuser 200 ml" value={name} onChange={e => setName(e.target.value)} data-testid="input-product-name" />
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PRODUCT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={formulaId} onValueChange={setFormulaId}>
            <SelectTrigger><SelectValue placeholder="Formula (optional)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No formula linked</SelectItem>
              {formulas.filter((f: any) => !f.archivedAt).map((f: any) => (
                <SelectItem key={f.id} value={f.id}>{f.commercialName || f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Fragrance g per unit" value={grams} onChange={e => setGrams(e.target.value)} />
            <Input placeholder="Sales price net €" value={price} onChange={e => setPrice(e.target.value)} />
          </div>
          <Button className="w-full" disabled={!name.trim() || mutation.isPending}
            onClick={() => mutation.mutate({
              name: name.trim(), productType: type,
              formulaId: formulaId === "none" ? null : formulaId,
              fragranceGrams: num(grams), salesPriceNet: num(price),
            })} data-testid="button-create-product">
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddBomDialog({ open, onOpenChange, product, components, existing }: any) {
  const { toast } = useToast();
  const [componentId, setComponentId] = useState("");
  const [qty, setQty] = useState("1");

  const mutation = useMutation({
    mutationFn: () => postJson("/api/product-components", {
      productId: product.id, componentId, quantityPerUnit: num(qty),
    }),
    onSuccess: () => { invalidate(); onOpenChange(false); setComponentId(""); setQty("1"); },
    onError: (e: any) => toast({ title: "Could not add component", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader><DialogTitle>Add component to {product.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Select value={componentId} onValueChange={setComponentId}>
            <SelectTrigger><SelectValue placeholder="Component" /></SelectTrigger>
            <SelectContent>
              {components.filter((c: any) => !existing.has(c.id)).map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Quantity per unit (e.g. 1, 8 sticks, 0.18 kg)" value={qty} onChange={e => setQty(e.target.value)} />
          <Button className="w-full" disabled={!componentId || !(num(qty)! > 0) || mutation.isPending}
            onClick={() => mutation.mutate()} data-testid="button-save-bom-line">
            Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddToolingDialog({ open, onOpenChange, components }: any) {
  const { toast } = useToast();
  const [componentId, setComponentId] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [currency, setCurrency] = useState("CZK");
  const [fx, setFx] = useState("");
  const [units, setUnits] = useState("");

  const mutation = useMutation({
    mutationFn: () => postJson("/api/tooling-costs", {
      componentId, description: description.trim(), cost: num(cost), currency,
      fxRateToEur: currency === "EUR" ? 1 : num(fx),
      amortiseOverUnits: Math.round(num(units) ?? 0),
    }),
    onSuccess: () => { invalidate(); onOpenChange(false); setDescription(""); setCost(""); setUnits(""); setFx(""); },
    onError: (e: any) => toast({ title: "Could not save tooling", description: e.message, variant: "destructive" }),
  });

  const valid = !!componentId && description.trim() && num(cost) != null && (num(units) ?? 0) > 0 &&
    (currency === "EUR" || (num(fx) ?? 0) > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader><DialogTitle>Add one-off tooling</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Select value={componentId} onValueChange={setComponentId}>
            <SelectTrigger><SelectValue placeholder="Component the tool belongs to" /></SelectTrigger>
            <SelectContent>{components.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Input placeholder="Description, e.g. cutting die" value={description} onChange={e => setDescription(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Cost" value={cost} onChange={e => setCost(e.target.value)} />
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["CZK", "EUR", "USD"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            {currency !== "EUR" && (
              <Input className="col-span-2" placeholder={`FX: 1 ${currency} = ? EUR`} value={fx} onChange={e => setFx(e.target.value)} />
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
