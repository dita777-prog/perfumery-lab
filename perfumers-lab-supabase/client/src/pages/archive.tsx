import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Archive, FlaskConical, Search, RotateCcw, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { patchJson, recalcPercents, fmtGrams, fmtPercent, fmtNum } from "@/lib/api";

export default function ArchivePage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);

  const { data: formulas = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/formulas"] });

  const restoreMut = useMutation({
    mutationFn: (id: string) =>
      patchJson(`/api/formulas/${id}`, { status: "active", archivedAt: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/formulas"] });
      setConfirmRestoreId(null);
      setViewingId(null);
      toast({ title: "Formula restored to active" });
    },
    onError: (err: any) => {
      setConfirmRestoreId(null);
      toast({
        title: "Failed to restore formula",
        description: err?.message || "Unknown error",
        variant: "destructive",
      });
    },
  });

  const archived = formulas.filter((f: any) => f.status === "archive");
  const filtered = archived.filter((f: any) =>
    f.name?.toLowerCase().includes(search.toLowerCase())
  );
  const viewing = archived.find((f: any) => f.id === viewingId) || null;
  const confirmFormula = archived.find((f: any) => f.id === confirmRestoreId) || null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6 pl-10 md:pl-0">
        <Archive size={22} className="text-[hsl(183,70%,50%)]" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Archive</h1>
          <p className="text-sm text-muted-foreground">Archived formula versions</p>
        </div>
      </div>

      <div className="relative mb-6">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          placeholder="Search archived formulas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-secondary/30 border-border"
          data-testid="input-archive-search"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-secondary/30 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Archive size={40} className="text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground text-sm">
            {search ? "No archived formulas match your search." : "No archived formulas yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((formula: any) => (
            <Card
              key={formula.id}
              className="bg-card border-border cursor-pointer hover:border-[hsl(183,70%,36%)]/40 transition-colors"
              onClick={() => setViewingId(formula.id)}
              data-testid={`archive-item-${formula.id}`}
            >
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FlaskConical size={15} className="text-muted-foreground" />
                    <div>
                      <CardTitle className="text-sm font-medium text-foreground">
                        {formula.name}
                        {formula.version && (
                          <span className="ml-2 text-xs text-muted-foreground font-normal">
                            v{formula.version}
                          </span>
                        )}
                      </CardTitle>
                      {formula.archivedAt && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Archived:{" "}
                          {new Date(formula.archivedAt).toLocaleDateString("cs-CZ")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmRestoreId(formula.id);
                      }}
                      data-testid={`button-restore-${formula.id}`}
                    >
                      <RotateCcw size={12} className="mr-1" /> Restore
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Read-only detail dialog */}
      <Dialog open={!!viewing} onOpenChange={(v) => { if (!v) setViewingId(null); }}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[85vh] overflow-y-auto">
          {viewing && (
            <ArchivedFormulaView
              formula={viewing}
              onRestoreClick={() => setConfirmRestoreId(viewing.id)}
              onClose={() => setViewingId(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Restore confirmation */}
      <Dialog
        open={!!confirmRestoreId}
        onOpenChange={(v) => { if (!v) setConfirmRestoreId(null); }}
      >
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle>Restore Formula</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Restore{" "}
            <span className="text-foreground font-medium">
              "{confirmFormula?.name}"
            </span>{" "}
            to active formulas?
          </p>
          <div className="flex gap-2 justify-end mt-3">
            <Button variant="outline" onClick={() => setConfirmRestoreId(null)}>
              Cancel
            </Button>
            <Button
              disabled={restoreMut.isPending}
              onClick={() => confirmRestoreId && restoreMut.mutate(confirmRestoreId)}
              data-testid="button-confirm-restore"
            >
              {restoreMut.isPending ? "Restoring..." : "Restore"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ArchivedFormulaView({
  formula,
  onRestoreClick,
  onClose,
}: {
  formula: any;
  onRestoreClick: () => void;
  onClose: () => void;
}) {
  const { data: ingredients = [] } = useQuery<any[]>({
    queryKey: ["/api/formulas", formula.id, "ingredients"],
  });
  const { data: materials = [] } = useQuery<any[]>({ queryKey: ["/api/materials"] });
  const { data: dilutions = [] } = useQuery<any[]>({ queryKey: ["/api/dilutions"] });
  const { data: allFormulas = [] } = useQuery<any[]>({ queryKey: ["/api/formulas"] });
  const { data: categories = [] } = useQuery<any[]>({ queryKey: ["/api/formula-categories"] });

  const enriched = recalcPercents(ingredients);
  const totalWeighed = ingredients.reduce(
    (s: number, i: any) => s + parseFloat(i.gramsAsWeighed || "0"),
    0
  );
  const totalNeat = ingredients.reduce(
    (s: number, i: any) =>
      s + parseFloat((i.neatGrams != null ? i.neatGrams : i.gramsAsWeighed) || "0"),
    0
  );
  const totalPercent = enriched.reduce(
    (s: number, i: any) => s + parseFloat(i.percentInFormula || "0"),
    0
  );
  const categoryName =
    categories.find((c: any) => c.id === formula.categoryId)?.name || "Uncategorized";

  function ingredientLabel(ing: any) {
    if (ing.materialId) {
      return materials.find((m: any) => m.id === ing.materialId)?.name || "Unknown material";
    }
    if (ing.sourceFormulaId) {
      return allFormulas.find((f: any) => f.id === ing.sourceFormulaId)?.name || "Formula";
    }
    if (ing.dilutionId) {
      return dilutions.find((d: any) => d.id === ing.dilutionId)?.name || "Dilution";
    }
    return "Unknown";
  }

  function dilutionLabel(ing: any) {
    if (ing.dilutionId) {
      const dil = dilutions.find((d: any) => d.id === ing.dilutionId);
      return dil ? `${fmtNum(dil.dilutionPercent)}%` : "?";
    }
    return "100%";
  }

  return (
    <div>
      <DialogHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle className="text-xl">
              {formula.name}
              {formula.version && (
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  v{formula.version}
                </span>
              )}
            </DialogTitle>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary">{categoryName}</Badge>
              <Badge variant="outline" className="text-[hsl(183,70%,50%)] border-[hsl(183,70%,36%)]/40">
                <Archive size={10} className="mr-1" /> Archived
              </Badge>
              <Badge variant="outline">Read-only</Badge>
            </div>
            {formula.archivedAt && (
              <p className="text-xs text-muted-foreground mt-2">
                Archived on {new Date(formula.archivedAt).toLocaleDateString("cs-CZ")}
              </p>
            )}
          </div>
          <div className="flex gap-2 items-center">
            <Button
              size="sm"
              onClick={onRestoreClick}
              data-testid="button-restore-from-detail"
            >
              <RotateCcw size={12} className="mr-1" /> Restore
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close">
              <X size={14} />
            </Button>
          </div>
        </div>
      </DialogHeader>

      <div className="mt-4 bg-secondary/20 rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="text-left p-2 pl-3">Ingredient</th>
              <th className="text-center p-2" style={{ width: 90 }}>Dilution</th>
              <th className="text-right p-2" style={{ width: 90 }}>Weighed</th>
              <th className="text-right p-2" style={{ width: 80 }}>Neat</th>
              <th className="text-right p-2 pr-3" style={{ width: 75 }}>%</th>
            </tr>
          </thead>
          <tbody>
            {enriched.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-xs text-muted-foreground">
                  No ingredients recorded
                </td>
              </tr>
            ) : (
              enriched.map((ing: any) => (
                <tr key={ing.id} className="border-b border-border/50">
                  <td className="p-2 pl-3">
                    <span className={ing.dilutionId ? "text-[hsl(183,70%,50%)]" : ""}>
                      {ingredientLabel(ing)}
                    </span>
                    {ing.sourceType === "formula" && (
                      <Badge variant="outline" className="ml-1 text-[9px]">accord</Badge>
                    )}
                  </td>
                  <td className="text-center p-2 font-mono text-xs">{dilutionLabel(ing)}</td>
                  <td className="text-right p-2 font-mono text-xs">
                    {fmtGrams(ing.gramsAsWeighed)}
                  </td>
                  <td className="text-right p-2 font-mono text-xs">
                    {fmtGrams(ing.neatGrams || ing.gramsAsWeighed)}
                  </td>
                  <td className="text-right p-2 pr-3 font-mono text-xs">
                    {fmtPercent(ing.percentInFormula)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="text-[hsl(183,70%,50%)] font-medium">
              <td className="p-2 pl-3">Total</td>
              <td />
              <td className="text-right p-2 font-mono text-xs">{fmtGrams(totalWeighed)}</td>
              <td className="text-right p-2 font-mono text-xs">{fmtGrams(totalNeat)}</td>
              <td className="text-right p-2 pr-3 font-mono text-xs">
                {fmtPercent(totalPercent)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {formula.formulaNotes && (
        <div className="mt-4 bg-card rounded-lg border border-border p-4">
          <h3 className="text-xs font-semibold text-muted-foreground mb-2">Notes</h3>
          <p className="text-sm whitespace-pre-wrap">{formula.formulaNotes}</p>
        </div>
      )}
    </div>
  );
}
