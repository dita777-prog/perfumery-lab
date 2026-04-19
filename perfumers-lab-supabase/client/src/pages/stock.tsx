import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { Fragment, useMemo, useState } from "react";
import { Plus, AlertTriangle, ArrowDown, ArrowUp, FlaskConical, ChevronRight, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { postJson, fmtNum, fmtGrams } from "@/lib/api";

/** snake_case → camelCase for arbitrary objects (mirrors queryClient helper). */
function toCamel(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toCamel);
  if (typeof obj !== "object") return obj;
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = value !== null && typeof value === "object" ? toCamel(value) : value;
  }
  return result;
}

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function generateBatchLabel(formulaName: string, existingBatches: any[]): string {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);
  const slug = (formulaName || "Formula").replace(/\s+/g, "-").replace(/[^\w-]/g, "").replace(/-+/g, "-");
  const prefix = `${dateStr}-${slug}-`;
  const existing = existingBatches
    .map((b: any) => b.batchLabel || b.batch_label || "")
    .filter((label: string) => label.toLowerCase().startsWith(prefix.toLowerCase()));
  let maxSuffix = 0;
  for (const label of existing) {
    const n = parseInt(label.slice(prefix.length), 10);
    if (!isNaN(n) && n > maxSuffix) maxSuffix = n;
  }
  return `${prefix}${String(maxSuffix + 1).padStart(2, "0")}`;
}

type EnrichedMovement = {
  id: string;
  materialSourceId: string | null;
  movementType: string | null;
  gramsDelta: string | null;
  relatedFormulaId: string | null;
  date: string | null;
  notes: string | null;
  batchLabel: string | null;
  productionBatchId: string | null;
  createdAt: string | null;
  materialSources: any | null;
  productionBatches: any | null;
};

