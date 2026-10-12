import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useMemo, useState } from "react";
import { Plus, Search, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { postJson, fmtNum } from "@/lib/api";
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

export default function ComponentsPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showPurchase, setShowPurchase] = useState(false);
  const [showMovement, setShowMovement] = useState(false);
  const [showTooling, setShowTooling] = useState(false);
  const [editSource, setEditSource] = useState<any>(null);

  const { data: components = [] } = useQuery<any[]>({ queryKey: ["/api/components"] });
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
  const grouped = Object.keys(COMPONENT_CATEGORIES)
    .map(cat => ({ cat, items: filtered.filter((c: any) => c.category === cat) }))
    .filter(g => g.items.length > 0);

  const selected = components.find((c: any) => c.id === selectedId);
  const selCost = selected ? costById.get(selected.id) : null;
  const selTooling = selected ? tooling.filter((t: any) => t.componentId === selected.id) : [];
  const selSources = selected ? sources.filter((s: any) => s.componentId === selected.id) : [];

  return (
    <div className="panel-layout h-full">
      <div className="border-r border-border flex flex-col h-full overflow-hidden">
        <div className="p-3 border-b border-border flex items-center gap-2">
          <h2 className="text-sm font-semibold flex-1">Components</h2>
          <Button size="sm" variant="ghost" onClick={() => setShowCreate(true)} data-testid="button-add-component">
            <Plus size={14} />
          </Button>
        </div>
        <div className="p-2 border-b border-border relative">
          <Search size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-7 h-8 text-xs" placeholder="Search components" value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex-1 overflow-y-auto">
          {grouped.map(g => (
            <div key={g.cat}>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground bg-secondary/30">
                {COMPONENT_CATEGORIES[g.cat]}
              </div>
              {g.items.map((c: any) => {
                const cost = costById.get(c.id);
                return (
                  <div key={c.id}
                    className={`px-3 py-2 cursor-pointer hover:bg-secondary/50 border-b border-border/30
                      ${selectedId === c.id ? "bg-[hsl(183,70%,36%)]/10" : ""}`}
                    onClick={() => setSelectedId(c.id)}
                    data-testid={`component-item-${c.id}`}>
                    <p className="text-sm font-medium">{c.name}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
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

      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <div className="p-6 max-w-5xl">
            <div className="flex items-start justify-between mb-4 gap-4">
              <div>
                <h1 className="text-xl font-semibold">{selected.name}</h1>
                <div className="flex gap-2 mt-1">
                  <Badge variant="secondary">{COMPONENT_CATEGORIES[selected.category] ?? selected.category}</Badge>
                  {selected.volumeMl && <Badge variant="outline">{fmtNum(selected.volumeMl)} ml</Badge>}
                  {selected.neckSize && <Badge variant="outline">{selected.neckSize}</Badge>}
                </div>
                {selected.notes && <p className="text-xs text-muted-foreground mt-2 max-w-xl">{selected.notes}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
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

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <StatCard label="In stock" value={`${fmtNum(selected.stockQty, 2)} ${selected.unit}`} />
              <StatCard label="Last landed cost" hint="next production run"
                value={selCost?.lastLandedCostEur != null ? `€ ${fmtNum(selCost.lastLandedCostEur, 4)}` : "—"} />
              <StatCard label="Weighted avg. of stock" hint="margin on goods in stock"
                value={selCost?.wavgLandedCostEur != null ? `€ ${fmtNum(selCost.wavgLandedCostEur, 4)}` : "—"} />
              <StatCard label="Stock value"
                value={selCost?.stockValueEur != null ? `€ ${fmtNum(selCost.stockValueEur, 2)}` : "—"} />
            </div>

            <h3 className="text-sm font-semibold mb-2">Purchases ({selSources.length})</h3>
            <div className="bg-card border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="p-2">Date</th>
                    <th className="p-2">Invoice</th>
                    <th className="p-2 text-right">Qty</th>
                    <th className="p-2 text-right">Unit net</th>
                    <th className="p-2 text-right">VAT %</th>
                    <th className="p-2 text-right">Unit gross</th>
                    <th className="p-2 text-right">Freight/unit</th>
                    <th className="p-2 text-right">Landed</th>
                    <th className="p-2 text-right">Landed €</th>
                    <th className="p-2 text-right">Left</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {selSources.map((s: any) => {
                    const doc: any = docById.get(s.purchaseDocumentId);
                    const sup: any = doc ? supplierById.get(doc.supplierId) : null;
                    const cur = doc?.currency ?? "EUR";
                    return (
                      <tr key={s.id} className="border-b border-border/30">
                        <td className="p-2 whitespace-nowrap">{s.purchaseDate}</td>
                        <td className="p-2">
                          {doc ? `${doc.documentNo}${sup ? ` · ${sup.name}` : ""}` : "—"}
                          {s.costType !== "material" && <Badge variant="outline" className="ml-2 text-[9px]">{s.costType}</Badge>}
                          {doc && !doc.vatRecoverable && Number(s.vatRate) > 0 &&
                            <Badge variant="outline" className="ml-2 text-[9px]">VAT = cost</Badge>}
                        </td>
                        <td className="p-2 text-right font-mono">{fmtNum(s.purchaseQuantity, 2)}</td>
                        <td className="p-2 text-right font-mono">{fmtNum(s.unitPriceNet, 4)} {cur}</td>
                        <td className="p-2 text-right font-mono">{fmtNum(s.vatRate, 2)}</td>
                        <td className="p-2 text-right font-mono">{fmtNum(s.unitPriceGross, 4)}</td>
                        <td className="p-2 text-right font-mono">{fmtNum(s.freightShare, 4)}</td>
                        <td className="p-2 text-right font-mono">{fmtNum(s.landedUnitCost, 4)} {cur}</td>
                        <td className="p-2 text-right font-mono">
                          {s.landedUnitCostEur != null
                            ? fmtNum(s.landedUnitCostEur, 4)
                            : <span className="text-yellow-500">FX missing</span>}
                        </td>
                        <td className="p-2 text-right font-mono">{fmtNum(s.stockQty, 2)}</td>
                        <td className="p-2 text-right">
                          <button className="text-muted-foreground hover:text-foreground" aria-label="Edit purchase"
                            onClick={() => setEditSource(s)} data-testid={`button-edit-purchase-${s.id}`}>
                            <Pencil size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {selSources.length === 0 && (
                    <tr><td colSpan={11} className="p-4 text-center text-muted-foreground">No purchases yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Landed cost = net price + allocated freight + per-unit setup (+ VAT when it is not recoverable).
              It is frozen when the purchase is saved and never recalculated.
            </p>
            {selTooling.length > 0 && (
              <>
                <h3 className="text-sm font-semibold mt-6 mb-2">One-off tooling (amortised per finished unit, not in landed cost)</h3>
                <div className="bg-card border border-border rounded-lg overflow-x-auto">
                  <table className="w-full text-xs"><tbody>
                    {selTooling.map((t: any) => (
                      <tr key={t.id} className="border-b border-border/30">
                        <td className="p-2">{t.description}</td>
                        <td className="p-2 text-right font-mono">{fmtNum(t.cost)} {t.currency}</td>
                        <td className="p-2 text-right text-muted-foreground">over {t.amortiseOverUnits} units</td>
                        <td className="p-2 text-right font-mono">
                          € {fmtNum((Number(t.cost) * Number(t.fxRateToEur)) / Number(t.amortiseOverUnits), 4)} / unit
                        </td>
                      </tr>
                    ))}
                  </tbody></table>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Select a component
          </div>
        )}
      </div>

      <CreateComponentDialog open={showCreate} onOpenChange={setShowCreate} onCreated={setSelectedId} />
      {selected && (
        <>
          <AddPurchaseDialog open={showPurchase} onOpenChange={setShowPurchase} component={selected}
            documents={documents} suppliers={suppliers} />
          <EditPurchaseDialog source={editSource} onClose={() => setEditSource(null)}
            currency={(docById.get(editSource?.purchaseDocumentId) as any)?.currency ?? "EUR"} />
          <AddToolingDialog open={showTooling} onOpenChange={setShowTooling} component={selected} />
          <MovementDialog open={showMovement} onOpenChange={setShowMovement} component={selected}
            sources={selSources} docById={docById} />
        </>
      )}
    </div>
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
            fxRateToEur: currency === "EUR" ? 1 : num(fx),
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
                  <Input placeholder={`FX: 1 ${currency} = ? EUR (can be added later)`} value={fx}
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
      fxRateToEur: currency === "EUR" ? 1 : num(fx),
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
