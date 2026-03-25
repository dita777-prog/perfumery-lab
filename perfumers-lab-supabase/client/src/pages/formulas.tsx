import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Plus, Copy, Scale, AlertTriangle, Pencil, Tag, Trash2, ChevronDown, ArrowLeft, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { fmtNum, fmtGrams, fmtPercent, postJson, patchJson, deleteJson, recalcPercents, calcPyramidBreakdown, scaleToTotalWeight, scaleByFactor, scaleToAbsolutePercent, scalePercentByFactor } from "@/lib/api";

/** Parse European-style number input (accept both comma and dot as decimal separator) */
function parseEuroInput(val: string): number {
  // Replace comma with dot for parsing
  const normalized = val.replace(",", ".");
  return parseFloat(normalized);
}

export default function FormulasPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewingMaterialId, setViewingMaterialId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showCatManager, setShowCatManager] = useState(false);
  const [filter, setFilter] = useState("");
    const { toast } = useToast();
    const [formulaCtxMenu, setFormulaCtxMenu] = useState<{ x: number; y: number; formula: any } | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const deleteFormulaMut = useMutation({
          mutationFn: (id: string) => deleteJson(`/api/formulas/${id}`),
          onSuccess: () => {
                  queryClient.invalidateQueries({ queryKey: ["/api/formulas"] });
                  setConfirmDeleteId(null);
                  setSelectedId(null);
                  toast({ title: "Formula deleted" });
                },
          onError: (err: any) => {
      setConfirmDeleteId(null);
      toast({ title: "Failed to delete formula", description: err?.message || "Unknown error", variant: "destructive" });
    },
        });
    useEffect(() => {
          const handler = () => setFormulaCtxMenu(null);
          if (formulaCtxMenu) window.addEventListener("click", handler);
          return () => window.removeEventListener("click", handler);
        }, [formulaCtxMenu]);

  const { data: formulas = [] } = useQuery<any[]>({ queryKey: ["/api/formulas"] });
  const { data: categories = [] } = useQuery<any[]>({ queryKey: ["/api/formula-categories"] });

  const grouped = categories.map((c: any) => ({
    category: c,
    formulas: formulas.filter((f: any) => f.categoryId === c.id)
      .filter((f: any) => !filter || f.name.toLowerCase().includes(filter.toLowerCase()))
  })).filter(g => g.formulas.length > 0);

  const ungrouped = formulas.filter((f: any) => !f.categoryId)
    .filter((f: any) => !filter || f.name.toLowerCase().includes(filter.toLowerCase()));

  const selected = formulas.find((f: any) => f.id === selectedId);

  return (
    <div className="panel-layout h-full">
            <div className={`border-r border-border flex flex-col h-full overflow-hidden ${selectedId ? 'hidden md:flex' : 'flex'}`}>
        <div className="py-3 pr-3 pl-14 md:pl-3 border-b border-border flex items-center gap-2">
          <h2 className="text-sm font-semibold flex-1">Formulas</h2>
          <Button size="sm" variant="ghost" onClick={() => setShowCatManager(true)} data-testid="button-category-manager" title="Category Manager">
            <Tag size={14} />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowCreate(true)} data-testid="button-add-formula">
            <Plus size={14} />
          </Button>
        </div>
        <div className="px-3 py-2">
          <Input placeholder="Filter..." value={filter} onChange={e => setFilter(e.target.value)} className="h-7 text-xs" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {grouped.map(({ category, formulas: forms }) => (
            <div key={category.id}>
              <div className="px-3 py-2 text-[13px] font-semibold uppercase tracking-wider text-[#60a5fa] bg-secondary/50">
                {category.name}
              </div>
              {forms.map((f: any) => (
                <div key={f.id}
                  className={`flex items-center px-3 py-1.5 text-sm cursor-pointer hover:bg-secondary/50 transition-colors border-b border-border/30
                    ${selectedId === f.id ? 'bg-[hsl(183,70%,36%)]/10 text-[hsl(183,70%,50%)]' : 'text-foreground/80'}`}
                  onClick={() => { setSelectedId(f.id); setViewingMaterialId(null); }}
                                  onContextMenu={(e) => { e.preventDefault(); setFormulaCtxMenu({ x: e.clientX, y: e.clientY, formula: f }); }}
                  data-testid={`formula-item-${f.id}`}
                >
                  <span className="truncate flex-1">{f.name}</span>{f.createdAt && <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">{new Date(f.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                </div>
              ))}
            </div>
          ))}
          {ungrouped.length > 0 && (
            <div>
              <div className="px-3 py-2 text-[13px] font-semibold uppercase tracking-wider text-[#60a5fa] bg-secondary/50">Uncategorized</div>
              {ungrouped.map((f: any) => (
                <div key={f.id}
                  className={`flex items-center px-3 py-1.5 text-sm cursor-pointer hover:bg-secondary/50 border-b border-border/30
                    ${selectedId === f.id ? 'bg-[hsl(183,70%,36%)]/10' : ''}`}
                  onClick={() => { setSelectedId(f.id); setViewingMaterialId(null); }}
                                onContextMenu={(e) => { e.preventDefault(); setFormulaCtxMenu({ x: e.clientX, y: e.clientY, formula: f }); }}
                >
                  <span className="truncate flex-1">{f.name}</span>{f.createdAt && <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">{new Date(f.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto ${selectedId ? '' : 'hidden md:block'}`}>
        {viewingMaterialId ? <MaterialCardView materialId={viewingMaterialId} onBack={() => setViewingMaterialId(null)} /> : selected ? <><button onClick={() => setSelectedId(null)} className="md:hidden flex items-center gap-1 pl-14 md:pl-3 pr-3 pt-3 text-sm text-muted-foreground"><ArrowLeft size={16} /> Back</button><FormulaDetail formula={selected} onBack={() => setSelectedId(null)} onMaterialClick={(id: string) => setViewingMaterialId(id)} /></> : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Select a formula</div>
        )}
              </div>
            
      <CreateFormulaDialog open={showCreate} onOpenChange={setShowCreate} categories={categories} onCreated={(id) => setSelectedId(id)} />
      <CategoryManagerDialog open={showCatManager} onOpenChange={setShowCatManager} />
            {/* Formula context menu */}
            {formulaCtxMenu && (
              <div
                          className="fixed bg-popover border border-border rounded-lg shadow-lg py-1 z-50 min-w-[180px]"
                          style={{ left: formulaCtxMenu.x, top: formulaCtxMenu.y }}
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                                        className="block w-full text-left px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                                        onClick={() => { setConfirmDeleteId(formulaCtxMenu.formula.id); setFormulaCtxMenu(null); }}
                                      >
                                        <Trash2 size={12} className="inline mr-1.5" /> Delete formula
                                      </button>
                        </div>
            )}
            {/* Delete confirmation dialog */}
            <Dialog open={!!confirmDeleteId} onOpenChange={(v) => { if (!v) setConfirmDeleteId(null); }}>
                      <DialogContent className="bg-card border-border max-w-sm">
                                  <DialogHeader><DialogTitle>Delete Formula</DialogTitle></DialogHeader>
                                  <p className="text-sm text-muted-foreground">Are you sure you want to delete this formula? This action cannot be undone.</p>
                                  <div className="flex gap-2 justify-end mt-3">
                                                <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                                                <Button variant="destructive" disabled={deleteFormulaMut.isPending} onClick={() => confirmDeleteId && deleteFormulaMut.mutate(confirmDeleteId)}>
                                                                {deleteFormulaMut.isPending ? "Deleting..." : "Delete"}
                                                              </Button>
                                              </div>
                                </DialogContent>
                    </Dialog>
    </div>
  );
}

// ─── Formula Detail ─────────────────────────────────────────────
function FormulaDetail({ formula, onBack, onMaterialClick }: { formula: any; onBack?: () => void; onMaterialClick?: (id: string) => void }) {
  const { toast } = useToast();
  const [showScale, setShowScale] = useState(false);
  const [showDupDialog, setShowDupDialog] = useState(false);
  const [showAddIngredient, setShowAddIngredient] = useState(false);
    const [editingName, setEditingName] = useState(false);
    const [nameValue, setNameValue] = useState(formula.name);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState(formula.formulaNotes || "");

  const { data: ingredients = [] } = useQuery<any[]>({ queryKey: ["/api/formulas", formula.id, "ingredients"] });
    const nameInputRef = useRef<HTMLInputElement>(null);
  const { data: materials = [] } = useQuery<any[]>({ queryKey: ["/api/materials"] });
  const { data: families = [] } = useQuery<any[]>({ queryKey: ["/api/olfactive-families"] });
  const { data: dilutions = [] } = useQuery<any[]>({ queryKey: ["/api/dilutions"] });
  const { data: allFormulas = [] } = useQuery<any[]>({ queryKey: ["/api/formulas"] });
  const { data: categories = [] } = useQuery<any[]>({ queryKey: ["/api/formula-categories"] });

  // Reset notes when formula changes
  useEffect(() => { setNotesText(formula.formulaNotes || ""); setEditingNotes(false); setNameValue(formula.name); setEditingName(false); }, [formula.id]);

  const enriched = recalcPercents(ingredients);
  const totalWeighed = ingredients.reduce((s: number, i: any) => s + parseFloat(i.gramsAsWeighed || "0"), 0);
  const totalNeat = ingredients.reduce((s: number, i: any) => s + parseFloat((i.neatGrams != null ? i.neatGrams : i.gramsAsWeighed) || "0"), 0);
  const totalPercent = enriched.reduce((s: number, i: any) => s + parseFloat(i.percentInFormula || "0"), 0);
  const pyramid = calcPyramidBreakdown(ingredients, materials);

    // ─── Exchange Solvent Calculation ───────────────────────────
  // For each solvent ingredient (material with treatAsSolvent), calculate how much
  // of that solvent is already contributed by dilutions of other ingredients.
  const exchangeSolvent = (() => {
    // Find all ingredients that ARE solvents (their material has treatAsSolvent=true)
    const solventIngredients = ingredients.filter((ing: any) => {
      if (!ing.materialId) return false;
      const mat = materials.find((m: any) => m.id === ing.materialId);
      return mat?.treatAsSolvent === true;
    });
    if (solventIngredients.length === 0) return [];

    // For each solvent ingredient, find how much of that solvent comes from dilutions
    const result: { solventName: string; solventMaterialId: string; weighedGrams: number; contributedBySolvent: number; adjustedGrams: number }[] = [];

    for (const solventIng of solventIngredients) {
      const solventMat = materials.find((m: any) => m.id === solventIng.materialId);
      const solventName = solventMat?.name || "Unknown";
      const weighedGrams = parseFloat(solventIng.gramsAsWeighed || "0");

      // Sum solvent contributed by dilutions of other ingredients
      let contributedBySolvent = 0;
      for (const ing of ingredients) {
        if (ing.id === solventIng.id) continue; // skip the solvent itself
        if (!ing.dilutionId) continue; // only diluted ingredients contribute solvent
        const dil = dilutions.find((d: any) => d.id === ing.dilutionId);
        if (!dil) continue;
        // Check if this dilution's solvent matches our solvent material
        const dilSolventMatches = dil.solventMaterialId === solventIng.materialId;
        // Fallback: match by name if solventMaterialId is not set
        const dilSolventNameMatches = !dil.solventMaterialId && dil.solventName && (() => { const etoh = ["etoh","ethanol","alcohol","perfumers alcohol"]; const dpg = ["dpg","dipropylene glycol"]; const ipm = ["ipm","isopropyl myristate"]; const sn = solventName.toLowerCase(); const dn = dil.solventName.toLowerCase(); if (sn.includes(dn) || dn.includes(sn)) return true; for (const group of [etoh, dpg, ipm]) { if (group.some(a => sn.includes(a)) && group.some(a => dn.includes(a))) return true; } return false; })();
        if (!dilSolventMatches && !dilSolventNameMatches) continue;
        // Solvent contributed = weighed grams * (1 - dilutionPercent/100)
        const dilPercent = parseFloat(dil.dilutionPercent || "0");
        const ingWeighed = parseFloat(ing.gramsAsWeighed || "0");
        contributedBySolvent += ingWeighed * (1 - dilPercent / 100);
      }

      result.push({
        solventName,
        solventMaterialId: solventIng.materialId,
        weighedGrams,
        contributedBySolvent: Math.round(contributedBySolvent * 1000) / 1000,
        adjustedGrams: Math.round(Math.max(0, weighedGrams - contributedBySolvent) * 1000) / 1000,
      });
    }
    return result;
  })();

  const warnings: string[] = [];
  if (Math.abs(totalPercent - 100) > 2 && ingredients.length > 0) {
    warnings.push(`Total is ${fmtNum(totalPercent)}% (not ~100%)`);
  }

  const catName = categories.find((c: any) => c.id === formula.categoryId)?.name;
  const [catOpen, setCatOpen] = useState(false);
  const [newCatInline, setNewCatInline] = useState(false);
  const [newCatInlineName, setNewCatInlineName] = useState("");

  const updateCategoryMut = useMutation({
    mutationFn: (categoryId: string | null) => patchJson(`/api/formulas/${formula.id}`, { categoryId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/formulas"] });
      setCatOpen(false);
    },
  });

  const createCatInlineMut = useMutation({
    mutationFn: (data: any) => postJson("/api/formula-categories", data),
    onSuccess: (newCat: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/formula-categories"] });
      updateCategoryMut.mutate(newCat.id);
      setNewCatInline(false);
      setNewCatInlineName("");
    },
  });

  const dupMutation = useMutation({
    mutationFn: ({ id, name }: any) => postJson(`/api/formulas/${id}/duplicate`, { name }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/formulas"] }); setShowDupDialog(false); toast({ title: "Formula duplicated" }); },
  });


    const renameMut = useMutation({
          mutationFn: (name: string) => patchJson(`/api/formulas/${formula.id}`, { name }),
          onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/formulas"] }); setEditingName(false); toast({ title: "Formula renamed" }); },
        });
  const saveNotesMut = useMutation({
    mutationFn: (notes: string) => patchJson(`/api/formulas/${formula.id}`, { formulaNotes: notes || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/formulas"] });
      setEditingNotes(false);
      toast({ title: "Notes saved" });
    },
  });

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-start justify-between mb-4">
        <div>
                    {editingName ? (<input ref={nameInputRef} className="text-xl font-semibold bg-transparent border-b-2 border-[hsl(183,70%,50%)] outline-none w-full" value={nameValue} onChange={e => setNameValue(e.target.value)} onBlur={() => { const t = nameValue.trim(); if (t && t !== formula.name) renameMut.mutate(t); else setEditingName(false); }} onKeyDown={e => { if (e.key === "Enter") { e.currentTarget.blur(); } if (e.key === "Escape") { setNameValue(formula.name); setEditingName(false); } }} autoFocus />) : (<h1 className="text-xl font-semibold cursor-pointer hover:text-[hsl(183,70%,50%)] transition-colors group" data-testid="text-formula-name" onClick={() => setEditingName(true)} title="Click to rename">{formula.name} <Pencil size={14} className="inline ml-1 opacity-0 group-hover:opacity-100 transition-opacity" /></h1>)}
          {/* Category dropdown label */}
          <Popover open={catOpen} onOpenChange={(v) => { setCatOpen(v); if (!v) { setNewCatInline(false); setNewCatInlineName(""); } }}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1 mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="button-formula-category">
                <span>Category: <span className="font-medium text-foreground">{catName || "Uncategorized"}</span></span>
                <ChevronDown size={12} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-1" align="start">
              <div className="max-h-52 overflow-y-auto">
                <button
                  className={`w-full text-left px-3 py-1.5 text-xs rounded hover:bg-secondary transition-colors ${!formula.categoryId ? 'text-[hsl(183,70%,50%)] font-medium' : 'text-foreground'}`}
                  onClick={() => updateCategoryMut.mutate(null)}
                >
                  Uncategorized
                </button>
                {categories.map((c: any) => (
                  <button
                    key={c.id}
                    className={`w-full text-left px-3 py-1.5 text-xs rounded hover:bg-secondary transition-colors ${formula.categoryId === c.id ? 'text-[hsl(183,70%,50%)] font-medium' : 'text-foreground'}`}
                    onClick={() => updateCategoryMut.mutate(c.id)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              <div className="border-t border-border mt-1 pt-1">
                {newCatInline ? (
                  <div className="flex gap-1 px-2 pb-1">
                    <Input
                      value={newCatInlineName}
                      onChange={e => setNewCatInlineName(e.target.value)}
                      placeholder="New category"
                      className="h-6 text-[11px] flex-1 px-1.5"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === "Enter" && newCatInlineName.trim()) createCatInlineMut.mutate({ name: newCatInlineName.trim(), sortOrder: categories.length });
                        if (e.key === "Escape") { setNewCatInline(false); setNewCatInlineName(""); }
                      }}
                    />
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] px-1.5" disabled={!newCatInlineName.trim() || createCatInlineMut.isPending}
                      onClick={() => createCatInlineMut.mutate({ name: newCatInlineName.trim(), sortOrder: categories.length })}>
                      Save
                    </Button>
                  </div>
                ) : (
                  <button className="w-full text-left px-3 py-1.5 text-xs text-[hsl(183,70%,50%)] hover:bg-secondary rounded transition-colors" onClick={() => setNewCatInline(true)}>
                    + New category
                  </button>
                )}
              </div>
            </PopoverContent>
          </Popover>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">v{formula.version || 1}</Badge>
            <Badge variant={formula.status === "final" ? "default" : "secondary"}>{formula.status}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowScale(true)} data-testid="button-scale">
            <Scale size={14} className="mr-1" /> Scale
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowDupDialog(true)} data-testid="button-duplicate">
            <Copy size={14} className="mr-1" /> Duplicate
          </Button>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="mb-4 space-y-1">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-orange-400 bg-orange-900/20 rounded px-3 py-1.5">
              <AlertTriangle size={12} /> {w}
            </div>
          ))}
        </div>
      )}

      {/* Ingredient table */}
      <IngredientTable
        formulaId={formula.id}
        enriched={enriched}
        ingredients={ingredients}
        materials={materials}
        dilutions={dilutions}
        allFormulas={allFormulas}
        totalWeighed={totalWeighed}
        totalNeat={totalNeat}
        totalPercent={totalPercent}
        onAddClick={() => setShowAddIngredient(true)}         onMaterialClick={onMaterialClick}
      />

      {/* Pyramid */}
      <div className="mb-6">
        <div className="bg-card rounded-lg border border-border p-4">
          <h3 className="text-xs font-semibold text-muted-foreground mb-3">Fragrance Pyramid</h3>
          {Object.entries(pyramid).map(([role, pct]) => (
            <div key={role} className="flex items-center gap-2 mb-1.5">
              <span className="text-xs w-14 capitalize text-muted-foreground">{role}</span>
              <div className="flex-1 bg-secondary rounded-full h-2 overflow-hidden">
                <div className="h-full bg-[hsl(183,70%,36%)] rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs w-8 text-right font-mono">{pct}%</span>
            </div>
          ))}
        </div>
      </div>

          {/* Exchange Solvent */}
    {exchangeSolvent.length > 0 && (
      <div className="mb-6">
        <div className="bg-card rounded-lg border border-border p-4">
          <h3 className="text-xs font-semibold text-muted-foreground mb-3">Exchange Solvent</h3>
          <p className="text-[10px] text-muted-foreground mb-3">Solvent already contributed by dilutions of other ingredients. "You need to add" = your weighed amount minus what dilutions already bring.</p>
          {exchangeSolvent.map((es: any) => (
            <div key={es.solventMaterialId} className="mb-3 last:mb-0">
              <div className="text-sm font-medium mb-1.5">{es.solventName}</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Weighed: </span>
                  <span className="font-mono">{fmtGrams(es.weighedGrams)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">From dilutions: </span>
                  <span className="font-mono text-[hsl(183,70%,50%)]">{fmtGrams(es.contributedBySolvent)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">You need to add: </span>
                  <span className="font-mono font-semibold">{fmtGrams(es.adjustedGrams)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
      {/* Notes (editable) */}
      <div className="bg-card rounded-lg border border-border p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-muted-foreground">Notes</h3>
          {!editingNotes && (
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingNotes(true)}>
              <Pencil size={11} className="mr-1" /> Edit
            </Button>
          )}
        </div>
        {editingNotes ? (
          <div className="space-y-2">
            <Textarea
              value={notesText}
              onChange={e => setNotesText(e.target.value)}
              placeholder="Working notes, observations, ideas..."
              rows={5}
              className="text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" disabled={saveNotesMut.isPending} onClick={() => saveNotesMut.mutate(notesText)}>
                {saveNotesMut.isPending ? "Saving..." : "Save"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setNotesText(formula.formulaNotes || ""); setEditingNotes(false); }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap">
            {formula.formulaNotes || <span className="text-muted-foreground">No notes yet. Click Edit to add working notes.</span>}
          </p>
        )}
      </div>

      {/* Dialogs */}
      <ScaleDialog open={showScale} onOpenChange={setShowScale} formula={formula} ingredients={ingredients} materials={materials} dilutions={dilutions} allFormulas={allFormulas} />
      <DuplicateDialog open={showDupDialog} onOpenChange={setShowDupDialog} formula={formula} onDuplicate={(name: string) => dupMutation.mutate({ id: formula.id, name })} />
      <AddIngredientDialog open={showAddIngredient} onOpenChange={setShowAddIngredient} formulaId={formula.id} materials={materials} allFormulas={allFormulas.filter((f: any) => f.id !== formula.id)} />
    </div>
  );
}

// ─── Ingredient Table (main working surface) ────────────────────
function IngredientTable({ formulaId, enriched, ingredients, materials, dilutions, allFormulas, totalWeighed, totalNeat, totalPercent, onAddClick, onMaterialClick }: any) {
  const { toast } = useToast();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; ing: any } | null>(null);
  const [changeMatDialog, setChangeMatDialog] = useState(null);
  const [editingGrams, setEditingGrams] = useState<string | null>(null);
  const [gramsValue, setGramsValue] = useState("");
  const [changingDilution, setChangingDilution] = useState<string | null>(null);

  // Close context menu on click outside
  useEffect(() => {
    const handler = () => setContextMenu(null);
    if (contextMenu) window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [contextMenu]);

  const updateIngMut = useMutation({
    mutationFn: ({ id, data }: any) => patchJson(`/api/formula-ingredients/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/formulas", formulaId, "ingredients"] }); },
  });

  const deleteIngMut = useMutation({
    mutationFn: (id: string) => deleteJson(`/api/formula-ingredients/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/formulas", formulaId, "ingredients"] }); },
  });

  function getIngredientName(ing: any) {
    if (ing.materialId) return materials.find((m: any) => m.id === ing.materialId)?.name || "Unknown";
    if (ing.sourceFormulaId) return allFormulas.find((f: any) => f.id === ing.sourceFormulaId)?.name || "Formula";
    if (ing.dilutionId) return dilutions.find((d: any) => d.id === ing.dilutionId)?.name || "Dilution";
    return "Unknown";
  }

  function getMaterialDilutions(ing: any) {
    if (!ing.materialId) return [];
    return dilutions.filter((d: any) => d.sourceMaterialId === ing.materialId);
  }

  function getIngredientDilutionLabel(ing: any) {
    if (ing.dilutionId) {
      const dil = dilutions.find((d: any) => d.id === ing.dilutionId);
      return dil ? `${fmtNum(dil.dilutionPercent)}%` : "?";
    }
    if (ing.sourceType === "material") return "100%";
    return "—";
  }

  function handleGramsSave(ingId: string) {
    const g = parseEuroInput(gramsValue);
    if (isNaN(g) || g < 0) return;
    const ing = ingredients.find((i: any) => i.id === ingId);
    let neatMult = 1;
    if (ing?.dilutionId) {
      const dil = dilutions.find((d: any) => d.id === ing.dilutionId);
      neatMult = parseFloat(dil?.neatMultiplier || "1");
    }
    updateIngMut.mutate({
      id: ingId,
      data: { gramsAsWeighed: String(g), neatGrams: String(g * neatMult) }
    });
    setEditingGrams(null);
  }

  function handleDilutionChange(ingId: string, dilutionId: string | null) {
    const ing = ingredients.find((i: any) => i.id === ingId);
    if (!ing) return;
    const g = parseFloat(ing.gramsAsWeighed || "0");
    let neatMult = 1;
    let sourceType = "material";
    if (dilutionId) {
      const dil = dilutions.find((d: any) => d.id === dilutionId);
      neatMult = parseFloat(dil?.neatMultiplier || "1");
      sourceType = "material"; // stays material, just with dilution
    }
    updateIngMut.mutate({
      id: ingId,
      data: {
        dilutionId: dilutionId || null,
        neatGrams: String(g * neatMult),
        sourceType,
      }
    });
    setChangingDilution(null);
  }

  function handleHighlight(ingId: string, type: string) {
    updateIngMut.mutate({ id: ingId, data: { highlightType: type } });
    setContextMenu(null);
  }

  function handleRemoveAllHighlights() {
    for (const ing of ingredients) {
      if (ing.highlightType && ing.highlightType !== "none") {
        updateIngMut.mutate({ id: ing.id, data: { highlightType: "none" } });
      }
    }
    setContextMenu(null);
  }

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden mb-6 relative">
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
          {enriched.map((ing: any) => {
            const hlClass = ing.highlightType === "too_strong" ? "highlight-too-strong" :
              ing.highlightType === "too_weak" ? "highlight-too-weak" :
              ing.highlightType === "alternative" ? "highlight-alternative" : "";
            const matDilutions = getMaterialDilutions(ing);

            return (
              <tr key={ing.id} className={`border-b border-border/50 hover:bg-secondary/30 ${hlClass}`}>
                <td className="p-2 pl-3">
                  <span
                    className={`cursor-pointer hover:underline ${ing.dilutionId ? "text-[hsl(183,70%,50%)]" : ""}`} onClick={() => ing.materialId && onMaterialClick?.(ing.materialId)}
                    onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, ing }); }}
                  >
                    {getIngredientName(ing)}
                  </span>
                  {ing.sourceType === "formula" && <Badge variant="outline" className="ml-1 text-[9px]">accord</Badge>}
                </td>

                {/* Dilution cell — clickable to change */}
                <td className="text-center p-2">
                  {changingDilution === ing.id && ing.materialId ? (
                    <select
                      className="bg-secondary text-xs rounded px-1 py-0.5 border border-border text-foreground w-full"
                      autoFocus
                      value={ing.dilutionId || "__pure__"}
                      onChange={(e) => handleDilutionChange(ing.id, e.target.value === "__pure__" ? null : e.target.value)}
                      onBlur={() => setChangingDilution(null)}
                    >
                      <option value="__pure__">100% (pure)</option>
                      {matDilutions.map((d: any) => (
                        <option key={d.id} value={d.id}>{fmtNum(d.dilutionPercent)}%{d.solventName ? ` in ${d.solventName}` : ''}</option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className={`text-muted-foreground text-xs ${ing.materialId && matDilutions.length > 0 ? 'cursor-pointer hover:text-foreground underline decoration-dotted' : ''}`}
                      onClick={() => ing.materialId && matDilutions.length > 0 && setChangingDilution(ing.id)}
                    >
                      {getIngredientDilutionLabel(ing)}
                    </span>
                  )}
                </td>

                {/* Weighed grams — click to edit inline */}
                <td className="text-right p-2">
                  {editingGrams === ing.id ? (
                    <input
                      className="bg-secondary text-xs rounded px-1 py-0.5 border border-border text-right font-mono w-20 text-foreground"
                      type="text"
                      inputMode="decimal"
                      autoFocus
                      ref={el => { if (el && !el.dataset.selected) { el.dataset.selected = "1"; el.select(); } }}
                      value={gramsValue}
                                    onChange={e => setGramsValue(e.target.value)}              
                      onBlur={() => handleGramsSave(ing.id)}
                      onKeyDown={e => { if (e.key === "Enter") handleGramsSave(ing.id); if (e.key === "Escape") setEditingGrams(null); }}
                    />
                  ) : (
                    <span
                      className="font-mono text-xs cursor-pointer hover:text-[hsl(183,70%,50%)] hover:underline decoration-dotted"
                      onClick={() => { setEditingGrams(ing.id); setGramsValue(parseFloat(ing.gramsAsWeighed || "0").toFixed(3).replace(".", ",")); }}
                    >
                      {fmtGrams(ing.gramsAsWeighed)}
                    </span>
                  )}
                </td>

                <td className="text-right p-2 font-mono text-xs">{fmtGrams(ing.neatGrams || ing.gramsAsWeighed)}</td>
                <td className="text-right p-2 pr-3 font-mono text-xs">{fmtPercent(ing.percentInFormula)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="text-[hsl(183,70%,50%)] font-medium">
            <td className="p-2 pl-3">Total</td>
            <td></td>
            <td className="text-right p-2 font-mono text-xs">{fmtGrams(totalWeighed)}</td>
            <td className="text-right p-2 font-mono text-xs">{fmtGrams(totalNeat)}</td>
            <td className="text-right p-2 pr-3 font-mono text-xs">{fmtPercent(totalPercent)}</td>
          </tr>
        </tfoot>
      </table>
      <div className="border-t border-border p-2 pl-3">
        <button className="text-xs text-muted-foreground hover:text-foreground" onClick={onAddClick} data-testid="button-add-ingredient">
          + Add ingredient
        </button>
      </div>

      {/* Context Menu */}
      {changeMatDialog && (
        <ChangeRawMaterialDialog
          ing={changeMatDialog}
          materials={materials}
          allFormulas={allFormulas}
          formulaId={formulaId}
          onClose={() => setChangeMatDialog(null)}
        />
      )}

      {contextMenu && (
        <div
          className="fixed bg-popover border border-border rounded-lg shadow-lg py-1 z-50 min-w-[200px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          <ContextMenuItem label="Change dilution" onClick={() => { setChangingDilution(contextMenu.ing.id); setContextMenu(null); }} disabled={!contextMenu.ing.materialId} />
              <ContextMenuItem label="Change raw material" onClick={() => { setChangeMatDialog(contextMenu.ing); setContextMenu(null); }} />
          <div className="h-px bg-border my-1" />
          <ContextMenuItem label="Highlight as too strong" onClick={() => handleHighlight(contextMenu.ing.id, "too_strong")} />
          <ContextMenuItem label="Highlight as too weak" onClick={() => handleHighlight(contextMenu.ing.id, "too_weak")} />
          <ContextMenuItem label="Highlight (alternative)" onClick={() => handleHighlight(contextMenu.ing.id, "alternative")} />
          <ContextMenuItem label="Remove highlight" onClick={() => handleHighlight(contextMenu.ing.id, "none")} />
          <ContextMenuItem label="Remove all highlights" onClick={handleRemoveAllHighlights} />
          <div className="h-px bg-border my-1" />
          <ContextMenuItem label="Delete formula entry" onClick={() => { deleteIngMut.mutate(contextMenu.ing.id); setContextMenu(null); }} destructive />
        </div>
      )}
    </div>
  );
}

function ContextMenuItem({ label, onClick, disabled, destructive }: { label: string; onClick: () => void; disabled?: boolean; destructive?: boolean }) {
  return (
    <button
      className={`block w-full text-left px-3 py-1.5 text-xs transition-colors
        ${disabled ? 'text-muted-foreground/50 cursor-not-allowed' : destructive ? 'text-destructive hover:bg-destructive/10' : 'text-foreground hover:bg-secondary'}`}
      onClick={disabled ? undefined : onClick}
    >
      {label}
    </button>
  );
}

// ─── Add Ingredient Dialog (simplified: material or formula) ────

function ChangeRawMaterialDialog({ ing, materials, allFormulas, formulaId, onClose }) {
  const [sourceType, setSourceType] = useState(ing.sourceType || "material");
  const [sourceId, setSourceId] = useState("");
  const [search, setSearch] = useState("");
  const mutation = useMutation({
    mutationFn: ({ id, data }) => patchJson(`/api/formula-ingredients/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/formulas", formulaId, "ingredients"] }); onClose(); },
  });
  function handleSave() {
    if (!sourceId) return;
    mutation.mutate({ id: ing.id, data: { sourceType, materialId: sourceType === "material" ? sourceId : null, sourceFormulaId: sourceType === "formula" ? sourceId : null, dilutionId: null } });
  }
    const { data: families = [] } = useQuery({ queryKey: ["/api/olfactive-families"] });
  const options = sourceType === "material" ? materials : allFormulas;
    const grouped = useMemo(() => {
    const q = search.toLowerCase();
    const list = options.filter((o: any) => o.name.toLowerCase().includes(q));
    if (sourceType !== "material") return [{ label: "Formulas", items: list }];
    const byFamily: Record<string, any[]> = {};
    for (const mat of list) {
      const fam = families.find((f: any) => f.id === mat.familyId);
      const label = fam?.name || "Other";
      if (!byFamily[label]) byFamily[label] = [];
      byFamily[label].push(mat);
    }
    return Object.entries(byFamily).sort(([a], [b]) => a.localeCompare(b)).map(([label, items]) => ({ label, items }));
  }, [options, families, search, sourceType]);
  return (
    <Dialog open={true} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-card border-border">
        <DialogHeader><DialogTitle>Change Raw Material</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Select value={sourceType} onValueChange={v => { setSourceType(v); setSourceId(""); setSearch(""); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="material">Raw Material</SelectItem>
              <SelectItem value="formula">Formula / Accord</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="h-7 text-xs" autoFocus />
          <div className="max-h-52 overflow-y-auto border border-border rounded">
                          {grouped.length === 0 && <p className="text-xs text-muted-foreground px-3 py-2">No results</p>}
              {grouped.map(({ label, items }) => (
                <div key={label}>
                  <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide bg-secondary/50 sticky top-0">{label}</div>
                  {items.map((o: any) => (
                    <button key={o.id} className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-secondary transition-colors ${sourceId === o.id ? "bg-secondary font-medium" : "text-foreground"}`} onClick={() => setSourceId(o.id)}>{o.name}</button>
                  ))}
                </div>
              ))}
          </div>
          <Button className="w-full" disabled={!sourceId || mutation.isPending} onClick={handleSave}>
            {mutation.isPending ? "Saving..." : "Change material"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddIngredientDialog({ open, onOpenChange, formulaId, materials, allFormulas }: any) {
  const { toast } = useToast();
  const [sourceType, setSourceType] = useState("material");
  const [sourceId, setSourceId] = useState("");   const [search, setSearch] = useState("");    const mutation = useMutation({
    mutationFn: (data: any) => postJson("/api/formula-ingredients", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/formulas", formulaId, "ingredients"] });
      onOpenChange(false);
      setSourceId("");
      toast({ title: "Ingredient added" });
    },
  });

  const options = sourceType === "material" ? materials : allFormulas;
    const { data: families = [] } = useQuery({ queryKey: ["/api/olfactive-families"] });
    const grouped = useMemo(() => {
    const q = search.toLowerCase();
    const list = options.filter((o: any) => o.name.toLowerCase().includes(q));
    if (sourceType !== "material") return [{ label: "Formulas", items: list }];
    const byFamily: Record<string, any[]> = {};
    for (const mat of list) {
      const fam = families.find((f: any) => f.id === mat.familyId);
      const label = fam?.name || "Other";
      if (!byFamily[label]) byFamily[label] = [];
      byFamily[label].push(mat);
    }
    return Object.entries(byFamily).sort(([a], [b]) => a.localeCompare(b)).map(([label, items]) => ({ label, items }));
    }, [options, families, search, sourceType]);
    function handleAdd() {
    mutation.mutate({
      formulaId,
      sourceType,
      materialId: sourceType === "material" ? sourceId : null,
      dilutionId: null,
      sourceFormulaId: sourceType === "formula" ? sourceId : null,
      gramsAsWeighed: "0",
      neatGrams: "0",
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader><DialogTitle>Add Ingredient</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Select value={sourceType} onValueChange={v => { setSourceType(v); setSourceId(""); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="material">Raw Material</SelectItem>
              <SelectItem value="formula">Formula / Accord</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="h-7 text-xs" /><div className="max-h-52 overflow-y-auto border border-border rounded">
              {grouped.length === 0 && <p className="text-xs text-muted-foreground px-3 py-2">No results</p>}
              {grouped.map(({ label, items }) => (
                <div key={label}>
                  <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide bg-secondary/50 sticky top-0">{label}</div>
                  {items.map((o: any) => (
                    <button key={o.id} className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-secondary transition-colors ${sourceId === o.id ? "bg-secondary font-medium" : "text-foreground"}`} onClick={() => setSourceId(o.id)}>{o.name}</button>
                  ))}
                </div>
              ))}
            </div>        
          <p className="text-[10px] text-muted-foreground">Dilution and grams can be set in the formula table after adding.</p>
          <Button className="w-full" disabled={!sourceId || mutation.isPending} onClick={handleAdd} data-testid="button-add-ingredient-confirm">
            Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Formula Dialog (no productType, with inline category creation) ──
function CreateFormulaDialog({ open, onOpenChange, categories, onCreated }: any) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [catId, setCatId] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  const mutation = useMutation({
    mutationFn: (data: any) => postJson("/api/formulas", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/formulas"] });
      onOpenChange(false);
      setName(""); setCatId("");
      toast({ title: "Formula created" });     onCreated?.(newFormula.id);
    },
  });

  const createCatMut = useMutation({
    mutationFn: (data: any) => postJson("/api/formula-categories", data),
    onSuccess: (newCat: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/formula-categories"] });
      setCatId(newCat.id);
      setShowNewCat(false);
      setNewCatName("");
      toast({ title: "Category created" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader><DialogTitle>New Formula</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Name" value={name} onChange={e => setName(e.target.value)} data-testid="input-formula-name" />

          {!showNewCat ? (
            <div className="space-y-1">
              <Select value={catId} onValueChange={setCatId}>
                <SelectTrigger><SelectValue placeholder="Category (optional)" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <button className="text-[10px] text-[hsl(183,70%,50%)] hover:underline" onClick={() => setShowNewCat(true)}>
                + Create new category
              </button>
            </div>
          ) : (
            <div className="flex gap-2 items-end">
              <Input placeholder="New category name" value={newCatName} onChange={e => setNewCatName(e.target.value)} className="h-8 text-xs flex-1" autoFocus />
              <Button size="sm" disabled={!newCatName || createCatMut.isPending} onClick={() => createCatMut.mutate({ name: newCatName, sortOrder: categories.length })}>
                Create
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowNewCat(false)}>Cancel</Button>
            </div>
          )}

          <Button className="w-full" disabled={!name || mutation.isPending}
            onClick={() => mutation.mutate({ name, categoryId: catId || null, productType: null })}
            data-testid="button-create-formula"
          >
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Scale Dialog (all 4 methods in one panel) ─────────────────
function ScaleDialog({ open, onOpenChange, formula, ingredients, materials, dilutions, allFormulas }: any) {
  const { toast } = useToast();
  const [totalWeightVal, setTotalWeightVal] = useState("");
  const [factorVal, setFactorVal] = useState("");
  const [absPercentVal, setAbsPercentVal] = useState("");
  const [percentFactorVal, setPercentFactorVal] = useState("");

  // Reset when dialog opens
  useEffect(() => {
    if (open) { setTotalWeightVal(""); setFactorVal(""); setAbsPercentVal(""); setPercentFactorVal(""); }
  }, [open]);

  const currentTotal = ingredients.reduce((s: number, i: any) => s + parseFloat(i.gramsAsWeighed || "0"), 0);
  const currentConcentration = parseFloat(formula.intendedConcentrationPercent || "0");
  const maxPercentFactor = currentConcentration > 0 ? (100 / currentConcentration) : 1;

  // Determine which method is active (last typed into)
  type ScaleMethod = "total_weight" | "factor" | "abs_percent" | "pct_factor" | null;
  let activeMethod: ScaleMethod = null;
  let preview: any[] = [];

  // Only one method produces a preview at a time. We check in priority order of the most recently filled.
  // Better approach: whichever field is non-empty and last changed wins.
  // For simplicity: check each, last non-empty one wins.
  if (totalWeightVal) { activeMethod = "total_weight"; }
  if (factorVal) { activeMethod = "factor"; }
  if (absPercentVal) { activeMethod = "abs_percent"; }
  if (percentFactorVal) { activeMethod = "pct_factor"; }

  if (activeMethod === "total_weight") {
    const v = parseEuroInput(totalWeightVal);
    if (!isNaN(v) && v > 0) preview = scaleToTotalWeight(ingredients, v);
  } else if (activeMethod === "factor") {
    const v = parseEuroInput(factorVal);
    if (!isNaN(v) && v > 0) preview = scaleByFactor(ingredients, v);
  } else if (activeMethod === "abs_percent") {
    const v = parseEuroInput(absPercentVal);
    if (!isNaN(v) && v > 0 && currentConcentration > 0) {
      const ratio = v / currentConcentration;
      preview = scaleByFactor(ingredients, ratio);
    }
  } else if (activeMethod === "pct_factor") {
    const v = parseEuroInput(percentFactorVal);
    if (!isNaN(v) && v > 0 && currentConcentration > 0) {
      preview = scaleByFactor(ingredients, v);
    }
  }

  function clearOthers(except: ScaleMethod) {
    if (except !== "total_weight") setTotalWeightVal("");
    if (except !== "factor") setFactorVal("");
    if (except !== "abs_percent") setAbsPercentVal("");
    if (except !== "pct_factor") setPercentFactorVal("");
  }

  function getIngredientName(ing: any) {
    if (ing.materialId) return materials?.find((m: any) => m.id === ing.materialId)?.name || "Unknown";
    if (ing.sourceFormulaId) return allFormulas?.find((f: any) => f.id === ing.sourceFormulaId)?.name || "Formula";
    if (ing.dilutionId) return dilutions?.find((d: any) => d.id === ing.dilutionId)?.name || "Dilution";
    return "Unknown";
  }

  const applyMut = useMutation({
    mutationFn: async (scaledIngs: any[]) => {
      for (const ing of scaledIngs) {
        await patchJson(`/api/formula-ingredients/${ing.id}`, {
          gramsAsWeighed: ing.gramsAsWeighed,
          neatGrams: ing.neatGrams,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/formulas", formula.id, "ingredients"] });
      onOpenChange(false);
      toast({ title: "Scaling applied" });
    },
  });

  function InfoTip({ text }: { text: string }) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info size={14} className="text-muted-foreground cursor-help inline-block ml-1.5 shrink-0" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-64 text-xs">
            {text}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto p-0">
        <div className="sticky top-0 bg-card z-10 px-6 pt-6 pb-3 border-b border-border">
          <DialogHeader><DialogTitle>Scale Formula</DialogTitle></DialogHeader>
        </div>

        <div className="px-6 pb-6 space-y-0">
          {/* 1. Scale to total weight */}
          <div className="py-4 border-b border-border/60">
            <h3 className="text-sm font-semibold flex items-center">
              Scale formula to total weight
              <InfoTip text="Scales all ingredient weights proportionally to reach the target total batch weight" />
            </h3>
            <div className="mt-3 space-y-2">
              <div className="flex items-center">
                <span className="text-xs text-muted-foreground w-36">Current weight</span>
                <span className="text-xs font-mono">{fmtGrams(currentTotal)}</span>
              </div>
              <div className="flex items-center">
                <span className="text-xs text-muted-foreground w-36">New weight</span>
                <input
                  type="text" inputMode="decimal"
                  className="bg-secondary text-sm rounded px-2 py-1 border border-border font-mono w-40 text-foreground placeholder:text-muted-foreground/50"
                  placeholder="Type to scale"
                  value={totalWeightVal}
                  onFocus={() => clearOthers("total_weight")}
                  onChange={e => { clearOthers("total_weight"); setTotalWeightVal(e.target.value.replace(/[^0-9.,\-]/g, "")); }}
                  data-testid="input-scale-total-weight"
                />
              </div>
            </div>
            {activeMethod === "total_weight" && preview.length > 0 && <ScalePreviewTable preview={preview} getIngredientName={getIngredientName} />}
          </div>

          {/* 2. Scale by scaling factor */}
          <div className="py-4 border-b border-border/60">
            <h3 className="text-sm font-semibold flex items-center">
              Scale formula weight by scaling factor
              <InfoTip text="Multiplies all ingredient weights by the given factor" />
            </h3>
            <div className="mt-3">
              <div className="flex items-center">
                <span className="text-xs text-muted-foreground w-36">Scaling factor</span>
                <input
                  type="text" inputMode="decimal"
                  className="bg-secondary text-sm rounded px-2 py-1 border border-border font-mono w-40 text-foreground placeholder:text-muted-foreground/50"
                  placeholder="Type to scale"
                  value={factorVal}
                  onFocus={() => clearOthers("factor")}
                  onChange={e => { clearOthers("factor"); setFactorVal(e.target.value.replace(/[^0-9.,\-]/g, "")); }}
                  data-testid="input-scale-factor"
                />
              </div>
            </div>
            {activeMethod === "factor" && preview.length > 0 && <ScalePreviewTable preview={preview} getIngredientName={getIngredientName} />}
          </div>

          {/* 3. Scale to absolute percentage */}
          <div className="py-4 border-b border-border/60">
            <h3 className="text-sm font-semibold flex items-center">
              Scale formula to absolute percentage
              <InfoTip text="Adjusts ingredient weights so the formula reaches the target concentration" />
            </h3>
            <div className="mt-3 space-y-2">
              <div className="flex items-center">
                <span className="text-xs text-muted-foreground w-36">Can scale up to</span>
                <span className="text-xs font-mono">{currentConcentration > 0 ? fmtPercent(100) : <span className="text-muted-foreground">Solvent required</span>}</span>
              </div>
              <div className="flex items-center">
                <span className="text-xs text-muted-foreground w-36">Current percentage</span>
                <span className="text-xs font-mono">{currentConcentration > 0 ? fmtPercent(currentConcentration) : <span className="text-muted-foreground">Not set</span>}</span>
              </div>
              <div className="flex items-center">
                <span className="text-xs text-muted-foreground w-36">New percentage</span>
                <input
                  type="text" inputMode="decimal"
                  className="bg-secondary text-sm rounded px-2 py-1 border border-border font-mono w-40 text-foreground placeholder:text-muted-foreground/50"
                  placeholder="Type to scale"
                  value={absPercentVal}
                  onFocus={() => clearOthers("abs_percent")}
                  onChange={e => { clearOthers("abs_percent"); setAbsPercentVal(e.target.value.replace(/[^0-9.,\-]/g, "")); }}
                  disabled={currentConcentration <= 0}
                  data-testid="input-scale-abs-percent"
                />
              </div>
            </div>
            {activeMethod === "abs_percent" && preview.length > 0 && <ScalePreviewTable preview={preview} getIngredientName={getIngredientName} />}
          </div>

          {/* 4. Scale percentage by scaling factor */}
          <div className="py-4">
            <h3 className="text-sm font-semibold flex items-center">
              Scale formula percentage by scaling factor
              <InfoTip text="Multiplies the current concentration by the given factor" />
            </h3>
            <div className="mt-3 space-y-2">
              <div className="flex items-center">
                <span className="text-xs text-muted-foreground w-36">Max scaling factor</span>
                <span className="text-xs font-mono">{currentConcentration > 0 ? `x ${fmtNum(maxPercentFactor)}` : <span className="text-muted-foreground">Not set</span>}</span>
              </div>
              <div className="flex items-center">
                <span className="text-xs text-muted-foreground w-36">Scaling factor</span>
                <input
                  type="text" inputMode="decimal"
                  className="bg-secondary text-sm rounded px-2 py-1 border border-border font-mono w-40 text-foreground placeholder:text-muted-foreground/50"
                  placeholder="Type to scale"
                  value={percentFactorVal}
                  onFocus={() => clearOthers("pct_factor")}
                  onChange={e => { clearOthers("pct_factor"); setPercentFactorVal(e.target.value.replace(/[^0-9.,\-]/g, "")); }}
                  disabled={currentConcentration <= 0}
                  data-testid="input-scale-pct-factor"
                />
              </div>
            </div>
            {activeMethod === "pct_factor" && preview.length > 0 && <ScalePreviewTable preview={preview} getIngredientName={getIngredientName} />}
          </div>

          {/* Note + Buttons */}
          <div className="border-t border-border pt-4 mt-2">
            <p className="text-[10px] text-muted-foreground mb-3">Preview only — scaling does not auto-save.</p>
            <div className="flex gap-2">
              <Button
                disabled={preview.length === 0 || applyMut.isPending}
                onClick={() => applyMut.mutate(preview)}
                data-testid="button-apply-scaling"
              >
                {applyMut.isPending ? "Applying..." : "Apply scaling"}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScalePreviewTable({ preview, getIngredientName }: { preview: any[]; getIngredientName: (ing: any) => string }) {
  return (
    <div className="bg-secondary/50 rounded p-2 mt-3 max-h-48 overflow-y-auto">
      <table className="w-full text-xs">
        <tbody>
          {preview.map((p: any, i: number) => (
            <tr key={p.id || i} className="border-b border-border/30">
              <td className="py-1 text-muted-foreground w-6">{i + 1}</td>
              <td className="py-1 truncate">{getIngredientName(p)}</td>
              <td className="py-1 text-right font-mono">{fmtGrams(p.gramsAsWeighed)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DuplicateDialog({ open, onOpenChange, formula, onDuplicate }: any) {
  const [name, setName] = useState(formula?.name ? `${formula.name} copy` : "");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader><DialogTitle>Duplicate Formula</DialogTitle></DialogHeader>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="New name" data-testid="input-duplicate-name" />
        <Button onClick={() => onDuplicate(name)} disabled={!name} data-testid="button-confirm-duplicate">Create</Button>
      </DialogContent>
    </Dialog>
  );
}

// ─── Category Manager Dialog ────────────────────────────────────
function CategoryManagerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const { data: categories = [] } = useQuery<any[]>({ queryKey: ["/api/formula-categories"] });
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const createMut = useMutation({
    mutationFn: (data: any) => postJson("/api/formula-categories", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/formula-categories"] });
      setNewName("");
      toast({ title: "Category created" });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => patchJson(`/api/formula-categories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/formula-categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/formulas"] });
      setEditId(null);
      toast({ title: "Category renamed" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteJson(`/api/formula-categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/formula-categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/formulas"] });
      toast({ title: "Category deleted — formulas moved to Uncategorized" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader><DialogTitle>Category Manager</DialogTitle></DialogHeader>
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {categories.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">No categories yet.</p>
          )}
          {categories.map((c: any) => (
            <div key={c.id} className="flex items-center gap-1.5 group/cat">
              {editId === c.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="h-7 text-xs flex-1 px-2"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === "Enter" && editName.trim()) updateMut.mutate({ id: c.id, data: { name: editName.trim() } });
                      if (e.key === "Escape") setEditId(null);
                    }}
                  />
                  <Button size="sm" variant="ghost" className="h-7 text-[10px] px-1.5"
                    disabled={!editName.trim() || updateMut.isPending}
                    onClick={() => updateMut.mutate({ id: c.id, data: { name: editName.trim() } })}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-[10px] px-1" onClick={() => setEditId(null)}>✕</Button>
                </>
              ) : (
                <>
                  <span className="text-sm flex-1 truncate">{c.name}</span>
                  <button
                    className="opacity-0 group-hover/cat:opacity-100 transition-opacity p-1 rounded hover:bg-secondary"
                    onClick={() => { setEditId(c.id); setEditName(c.name); }}
                    title="Rename"
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    className="opacity-0 group-hover/cat:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-destructive"
                    onClick={() => deleteMut.mutate(c.id)}
                    title="Delete"
                  >
                    <Trash2 size={11} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="border-t border-border pt-3 flex gap-2">
          <Input
            placeholder="New category name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="h-8 text-xs flex-1"
            onKeyDown={e => {
              if (e.key === "Enter" && newName.trim()) createMut.mutate({ name: newName.trim(), sortOrder: categories.length });
            }}
          />
          <Button size="sm" disabled={!newName.trim() || createMut.isPending}
            onClick={() => createMut.mutate({ name: newName.trim(), sortOrder: categories.length })}>
            Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


// ─── Material Card View (opened from ingredient click) ────────
function MaterialCardView({ materialId, onBack }: { materialId: string; onBack: () => void }) {
  const { data: materials = [] } = useQuery({ queryKey: ["/api/materials"] });
  const { data: families = [] } = useQuery({ queryKey: ["/api/olfactive-families"] });
  const { data: dilutions = [] } = useQuery({ queryKey: ["/api/dilutions"] });
  const mat = materials.find((m: any) => m.id === materialId);
  if (!mat) return <div className="p-6 text-muted-foreground">Loading material...</div>;
  const family = families.find((f: any) => f.id === mat.familyId);
  const matDilutions = dilutions.filter((d: any) => d.sourceMaterialId === mat.id);
  return (
    <div className="p-4 space-y-4 overflow-y-auto">
      <button onClick={onBack} className="md:hidden flex items-center gap-1 pl-14 md:pl-3 text-sm text-muted-foreground mb-2">
        <ArrowLeft size={16} /> Back
      </button>
      <button onClick={onBack} className="hidden md:flex items-center gap-1 text-sm text-muted-foreground mb-2">
        <ArrowLeft size={16} /> Back to formula
      </button>
      <h2 className="text-xl font-semibold">{mat.name}</h2>
      <div className="grid grid-cols-2 gap-3 text-sm">
        {mat.casNumber && <div><span className="text-muted-foreground">CAS:</span> {mat.casNumber}</div>}
        {family && <div><span className="text-muted-foreground">Family:</span> {family.name}</div>}
        {mat.supplier && <div><span className="text-muted-foreground">Supplier:</span> {mat.supplier}</div>}
        {mat.costPerGram && <div><span className="text-muted-foreground">Cost/g:</span> {fmtNum(mat.costPerGram)}</div>}
        {mat.inventoryGrams && <div><span className="text-muted-foreground">Inventory:</span> {fmtGrams(mat.inventoryGrams)}</div>}
        {mat.ifraMaxPercent && <div><span className="text-muted-foreground">IFRA max:</span> {fmtPercent(mat.ifraMaxPercent)}</div>}
        {mat.pyramidPlacement && <div><span className="text-muted-foreground">Pyramid:</span> {mat.pyramidPlacement}</div>}
      </div>
      {matDilutions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-1">Dilutions</h3>
          <div className="space-y-1">
            {matDilutions.map((d: any) => (
              <div key={d.id} className="text-xs text-muted-foreground">
                {fmtNum(d.dilutionPercent)}%{d.solventName ? ` in ${d.solventName}` : ""}
              </div>
            ))}
          </div>
        </div>
      )}
      {mat.description && (
        <div>
          <h3 className="text-sm font-semibold mb-1">Description</h3>
          <p className="text-sm whitespace-pre-wrap">{mat.description}</p>
        </div>
      )}
    </div>
  );
}
