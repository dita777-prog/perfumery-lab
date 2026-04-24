import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Fragment, useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { postJson, fmtGrams, fmtNum } from "@/lib/api";

type Movement = {
  id: string;
  formulaId: string;
  movementType: "production_in" | "consumption_out" | "adjustment" | "waste";
  gramsDelta: string | number | null;
  costPerGram: string | number | null;
  totalCost: string | number | null;
  productionBatchId: string | null;
  relatedFormulaId: string | null;
  notes: string | null;
  createdAt: string | null;
};

type FormulaAgg = {
  formulaId: string;
  formulaName: string;
  categoryId: string | null;
  categoryName: string;
  formulaRole: string;
  availableGrams: number;
  producedGrams: number;
  consumedGrams: number;
  avgCostPerGram: number;
  inventoryValue: number;
  lastMovementAt: string | null;
  movements: Movement[];
};

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function movementBadge(type: Movement["movementType"]) {
  const config: Record<Movement["movementType"], { label: string; className: string }> = {
    production_in: { label: "production", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40" },
    consumption_out: { label: "consumption", className: "bg-red-500/15 text-red-400 border-red-500/40" },
    adjustment: { label: "adjustment", className: "bg-blue-500/15 text-blue-400 border-blue-500/40" },
    waste: { label: "waste", className: "bg-amber-500/15 text-amber-400 border-amber-500/40" },
  };
  const c = config[type];
  return <Badge variant="outline" className={`text-[10px] ${c.className}`}>{c.label}</Badge>;
}

export default function FormulaInventoryPage() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [usageDialog, setUsageDialog] = useState<FormulaAgg | null>(null);
  const [adjustmentDialog, setAdjustmentDialog] = useState<FormulaAgg | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [roleTab, setRoleTab] = useState<string>("accords");

  const { data: movements = [] } = useQuery<any[]>({
    queryKey: ["/api/formula-inventory-movements"],
  });
  const { data: formulas = [] } = useQuery<any[]>({ queryKey: ["/api/formulas"] });
  const { data: categories = [] } = useQuery<any[]>({ queryKey: ["/api/formula-categories"] });
  const { data: productionBatches = [] } = useQuery<any[]>({ queryKey: ["/api/production-batches"] });

  const productsCategoryId = useMemo(() => {
    const c = categories.find((c: any) => /^products$/i.test(c?.name || ""));
    return c?.id ?? null;
  }, [categories]);

  const isProductCategory = (catId: string | null, catName: string | null): boolean => {
    if (productsCategoryId && catId === productsCategoryId) return true;
    if (catName && /^products$/i.test(catName)) return true;
    return false;
  };

  const aggregated = useMemo<FormulaAgg[]>(() => {
    const byFormula = new Map<string, any[]>();
    for (const m of movements) {
      const fid = m.formulaId ?? m.formula_id;
      if (!fid) continue;
      const arr = byFormula.get(fid) || [];
      const normalized = {
        id: m.id,
        formulaId: fid,
        movementType: m.movementType ?? m.movement_type,
        gramsDelta: m.gramsDelta ?? m.grams_delta,
        costPerGram: m.costPerGram ?? m.cost_per_gram ?? null,
        totalCost: m.totalCost ?? m.total_cost ?? null,
        productionBatchId: m.productionBatchId ?? m.production_batch_id ?? null,
        relatedFormulaId: m.relatedFormulaId ?? m.related_formula_id ?? null,
        notes: m.notes ?? null,
        createdAt: m.createdAt ?? m.created_at ?? null,
      } as Movement;
      arr.push(normalized);
      byFormula.set(fid, arr);
    }

    const out: FormulaAgg[] = [];
    byFormula.forEach((ms, fid) => {
      const formula = formulas.find((f: any) => f.id === fid);
      const categoryId = formula?.categoryId ?? formula?.category_id ?? null;
      const category = categories.find((c: any) => c.id === categoryId);
      const categoryName = category?.name || "—";
      const rawRole = formula?.formulaRole ?? formula?.formula_role ?? "accord";
      const effectiveRole = isProductCategory(categoryId, categoryName) ? "final" : rawRole;
      let availableGrams = 0;
      let producedGrams = 0;
      let consumedGrams = 0;
      let sumProdCost = 0;
      let sumProdGrams = 0;
      let last: string | null = null;
      for (const m of ms) {
        const d = num(m.gramsDelta);
        availableGrams += d;
        if (m.movementType === "production_in") {
          producedGrams += d;
          sumProdCost += num(m.totalCost);
          sumProdGrams += d;
        } else if (m.movementType === "consumption_out" || m.movementType === "waste") {
          consumedGrams += Math.abs(d);
        }
        if (m.createdAt && (!last || m.createdAt > last)) last = m.createdAt;
      }
      const avgCostPerGram = sumProdGrams > 0 ? sumProdCost / sumProdGrams : 0;
      const inventoryValue = availableGrams * avgCostPerGram;
      const sortedMs = [...ms].sort((a, b) => {
        const ta = a.createdAt || "";
        const tb = b.createdAt || "";
        return tb.localeCompare(ta);
      });
      out.push({
        formulaId: fid,
        formulaName: formula?.name || "Unknown formula",
        categoryId,
        categoryName,
        formulaRole: effectiveRole,
        availableGrams,
        producedGrams,
        consumedGrams,
        avgCostPerGram,
        inventoryValue,
        lastMovementAt: last,
        movements: sortedMs,
      });
    });
    out.sort((a, b) => a.formulaName.localeCompare(b.formulaName));
    return out;
  }, [movements, formulas, categories, productsCategoryId]);

  const filtered = useMemo(() => {
    let rows = aggregated;
    if (categoryFilter !== "all") {
      rows = rows.filter((a) => (a.categoryId || "__none__") === categoryFilter);
    }
    if (roleTab === "accords") {
      rows = rows.filter(
        (a) => a.formulaRole === "accord" && !isProductCategory(a.categoryId, a.categoryName),
      );
    } else if (roleTab === "final") {
      rows = rows.filter(
        (a) => a.formulaRole === "final" || isProductCategory(a.categoryId, a.categoryName),
      );
    }
    return rows;
  }, [aggregated, categoryFilter, roleTab, productsCategoryId]);

  const totalValue = useMemo(
    () => filtered.reduce((s, a) => s + (isFinite(a.inventoryValue) ? a.inventoryValue : 0), 0),
    [filtered],
  );

  const productFormulas = useMemo(() => {
    if (productsCategoryId) {
      return formulas.filter((f: any) => (f.categoryId ?? f.category_id) === productsCategoryId);
    }
    return formulas;
  }, [formulas, productsCategoryId]);

  const batchLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of productionBatches) {
      m.set(b.id, b.batchLabel || b.batch_label || "");
    }
    return m;
  }, [productionBatches]);

  const formulaNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of formulas) m.set(f.id, f.name);
    return m;
  }, [formulas]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold">Formula Inventory</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Event-sourced ledger of NEAT formula stock. Produced via batches, consumed by finished products.
          </p>
        </div>
        <div className="w-48">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 text-xs" data-testid="select-category-filter">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={roleTab} onValueChange={setRoleTab} className="mb-4">
        <TabsList>
          <TabsTrigger value="accords" data-testid="tab-accords">Accords</TabsTrigger>
          <TabsTrigger value="final" data-testid="tab-final">Final Formulas</TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="text-xs text-muted-foreground">Formula types tracked</div>
          <div className="text-2xl font-semibold mt-1" data-testid="summary-formula-count">
            {filtered.length}
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="text-xs text-muted-foreground">Total inventory value</div>
          <div className="text-2xl font-semibold mt-1 font-mono" data-testid="summary-total-value">
            € {fmtNum(totalValue)}
          </div>
        </div>
      </div>

      {/* Main table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="w-8 p-2 pl-3"></th>
              <th className="text-left p-2">Formula</th>
              <th className="text-left p-2">Category</th>
              <th className="text-right p-2">Available (g)</th>
              <th className="text-right p-2">Produced (g)</th>
              <th className="text-right p-2">Consumed (g)</th>
              <th className="text-right p-2">Avg cost/g</th>
              <th className="text-right p-2">Value</th>
              <th className="text-left p-2">Last movement</th>
              <th className="text-right p-2 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="p-6 text-center text-xs text-muted-foreground">
                  No formula inventory movements yet. Create a production batch to start tracking.
                </td>
              </tr>
            )}
            {filtered.map((agg) => {
              const isOpen = !!expanded[agg.formulaId];
              const lowStock = agg.availableGrams <= 0;
              return (
                <Fragment key={agg.formulaId}>
                  <tr
                    className="border-b border-border/30 hover:bg-secondary/30 cursor-pointer"
                    onClick={() =>
                      setExpanded((prev) => ({ ...prev, [agg.formulaId]: !prev[agg.formulaId] }))
                    }
                    data-testid={`row-formula-${agg.formulaId}`}
                  >
                    <td className="p-2 pl-3 text-muted-foreground">
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                    <td className="p-2 font-medium">{agg.formulaName}</td>
                    <td className="p-2 text-xs text-muted-foreground">{agg.categoryName}</td>
                    <td
                      className={`text-right p-2 font-mono text-xs ${
                        lowStock ? "text-red-400" : "text-emerald-400"
                      }`}
                    >
                      {fmtGrams(String(agg.availableGrams))}
                    </td>
                    <td className="text-right p-2 font-mono text-xs text-muted-foreground">
                      {fmtGrams(String(agg.producedGrams))}
                    </td>
                    <td className="text-right p-2 font-mono text-xs text-muted-foreground">
                      {fmtGrams(String(agg.consumedGrams))}
                    </td>
                    <td className="text-right p-2 font-mono text-xs">
                      € {fmtNum(agg.avgCostPerGram, 4)}
                    </td>
                    <td className="text-right p-2 font-mono text-xs">
                      € {fmtNum(agg.inventoryValue)}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {agg.lastMovementAt
                        ? format(new Date(agg.lastMovementAt), "MMM d, yyyy")
                        : "—"}
                    </td>
                    <td className="text-right p-2 pr-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px] px-2"
                          onClick={() => setUsageDialog(agg)}
                          data-testid={`button-record-usage-${agg.formulaId}`}
                        >
                          Record Usage
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px] px-2"
                          onClick={() => setAdjustmentDialog(agg)}
                          data-testid={`button-adjustment-${agg.formulaId}`}
                        >
                          Adjust
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-border/30 bg-secondary/10">
                      <td colSpan={10} className="p-3">
                        {agg.movements.length === 0 ? (
                          <div className="text-xs text-muted-foreground">No movements.</div>
                        ) : (
                          <div className="bg-card rounded border border-border/60 overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-border text-[10px] text-muted-foreground">
                                  <th className="text-left p-2 pl-3">Date</th>
                                  <th className="text-left p-2">Type</th>
                                  <th className="text-right p-2">Grams Δ</th>
                                  <th className="text-right p-2">Cost/g</th>
                                  <th className="text-right p-2">Total cost</th>
                                  <th className="text-left p-2">Batch</th>
                                  <th className="text-left p-2">Related formula</th>
                                  <th className="text-left p-2 pr-3">Notes</th>
                                </tr>
                              </thead>
                              <tbody>
                                {agg.movements.map((m) => {
                                  const d = num(m.gramsDelta);
                                  const isIn = d > 0;
                                  const batchLabel = m.productionBatchId
                                    ? batchLabelById.get(m.productionBatchId) || m.productionBatchId.slice(0, 8)
                                    : null;
                                  const related = m.relatedFormulaId
                                    ? formulaNameById.get(m.relatedFormulaId) || "—"
                                    : null;
                                  return (
                                    <tr key={m.id} className="border-b border-border/20">
                                      <td className="p-2 pl-3 text-muted-foreground">
                                        {m.createdAt
                                          ? format(new Date(m.createdAt), "MMM d, yyyy HH:mm")
                                          : "—"}
                                      </td>
                                      <td className="p-2">{movementBadge(m.movementType)}</td>
                                      <td
                                        className={`text-right p-2 font-mono ${
                                          isIn ? "text-emerald-400" : "text-red-400"
                                        }`}
                                      >
                                        {isIn ? "+" : ""}
                                        {fmtGrams(String(d))}
                                      </td>
                                      <td className="text-right p-2 font-mono">
                                        {m.costPerGram != null ? `€ ${fmtNum(m.costPerGram, 4)}` : "—"}
                                      </td>
                                      <td className="text-right p-2 font-mono">
                                        {m.totalCost != null ? `€ ${fmtNum(m.totalCost)}` : "—"}
                                      </td>
                                      <td className="p-2 font-mono text-muted-foreground">
                                        {batchLabel || "—"}
                                      </td>
                                      <td className="p-2 text-muted-foreground">
                                        {related || "—"}
                                      </td>
                                      <td className="p-2 pr-3 text-muted-foreground">
                                        {m.notes || "—"}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <RecordUsageDialog
        agg={usageDialog}
        onOpenChange={(v) => { if (!v) setUsageDialog(null); }}
        productFormulas={productFormulas}
      />
      <AdjustmentDialog
        agg={adjustmentDialog}
        onOpenChange={(v) => { if (!v) setAdjustmentDialog(null); }}
      />
    </div>
  );
}

function RecordUsageDialog({
  agg,
  onOpenChange,
  productFormulas,
}: {
  agg: FormulaAgg | null;
  onOpenChange: (v: boolean) => void;
  productFormulas: any[];
}) {
  const { toast } = useToast();
  const [targetFormulaId, setTargetFormulaId] = useState<string>("");
  const [grams, setGrams] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const open = !!agg;

  const handleReset = () => {
    setTargetFormulaId("");
    setGrams("");
    setNotes("");
    setIsSubmitting(false);
  };

  const handleConfirm = async () => {
    if (!agg) return;
    const gramsNum = parseFloat(grams.replace(",", "."));
    if (!grams || isNaN(gramsNum) || gramsNum <= 0) {
      toast({ title: "Enter grams used (positive number)", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const costPerGram = agg.avgCostPerGram || 0;
      const totalCost = -(gramsNum * costPerGram);
      await postJson("/api/formula-inventory-movements", {
        formulaId: agg.formulaId,
        movementType: "consumption_out",
        gramsDelta: String(-gramsNum),
        costPerGram: costPerGram > 0 ? String(costPerGram) : null,
        totalCost: costPerGram > 0 ? String(totalCost) : null,
        relatedFormulaId: targetFormulaId || null,
        notes: notes.trim() || null,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/formula-inventory-movements"] });
      toast({ title: `Recorded ${fmtGrams(String(gramsNum))}g consumption` });
      handleReset();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Failed to record usage",
        description: err?.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !isSubmitting) { handleReset(); onOpenChange(false); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Usage — {agg?.formulaName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Available: <span className="font-mono">{fmtGrams(String(agg?.availableGrams ?? 0))}</span>
            {agg && agg.avgCostPerGram > 0 && (
              <> · Avg cost/g: <span className="font-mono">€ {fmtNum(agg.avgCostPerGram, 4)}</span></>
            )}
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Target formula (finished product)</div>
            <Select value={targetFormulaId} onValueChange={setTargetFormulaId}>
              <SelectTrigger className="h-8 text-xs" data-testid="select-target-formula">
                <SelectValue placeholder="Pick a product formula (optional)" />
              </SelectTrigger>
              <SelectContent>
                {productFormulas
                  .filter((f: any) => f.id !== agg?.formulaId)
                  .map((f: any) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Grams used</div>
            <Input
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
              type="number"
              step="0.01"
              placeholder="e.g. 25"
              className="h-8 text-sm font-mono"
              data-testid="input-usage-grams"
            />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Notes (optional)</div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Notes about this usage"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => { handleReset(); onOpenChange(false); }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={isSubmitting} data-testid="button-confirm-usage">
              {isSubmitting ? "Recording…" : "Record Usage"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AdjustmentDialog({
  agg,
  onOpenChange,
}: {
  agg: FormulaAgg | null;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const [grams, setGrams] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const open = !!agg;

  const handleReset = () => {
    setGrams("");
    setNotes("");
    setIsSubmitting(false);
  };

  const handleConfirm = async () => {
    if (!agg) return;
    const gramsNum = parseFloat(grams.replace(",", "."));
    if (!grams || isNaN(gramsNum) || gramsNum === 0) {
      toast({ title: "Enter a non-zero adjustment", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await postJson("/api/formula-inventory-movements", {
        formulaId: agg.formulaId,
        movementType: "adjustment",
        gramsDelta: String(gramsNum),
        notes: notes.trim() || null,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/formula-inventory-movements"] });
      toast({ title: `Adjustment recorded (${gramsNum > 0 ? "+" : ""}${fmtGrams(String(gramsNum))}g)` });
      handleReset();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Failed to record adjustment",
        description: err?.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !isSubmitting) { handleReset(); onOpenChange(false); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjustment — {agg?.formulaName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Current: <span className="font-mono">{fmtGrams(String(agg?.availableGrams ?? 0))}</span>. Enter positive to add, negative to remove.
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Grams delta</div>
            <Input
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
              type="number"
              step="0.01"
              placeholder="e.g. -5 or 10"
              className="h-8 text-sm font-mono"
              data-testid="input-adjustment-grams"
            />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Notes (optional)</div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Reason for adjustment"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => { handleReset(); onOpenChange(false); }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={isSubmitting} data-testid="button-confirm-adjustment">
              {isSubmitting ? "Saving…" : "Save Adjustment"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