export default function StockPage() {
  const [showMovement, setShowMovement] = useState(false);
  const [showProduction, setShowProduction] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<{ label: string; productionBatchId: string | null } | null>(null);
  const [batchSearch, setBatchSearch] = useState("");
  const [expandedFormulas, setExpandedFormulas] = useState<Record<string, boolean>>({});
  const [expandedBatches, setExpandedBatches] = useState<Record<string, boolean>>({});

  const { data: sources = [] } = useQuery<any[]>({ queryKey: ["/api/material-sources"] });
  const { data: materials = [] } = useQuery<any[]>({ queryKey: ["/api/materials"] });
  const { data: suppliers = [] } = useQuery<any[]>({ queryKey: ["/api/suppliers"] });
  const { data: formulas = [] } = useQuery<any[]>({ queryKey: ["/api/formulas"] });
  const { data: productionBatches = [] } = useQuery<any[]>({ queryKey: ["/api/production-batches"] });

  // Enriched movements with joined material/batch info
  const { data: movements = [] } = useQuery<EnrichedMovement[]>({
    queryKey: ["/api/stock-movements", "enriched"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select(
          "*, material_sources(*, materials(name)), production_batches(batch_label, produced_at, produced_grams, formulas(name))",
        )
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return toCamel(data) as EnrichedMovement[];
    },
  });

  const enrichedSources = useMemo(() => {
    return sources
      .map((s: any) => ({
        ...s,
        materialName: materials.find((m: any) => m.id === s.materialId)?.name || "Unknown",
        supplierName: suppliers.find((sp: any) => sp.id === s.supplierId)?.name || "—",
        isLow:
          s.reorderThresholdGrams &&
          parseFloat(s.stockGrams || "0") <= parseFloat(s.reorderThresholdGrams),
      }))
      .sort((a: any, b: any) => a.materialName.localeCompare(b.materialName));
  }, [sources, materials, suppliers]);

  const lowStockCount = enrichedSources.filter((s: any) => s.isLow).length;

  // Filter movements: batch search + optional source selection
  const filteredMovements = useMemo(() => {
    const q = batchSearch.trim().toLowerCase();
    return movements.filter((m) => {
      if (selectedSourceId && m.materialSourceId !== selectedSourceId) return false;
      if (q) {
        const label = (m.batchLabel || "").toLowerCase();
        const joinedLabel = (m.productionBatches?.batchLabel || "").toLowerCase();
        if (!label.includes(q) && !joinedLabel.includes(q)) return false;
      }
      return true;
    });
  }, [movements, batchSearch, selectedSourceId]);

  const materialNameFor = (m: EnrichedMovement): string => {
    const joined = m.materialSources?.materials?.name;
    if (joined) return joined;
    const src = sources.find((s: any) => s.id === m.materialSourceId);
    if (!src) return "—";
    return materials.find((mm: any) => mm.id === src.materialId)?.name || "—";
  };

  const formulaNameFor = (m: EnrichedMovement): string => {
    const batchFormula = m.productionBatches?.formulas?.name;
    if (batchFormula) return batchFormula;
    if (m.relatedFormulaId) {
      return formulas.find((f: any) => f.id === m.relatedFormulaId)?.name || "—";
    }
    return "—";
  };

  const batchLabelFor = (m: EnrichedMovement): string | null => {
    return m.batchLabel || m.productionBatches?.batchLabel || null;
  };

  const formulaGroups = useMemo(() => {
    const groups = new Map<string, { formulaId: string; formulaName: string; batches: any[] }>();
    for (const b of productionBatches) {
      const fid: string = b.formulaId || b.formula_id || "__unassigned__";
      const formulaName =
        formulas.find((f: any) => f.id === fid)?.name || (fid === "__unassigned__" ? "Unassigned" : "—");
      const existing = groups.get(fid);
      if (existing) {
        existing.batches.push(b);
      } else {
        groups.set(fid, { formulaId: fid, formulaName, batches: [b] });
      }
    }
    const arr = Array.from(groups.values()).map((g) => {
      const batches = [...g.batches].sort((a, b) => {
        const ta = a.producedAt ? new Date(a.producedAt).getTime() : 0;
        const tb = b.producedAt ? new Date(b.producedAt).getTime() : 0;
        return tb - ta;
      });
      const totalProducedGrams = batches.reduce((acc, b) => acc + (parseFloat(b.producedGrams || b.produced_grams || "0") || 0), 0);
      const lastBatch = batches[0];
      const lastProducedAt: string | null = lastBatch?.producedAt || lastBatch?.produced_at || null;
      const lastBatchLabel: string | null = lastBatch?.batchLabel || lastBatch?.batch_label || null;
      return {
        ...g,
        batches,
        batchCount: batches.length,
        totalProducedGrams,
        lastProducedAt,
        lastBatchLabel,
      };
    });
    arr.sort((a, b) => {
      const ta = a.lastProducedAt ? new Date(a.lastProducedAt).getTime() : 0;
      const tb = b.lastProducedAt ? new Date(b.lastProducedAt).getTime() : 0;
      return tb - ta;
    });
    return arr;
  }, [productionBatches, formulas]);

  const movementsByBatchId = useMemo(() => {
    const map = new Map<string, EnrichedMovement[]>();
    for (const m of movements) {
      if (m.movementType !== "production" || !m.productionBatchId) continue;
      const arr = map.get(m.productionBatchId) || [];
      arr.push(m);
      map.set(m.productionBatchId, arr);
    }
    return map;
  }, [movements]);

  const formatProducedDate = (iso: string | null | undefined): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return format(d, "MMM d, yyyy");
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold">Stock Overview</h1>
          {lowStockCount > 0 && (
            <p className="text-xs text-yellow-400 flex items-center gap-1 mt-1">
              <AlertTriangle size={12} /> {lowStockCount} materials below threshold
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowProduction(true)} data-testid="button-new-production-batch">
            <FlaskConical size={14} className="mr-1" /> New Production Batch
          </Button>
          <Button size="sm" onClick={() => setShowMovement(true)} data-testid="button-add-movement">
            <Plus size={14} className="mr-1" /> Record Movement
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="text-left p-2 pl-3">Material</th>
              <th className="text-left p-2">Supplier</th>
              <th className="text-right p-2">Price/g</th>
              <th className="text-right p-2">Stock</th>
              <th className="text-right p-2">Threshold</th>
              <th className="text-center p-2 pr-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {enrichedSources.map((s: any) => (
              <tr
                key={s.id}
                className={`border-b border-border/30 hover:bg-secondary/30 cursor-pointer
                  ${s.isLow ? "bg-yellow-900/5" : ""}`}
                onClick={() => setSelectedSourceId(s.id === selectedSourceId ? null : s.id)}
              >
                <td className="p-2 pl-3 font-medium">{s.materialName}</td>
                <td className="p-2 text-muted-foreground">{s.supplierName}</td>
                <td className="text-right p-2 font-mono text-xs">€ {fmtNum(s.pricePerGram)}</td>
                <td className={`text-right p-2 font-mono text-xs ${s.isLow ? "text-yellow-400" : ""}`}>
                  {fmtGrams(s.stockGrams)}
                </td>
                <td className="text-right p-2 font-mono text-xs text-muted-foreground">
                  {s.reorderThresholdGrams ? fmtGrams(s.reorderThresholdGrams) : "—"}
                </td>
                <td className="text-center p-2 pr-3">
                  {s.isLow ? (
                    <Badge className="warning-badge warning-stock text-[10px]">Low</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">OK</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Production overview grouped by formula */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Production</h3>
          <span className="text-xs text-muted-foreground">
            {formulaGroups.length} formula{formulaGroups.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="w-8 p-2 pl-3"></th>
                <th className="text-left p-2">Formula</th>
                <th className="text-right p-2">Total produced</th>
                <th className="text-right p-2">Batches</th>
                <th className="text-left p-2">Last produced</th>
                <th className="text-left p-2 pr-3">Last batch</th>
              </tr>
            </thead>
            <tbody>
              {formulaGroups.map((g) => {
                const isOpen = !!expandedFormulas[g.formulaId];
                return (
                  <Fragment key={g.formulaId}>
                    <tr
                      className="border-b border-border/30 hover:bg-secondary/30 cursor-pointer"
                      onClick={() =>
                        setExpandedFormulas((prev) => ({ ...prev, [g.formulaId]: !prev[g.formulaId] }))
                      }
                      data-testid={`row-formula-group-${g.formulaId}`}
                    >
                      <td className="p-2 pl-3 text-muted-foreground">
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td className="p-2 font-medium">{g.formulaName}</td>
                      <td className="text-right p-2 font-mono text-xs">
                        {fmtGrams(String(g.totalProducedGrams))}
                      </td>
                      <td className="text-right p-2 font-mono text-xs">{g.batchCount}</td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {formatProducedDate(g.lastProducedAt)}
                      </td>
                      <td className="p-2 pr-3 font-mono text-xs text-muted-foreground">
                        {g.lastBatchLabel || "—"}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-border/30 bg-secondary/10">
                        <td colSpan={6} className="p-3">
                          {g.batches.length === 0 ? (
                            <div className="text-xs text-muted-foreground">No batches.</div>
                          ) : (
                            <div className="space-y-2">
                              {g.batches.map((b: any) => {
                                const batchId: string = b.id;
                                const isBatchOpen = !!expandedBatches[batchId];
                                const trail = movementsByBatchId.get(batchId) || [];
                                return (
                                  <div
                                    key={batchId}
                                    className="bg-card rounded border border-border/60 overflow-hidden"
                                  >
                                    <div
                                      className="flex items-center gap-3 p-2 cursor-pointer hover:bg-secondary/30"
                                      onClick={() =>
                                        setExpandedBatches((prev) => ({ ...prev, [batchId]: !prev[batchId] }))
                                      }
                                      data-testid={`row-batch-${batchId}`}
                                    >
                                      <span className="text-muted-foreground">
                                        {isBatchOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                      </span>
                                      <span className="font-mono text-xs">
                                        {b.batchLabel || b.batch_label || "—"}
                                      </span>
                                      <span className="font-mono text-xs text-muted-foreground">
                                        {fmtGrams(b.producedGrams || b.produced_grams)}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {formatProducedDate(b.producedAt || b.produced_at)}
                                      </span>
                                      <span className="text-xs text-muted-foreground flex-1 truncate">
                                        {b.notes || ""}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground">
                                        {trail.length} movement{trail.length === 1 ? "" : "s"}
                                      </span>
                                    </div>
                                    {isBatchOpen && (
                                      <div className="border-t border-border/60">
                                        {trail.length === 0 ? (
                                          <div className="p-3 text-xs text-muted-foreground text-center">
                                            No stock movements linked to this batch.
                                          </div>
                                        ) : (
                                          <table className="w-full text-sm">
                                            <thead>
                                              <tr className="border-b border-border/60 text-xs text-muted-foreground">
                                                <th className="text-left p-2 pl-3">Material</th>
                                                <th className="text-right p-2">Δg</th>
                                                <th className="text-left p-2">Type</th>
                                                <th className="text-left p-2 pr-3">Notes</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {trail.map((m) => {
                                                const delta = parseFloat(m.gramsDelta || "0");
                                                return (
                                                  <tr key={m.id} className="border-b border-border/30 last:border-b-0">
                                                    <td className="p-2 pl-3">{materialNameFor(m)}</td>
                                                    <td
                                                      className={`text-right p-2 font-mono text-xs ${
                                                        delta >= 0 ? "text-green-400" : "text-red-400"
                                                      }`}
                                                    >
                                                      {delta >= 0 ? "+" : ""}
                                                      {fmtGrams(m.gramsDelta)}
                                                    </td>
                                                    <td className="p-2">
                                                      <Badge variant="outline" className="text-[10px]">
                                                        {m.movementType || "—"}
                                                      </Badge>
                                                    </td>
                                                    <td className="p-2 pr-3 text-xs text-muted-foreground truncate max-w-[20rem]">
                                                      {m.notes || "—"}
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {formulaGroups.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-xs text-muted-foreground">
                    No production batches yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Movement history */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">
            Movements
            {selectedSourceId && (
              <button
                className="ml-2 text-xs text-muted-foreground underline"
                onClick={() => setSelectedSourceId(null)}
              >
                clear material filter
              </button>
            )}
          </h3>
          <Input
            placeholder="Search by batch label…"
            value={batchSearch}
            onChange={(e) => setBatchSearch(e.target.value)}
            className="w-64"
            data-testid="input-batch-search"
          />
        </div>

        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="text-left p-2 pl-3">Timestamp</th>
                <th className="text-left p-2">Material</th>
                <th className="text-right p-2">Δg</th>
                <th className="text-left p-2">Type</th>
                <th className="text-left p-2">Batch</th>
                <th className="text-left p-2">Formula</th>
                <th className="text-left p-2 pr-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.map((m) => {
                const delta = parseFloat(m.gramsDelta || "0");
                const label = batchLabelFor(m);
                return (
                  <tr key={m.id} className="border-b border-border/30 hover:bg-secondary/30">
                    <td className="p-2 pl-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {formatTimestamp(m.createdAt || m.date)}
                    </td>
                    <td className="p-2">{materialNameFor(m)}</td>
                    <td className={`text-right p-2 font-mono text-xs ${delta >= 0 ? "text-green-400" : "text-red-400"}`}>
                      <span className="inline-flex items-center justify-end gap-1">
                        {delta >= 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                        {delta >= 0 ? "+" : ""}
                        {fmtGrams(m.gramsDelta)}
                      </span>
                    </td>
                    <td className="p-2">
                      <Badge variant="outline" className="text-[10px]">{m.movementType || "—"}</Badge>
                    </td>
                    <td className="p-2">
                      {label ? (
                        <button
                          className="text-xs font-mono px-2 py-0.5 rounded bg-secondary hover:bg-secondary/70 border border-border"
                          onClick={() => setSelectedBatch({ label, productionBatchId: m.productionBatchId })}
                          data-testid={`chip-batch-${m.id}`}
                        >
                          {label}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-2 text-muted-foreground">{formulaNameFor(m)}</td>
                    <td className="p-2 pr-3 text-xs text-muted-foreground truncate max-w-[16rem]">
                      {m.notes || "—"}
                    </td>
                  </tr>
                );
              })}
              {filteredMovements.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-xs text-muted-foreground">
                    No movements found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <StockMovementDialog open={showMovement} onOpenChange={setShowMovement} sources={enrichedSources} productionBatches={productionBatches} />
      <ProductionBatchDialog open={showProduction} onOpenChange={setShowProduction} formulas={formulas} productionBatches={productionBatches} />
      <BatchDetailModal
        batch={selectedBatch}
        movements={movements}
        materialNameFor={materialNameFor}
        onClose={() => setSelectedBatch(null)}
      />
    </div>
  );
}

function StockMovementDialog({ open, onOpenChange, sources, productionBatches }: any) {
  const { toast } = useToast();
  const [sourceId, setSourceId] = useState("");
  const [type, setType] = useState("restock");
  const [grams, setGrams] = useState("");
  const [productionBatchId, setProductionBatchId] = useState("");
  const [batchLabel, setBatchLabel] = useState("");
  const [notes, setNotes] = useState("");

  const reset = () => {
    setSourceId("");
    setGrams("");
    setProductionBatchId("");
    setBatchLabel("");
    setNotes("");
    setType("restock");
  };

  const sortedBatches = useMemo(() => {
    const arr = [...(productionBatches || [])];
    arr.sort((a: any, b: any) => {
      const ta = a.producedAt ? new Date(a.producedAt).getTime() : 0;
      const tb = b.producedAt ? new Date(b.producedAt).getTime() : 0;
      return tb - ta;
    });
    return arr.slice(0, 20);
  }, [productionBatches]);

  const mutation = useMutation({
    mutationFn: (data: any) => postJson("/api/stock-movements", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-movements", "enriched"] });
      queryClient.invalidateQueries({ queryKey: ["/api/material-sources"] });
      onOpenChange(false);
      reset();
      toast({ title: "Movement recorded" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Record Stock Movement</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Material source</Label>
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger><SelectValue placeholder="Material source" /></SelectTrigger>
              <SelectContent>
                {sources.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.materialName} ({s.supplierName})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="restock">Restock (add)</SelectItem>
                <SelectItem value="use">Use (subtract)</SelectItem>
                <SelectItem value="adjustment">Adjustment</SelectItem>
                <SelectItem value="loss">Loss (subtract)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Grams</Label>
            <Input placeholder="Grams" value={grams} onChange={(e) => setGrams(e.target.value)} type="number" step="0.1" />
          </div>
          <div>
            <Label className="text-xs">Production batch (optional)</Label>
            <Select
              value={productionBatchId}
              onValueChange={(v) => {
                setProductionBatchId(v);
                const b = sortedBatches.find((x: any) => x.id === v);
                setBatchLabel(b?.batchLabel || b?.batch_label || "");
              }}
              disabled={sortedBatches.length === 0}
            >
              <SelectTrigger data-testid="select-movement-batch">
                <SelectValue
                  placeholder={
                    sortedBatches.length === 0
                      ? "No batches yet — create one first"
                      : "Select a batch"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {sortedBatches.map((b: any) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.batchLabel || b.batch_label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <Button
            className="w-full"
            disabled={!sourceId || !grams || mutation.isPending}
            onClick={() => mutation.mutate({
              materialSourceId: sourceId,
              movementType: type,
              gramsDelta: String(parseFloat(grams) || 0),
              productionBatchId: productionBatchId || null,
              batchLabel: batchLabel.trim() || null,
              notes: notes.trim() || null,
            })}
            data-testid="button-record-movement"
          >
            Record
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProductionBatchDialog({ open, onOpenChange, formulas, productionBatches }: any) {
  const { toast } = useToast();
  const [formulaId, setFormulaId] = useState("");
  const [batchLabel, setBatchLabel] = useState("");
  const [producedGrams, setProducedGrams] = useState("");
  const [notes, setNotes] = useState("");

  const reset = () => {
    setFormulaId("");
    setBatchLabel("");
    setProducedGrams("");
    setNotes("");
  };

  const mutation = useMutation({
    mutationFn: (data: any) => postJson("/api/production-batches", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production-batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-movements", "enriched"] });
      onOpenChange(false);
      reset();
      toast({ title: "Production batch created" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "Failed to create batch", variant: "destructive" });
    },
  });

  const generateLabel = () => {
    const formula = formulas.find((f: any) => f.id === formulaId);
    setBatchLabel(generateBatchLabel(formula?.name || "Formula", productionBatches || []));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Production Batch</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Formula</Label>
            <Select value={formulaId} onValueChange={setFormulaId}>
              <SelectTrigger><SelectValue placeholder="Select formula" /></SelectTrigger>
              <SelectContent>
                {formulas.map((f: any) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Batch label</Label>
            <div className="flex gap-2">
              <Input
                placeholder="2026-04-19-Clementine-01"
                value={batchLabel}
                onChange={(e) => setBatchLabel(e.target.value)}
                data-testid="input-production-batch-label"
              />
              <Button variant="outline" size="sm" onClick={generateLabel} disabled={!formulaId}>
                Generate
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Format: YYYY-MM-DD-Name-NN</p>
          </div>
          <div>
            <Label className="text-xs">Produced grams</Label>
            <Input
              placeholder="Produced grams"
              value={producedGrams}
              onChange={(e) => setProducedGrams(e.target.value)}
              type="number"
              step="0.1"
            />
          </div>
          <div>
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <Button
            className="w-full"
            disabled={!batchLabel || !formulaId || mutation.isPending}
            onClick={() => mutation.mutate({
              batchLabel: batchLabel.trim(),
              formulaId: formulaId || null,
              producedGrams: producedGrams ? String(parseFloat(producedGrams) || 0) : null,
              producedAt: new Date().toISOString(),
              notes: notes.trim() || null,
            })}
            data-testid="button-save-production-batch"
          >
            Save batch
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BatchDetailModal({ batch, movements, materialNameFor, onClose }: {
  batch: { label: string; productionBatchId: string | null } | null;
  movements: EnrichedMovement[];
  materialNameFor: (m: EnrichedMovement) => string;
  onClose: () => void;
}) {
  const related = useMemo(() => {
    if (!batch) return [];
    return movements.filter((m) => {
      if (batch.productionBatchId && m.productionBatchId === batch.productionBatchId) return true;
      return (m.batchLabel || m.productionBatches?.batchLabel) === batch.label;
    });
  }, [batch, movements]);

  const firstWithBatch = related.find((m) => m.productionBatches);
  const pb = firstWithBatch?.productionBatches;

  return (
    <Dialog open={!!batch} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">Batch: {batch?.label}</DialogTitle>
        </DialogHeader>
        {batch && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <div className="text-muted-foreground">Formula</div>
                <div>{pb?.formulas?.name || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Produced at</div>
                <div className="font-mono">{pb?.producedAt ? formatTimestamp(pb.producedAt) : "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Produced grams</div>
                <div className="font-mono">{pb?.producedGrams ? fmtGrams(pb.producedGrams) : "—"}</div>
              </div>
            </div>

            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left p-2 pl-3">Timestamp</th>
                    <th className="text-left p-2">Material</th>
                    <th className="text-right p-2">Δg</th>
                    <th className="text-left p-2">Type</th>
                    <th className="text-left p-2 pr-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {related.map((m) => {
                    const delta = parseFloat(m.gramsDelta || "0");
                    return (
                      <tr key={m.id} className="border-b border-border/30">
                        <td className="p-2 pl-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {formatTimestamp(m.createdAt || m.date)}
                        </td>
                        <td className="p-2">{materialNameFor(m)}</td>
                        <td className={`text-right p-2 font-mono text-xs ${delta >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {delta >= 0 ? "+" : ""}{fmtGrams(m.gramsDelta)}
                        </td>
                        <td className="p-2"><Badge variant="outline" className="text-[10px]">{m.movementType || "—"}</Badge></td>
                        <td className="p-2 pr-3 text-xs text-muted-foreground">{m.notes || "—"}</td>
                      </tr>
                    );
                  })}
                  {related.length === 0 && (
                    <tr><td colSpan={5} className="p-4 text-center text-xs text-muted-foreground">No movements linked to this batch.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
