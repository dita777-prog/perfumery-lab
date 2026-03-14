import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { Plus, AlertTriangle, ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { postJson, fmtNum, fmtGrams } from "@/lib/api";

export default function StockPage() {
  const { toast } = useToast();
  const [showMovement, setShowMovement] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  const { data: sources = [] } = useQuery<any[]>({ queryKey: ["/api/material-sources"] });
  const { data: materials = [] } = useQuery<any[]>({ queryKey: ["/api/materials"] });
  const { data: suppliers = [] } = useQuery<any[]>({ queryKey: ["/api/suppliers"] });
  const { data: movements = [] } = useQuery<any[]>({ queryKey: ["/api/stock-movements"] });

  const enrichedSources = sources.map((s: any) => ({
    ...s,
    materialName: materials.find((m: any) => m.id === s.materialId)?.name || "Unknown",
    supplierName: suppliers.find((sp: any) => sp.id === s.supplierId)?.name || "—",
    isLow: s.reorderThresholdGrams && parseFloat(s.stockGrams || "0") <= parseFloat(s.reorderThresholdGrams),
  })).sort((a: any, b: any) => a.materialName.localeCompare(b.materialName));

  const lowStockCount = enrichedSources.filter((s: any) => s.isLow).length;

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
        <Button size="sm" onClick={() => setShowMovement(true)} data-testid="button-add-movement">
          <Plus size={14} className="mr-1" /> Record Movement
        </Button>
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
              <tr key={s.id}
                className={`border-b border-border/30 hover:bg-secondary/30 cursor-pointer
                  ${s.isLow ? 'bg-yellow-900/5' : ''}`}
                onClick={() => setSelectedSourceId(s.id === selectedSourceId ? null : s.id)}
              >
                <td className="p-2 pl-3 font-medium">{s.materialName}</td>
                <td className="p-2 text-muted-foreground">{s.supplierName}</td>
                <td className="text-right p-2 font-mono text-xs">€ {fmtNum(s.pricePerGram)}</td>
                <td className={`text-right p-2 font-mono text-xs ${s.isLow ? 'text-yellow-400' : ''}`}>
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

      {/* Movement history for selected source */}
      {selectedSourceId && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold mb-2">Movements</h3>
          <div className="space-y-1">
            {movements.filter((m: any) => m.materialSourceId === selectedSourceId).map((m: any) => (
              <div key={m.id} className="flex items-center gap-3 text-xs bg-card rounded p-2 border border-border/50">
                {parseFloat(m.gramsDelta || "0") > 0 ? <ArrowUp size={12} className="text-green-400" /> : <ArrowDown size={12} className="text-red-400" />}
                <span className="font-mono">{fmtGrams(m.gramsDelta)}</span>
                <span className="text-muted-foreground">{m.movementType}</span>
                <span className="text-muted-foreground ml-auto">{m.date ? new Date(m.date).toLocaleDateString() : ""}</span>
              </div>
            ))}
            {movements.filter((m: any) => m.materialSourceId === selectedSourceId).length === 0 && (
              <p className="text-xs text-muted-foreground">No movements recorded</p>
            )}
          </div>
        </div>
      )}

      <StockMovementDialog open={showMovement} onOpenChange={setShowMovement} sources={enrichedSources} />
    </div>
  );
}

function StockMovementDialog({ open, onOpenChange, sources }: any) {
  const { toast } = useToast();
  const [sourceId, setSourceId] = useState("");
  const [type, setType] = useState("purchase");
  const [grams, setGrams] = useState("");

  const mutation = useMutation({
    mutationFn: (data: any) => postJson("/api/stock-movements", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/material-sources"] });
      onOpenChange(false);
      setSourceId(""); setGrams("");
      toast({ title: "Movement recorded" });
    },
  });

  const delta = type === "usage" || type === "waste" ? `-${grams}` : grams;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader><DialogTitle>Record Stock Movement</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Select value={sourceId} onValueChange={setSourceId}>
            <SelectTrigger><SelectValue placeholder="Material source" /></SelectTrigger>
            <SelectContent>
              {sources.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.materialName} ({s.supplierName})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="purchase">Purchase (add)</SelectItem>
              <SelectItem value="usage">Usage (subtract)</SelectItem>
              <SelectItem value="adjustment">Adjustment</SelectItem>
              <SelectItem value="waste">Waste (subtract)</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Grams" value={grams} onChange={e => setGrams(e.target.value)} type="number" step="0.1" />
          <Button className="w-full" disabled={!sourceId || !grams || mutation.isPending} onClick={() => mutation.mutate({
            materialSourceId: sourceId, movementType: type, gramsDelta: delta,
          })} data-testid="button-record-movement">
            Record
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
