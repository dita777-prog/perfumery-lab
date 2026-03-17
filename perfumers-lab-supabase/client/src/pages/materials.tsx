import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useState, useRef } from "react";
import { Plus, Pencil, Trash2, Calculator, ChevronDown, ChevronRight, Tag, Minus, CalendarIcon, Check, ChevronsUpDown, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty, CommandGroup } from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { fmtNum, fmtGrams } from "@/lib/api";
import { postJson, patchJson, deleteJson } from "@/lib/api";

// ─── Pyramid SVG Icon ───────────────────────────────────────────
// Stacked horizontal bars forming a pyramid shape, like the Formulair reference
function PyramidIcon({ size = 16, color = "currentColor", unknown = false, className = "" }: { size?: number; color?: string; unknown?: boolean; className?: string }) {
  if (unknown) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M10.5 4L3 20h18L13.5 4" stroke={color} strokeWidth="1.8" strokeLinejoin="round" fill="none" />
        <text x="12" y="17" textAnchor="middle" fontSize="10" fontWeight="600" fill={color}>?</text>
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <line x1="9" y1="7" x2="15" y2="7" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="7.5" y1="11" x2="16.5" y2="11" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="6" y1="15" x2="18" y2="15" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="4.5" y1="19" x2="19.5" y2="19" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ─── Enhanced Calendar Picker ───────────────────────────────────
// Calendar with "Jump to today", "Use selected", "Remove date" action links
function EnhancedCalendarPicker({ value, onSave, onRemove, open, onOpenChange }: {
  value: string | null;
  onSave: (dateStr: string) => void;
  onRemove: () => void;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [selected, setSelected] = useState<Date | undefined>(value ? new Date(value + "T00:00:00") : undefined);
  const [month, setMonth] = useState<Date>(value ? new Date(value + "T00:00:00") : new Date());

  // Reset internal state when popover opens
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setSelected(value ? new Date(value + "T00:00:00") : undefined);
      setMonth(value ? new Date(value + "T00:00:00") : new Date());
    }
    onOpenChange(v);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button className="flex items-center justify-between py-2.5 px-1 w-full text-left hover:bg-secondary/20 transition-colors rounded">
          <span className="text-xs text-muted-foreground w-24 shrink-0">Date obtained</span>
          <span className="text-sm">
            {value ? formatLongDate(value) : <span className="text-muted-foreground/50">—</span>}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 max-h-[80vh] overflow-y-auto" align="end">
        <Calendar mode="single"
          selected={selected}
          onSelect={(d) => { if (d) setSelected(d); }}
          month={month}
          onMonthChange={setMonth}
          className="bg-card" />
        <div className="border-t border-border/50 px-3 py-2 space-y-1">
          <button className="block w-full text-left text-sm text-[hsl(210,100%,56%)] hover:underline py-0.5"
            onClick={() => { const today = new Date(); setMonth(today); setSelected(today); }}>Jump to today</button>
          <button className="block w-full text-left text-sm text-[hsl(210,100%,56%)] hover:underline py-0.5"
            onClick={() => { if (selected) { onSave(format(selected, "yyyy-MM-dd")); onOpenChange(false); } }}>Use selected</button>
          <button className="block w-full text-left text-sm text-[hsl(0,70%,55%)] hover:underline py-0.5"
            onClick={() => { onRemove(); onOpenChange(false); }}>Remove date</button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Generic calendar picker for dilution dates etc
function EnhancedCalendarPickerGeneric({ value, onSave, onRemove, open, onOpenChange, children }: {
  value: string | null;
  onSave: (dateStr: string) => void;
  onRemove: () => void;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  const [selected, setSelected] = useState<Date | undefined>(value ? new Date(value + "T00:00:00") : undefined);
  const [month, setMonth] = useState<Date>(value ? new Date(value + "T00:00:00") : new Date());

  const handleOpenChange = (v: boolean) => {
    if (v) {
      setSelected(value ? new Date(value + "T00:00:00") : undefined);
      setMonth(value ? new Date(value + "T00:00:00") : new Date());
    }
    onOpenChange(v);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-auto p-0 max-h-[80vh] overflow-y-auto" align="start">
        <Calendar mode="single"
          selected={selected}
          onSelect={(d) => { if (d) setSelected(d); }}
          month={month}
          onMonthChange={setMonth}
          className="bg-card" />
        <div className="border-t border-border/50 px-3 py-2 space-y-1">
          <button className="block w-full text-left text-sm text-[hsl(210,100%,56%)] hover:underline py-0.5"
            onClick={() => { const today = new Date(); setMonth(today); setSelected(today); }}>Jump to today</button>
          <button className="block w-full text-left text-sm text-[hsl(210,100%,56%)] hover:underline py-0.5"
            onClick={() => { if (selected) { onSave(format(selected, "yyyy-MM-dd")); onOpenChange(false); } }}>Use selected</button>
          <button className="block w-full text-left text-sm text-[hsl(0,70%,55%)] hover:underline py-0.5"
            onClick={() => { onRemove(); onOpenChange(false); }}>Remove date</button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function MaterialsPage() {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const createMaterialMut = useMutation({
    mutationFn: () => postJson("/api/materials", { name: "New material" }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      setSelectedId(data.id);
    },
    onError: () => toast({ title: "Failed to create material", variant: "destructive" }),
  });

  const deleteMaterialMut = useMutation({
    mutationFn: (id: string) => deleteJson(`/api/materials/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      if (selectedId === deleteConfirmId) setSelectedId(null);
      setDeleteConfirmId(null);
      toast({ title: "Material deleted" });
    },
    onError: () => toast({ title: "Failed to delete material", variant: "destructive" }),
  });
  const [showCreateFamily, setShowCreateFamily] = useState(false);
  const [editFamilyId, setEditFamilyId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const { data: materials = [] } = useQuery<any[]>({ queryKey: ["/api/materials"] });
  const { data: families = [] } = useQuery<any[]>({ queryKey: ["/api/olfactive-families"] });
  const { data: sources = [] } = useQuery<any[]>({ queryKey: ["/api/material-sources"] });
  const { data: suppliers = [] } = useQuery<any[]>({ queryKey: ["/api/suppliers"] });

  const selected = materials.find((m: any) => m.id === selectedId);

  const grouped = families.map((f: any) => ({
    family: f,
    materials: materials.filter((m: any) => m.olfactiveFamilyId === f.id)
      .filter((m: any) => !filter || m.name.toLowerCase().includes(filter.toLowerCase()) || m.casNumber?.toLowerCase().includes(filter.toLowerCase()))
  })).filter(g => g.materials.length > 0);

  const ungrouped = materials.filter((m: any) => !m.olfactiveFamilyId)
    .filter((m: any) => !filter || m.name.toLowerCase().includes(filter.toLowerCase()));

  const materialSources = sources.filter((s: any) => s.materialId === selectedId);

  return (
    <div className="panel-layout h-full">
      {/* Left panel */}
            <div className={`border-r border-border flex-col h-full overflow-hidden ${selectedId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-3 pl-12 md:pl-3 border-b border-border flex items-center gap-2">
          <h2 className="text-sm font-semibold flex-1">Materials</h2>
          <Button size="sm" variant="ghost" onClick={() => setShowCreateFamily(true)} data-testid="button-add-family-sidebar" title="Add olfactive family">
            <Tag size={14} />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => createMaterialMut.mutate()} disabled={createMaterialMut.isPending} data-testid="button-add-material">
            <Plus size={14} />
          </Button>
        </div>
        <div className="px-3 py-2">
          <Input placeholder="Filter..." value={filter} onChange={e => setFilter(e.target.value)} className="h-7 text-xs" data-testid="input-filter-materials" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {grouped.map(({ family, materials: mats }) => (
            <div key={family.id}>
              {editFamilyId === family.id ? (
                <InlineEditFamily family={family} onClose={() => setEditFamilyId(null)} />
              ) : (
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-2 group/fam"
                  style={{ color: family.color || "#888" }}>
                  <span className="family-dot" style={{ backgroundColor: family.color || "#888" }} />
                  <span className="flex-1">{family.name}</span>
                  <button
                    className="opacity-0 group-hover/fam:opacity-100 transition-opacity p-0.5 rounded hover:bg-secondary/60"
                    onClick={(e) => { e.stopPropagation(); setEditFamilyId(family.id); }}
                    title="Edit family"
                  >
                    <Pencil size={10} />
                  </button>
                </div>
              )}
                          {mats.map((m: any) => (
              <MaterialListItem
                key={m.id}
                m={m}
                selectedId={selectedId}
                families={families}
                onSelect={setSelectedId}
                onDeleteRequest={setDeleteConfirmId}
              />
            ))}
            </div>
          ))}
          {ungrouped.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Uncategorized</div>
                          {ungrouped.map((m: any) => (
              <MaterialListItem
                key={m.id}
                m={m}
                selectedId={selectedId}
                families={families}
                onSelect={setSelectedId}
                onDeleteRequest={setDeleteConfirmId}
              />
            ))}
            </div>
          )}
        </div>
      </div>

      {/* Right panel */}
            <div className={`flex-1 overflow-y-auto ${selectedId ? '' : 'hidden md:block'}`}>
        {selected ? (
                  <div>
              <button className="md:hidden flex items-center gap-1 p-3 pl-12 md:pl-3 text-sm text-muted-foreground hover:text-foreground border-b border-border w-full" onClick={() => setSelectedId(null)}>
                <ChevronRight className="rotate-180 h-4 w-4" /> Back to list
              </button>
          <MaterialDetail material={selected} families={families} sources={materialSources} suppliers={suppliers} />
                                </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Select a material</div>
        )}
      </div>

      {/* Delete confirm dialog */}
            <Dialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete material</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-2">
            Are you sure you want to delete{" "}
            <span className="font-medium text-foreground">
              "{materials.find((m: any) => m.id === deleteConfirmId)?.name}"
            </span>
            ? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => { if (deleteConfirmId) deleteMaterialMut.mutate(deleteConfirmId); }}
              disabled={deleteMaterialMut.isPending}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <CreateFamilyDialog open={showCreateFamily} onOpenChange={setShowCreateFamily} familyCount={families.length} />
    </div>
  );
}

const PYRAMID_ROLES = ["top", "high", "middle", "bottom", "base", "unknown"] as const;

function formatLongDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return format(d, "MMMM do, yyyy");
  } catch { return dateStr; }
}

function MaterialDetail({ material, families, sources, suppliers }: any) {
  const { toast } = useToast();
  const family = families.find((f: any) => f.id === material.olfactiveFamilyId);
  const familyColor = family?.color || "#888";
  const { data: dilutions = [] } = useQuery<any[]>({ queryKey: ["/api/materials", material.id, "dilutions"] });
  const { data: ifraLimits = [] } = useQuery<any[]>({ queryKey: ["/api/materials", material.id, "ifra-limits"] });
  const { data: allFormulas = [] } = useQuery<any[]>({ queryKey: ["/api/formulas"] });
  const { data: allIngredients = [] } = useQuery<any[]>({ queryKey: ["/api/formula-ingredients"] });
  const { data: allDilutions = [] } = useQuery<any[]>({ queryKey: ["/api/dilutions"] });

  // Inline editing state
  const [description, setDescription] = useState(material.notesSensory || "");
  const [descDirty, setDescDirty] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const [showAddDilution, setShowAddDilution] = useState(false);
  const [editDilutionId, setEditDilutionId] = useState<string | null>(null);
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showCostCalc, setShowCostCalc] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [dateOpen, setDateOpen] = useState(false);

  // Reset on material change
  const [prevMatId, setPrevMatId] = useState(material.id);
  if (material.id !== prevMatId) {
    setPrevMatId(material.id);
    setDescription(material.notesSensory || "");
    setDescDirty(false);
    setEditField(null);
  }

  // Derived data
  const totalStock = sources.reduce((sum: number, s: any) => sum + parseFloat(s.stockGrams || "0"), 0);
  const cheapestSource = sources.reduce((best: any, s: any) => {
    const ppg = s.purchasePrice && s.purchaseQuantityGrams
      ? parseFloat(s.purchasePrice) / parseFloat(s.purchaseQuantityGrams)
      : s.pricePerGram ? parseFloat(s.pricePerGram) : null;
    if (ppg === null) return best;
    if (!best || ppg < best.ppg) return { ...s, ppg };
    return best;
  }, null as any);
  const cheapestPPG = cheapestSource?.ppg ?? null;
  const linkedSuppliers = sources
    .map((s: any) => suppliers.find((sp: any) => sp.id === s.supplierId))
    .filter(Boolean);
  const uniqueSuppliers = [...new Map(linkedSuppliers.map((s: any) => [s.id, s])).values()];
  const latestDate = sources.reduce((latest: string | null, s: any) => {
    if (!s.purchaseDate) return latest;
    return !latest || s.purchaseDate > latest ? s.purchaseDate : latest;
  }, null as string | null);
  const firstIfra = ifraLimits.length > 0 ? ifraLimits[0] : null;

  // Usage in formulas
  const usageInFormulas = allIngredients
    .filter((ing: any) => ing.materialId === material.id || (
      ing.dilutionId && dilutions.some((d: any) => d.id === ing.dilutionId)
    ))
    .map((ing: any) => {
      const formula = allFormulas.find((f: any) => f.id === ing.formulaId);
      let dilPct = "100";
      if (ing.dilutionId) {
        const dil = allDilutions.find((d: any) => d.id === ing.dilutionId);
        if (dil) dilPct = dil.dilutionPercent;
      }
      return { formulaId: ing.formulaId, formulaName: formula?.name || "Unknown", dilutionPct: dilPct, neatPct: ing.percentInFormula ? parseFloat(ing.percentInFormula) : 0 };
    })
    .sort((a: any, b: any) => b.neatPct - a.neatPct);

  // Mutations
  const updateMaterialMut = useMutation({
    mutationFn: (data: any) => patchJson(`/api/materials/${material.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/materials"] }); },
  });
  const updateSourceMut = useMutation({
    mutationFn: ({ id, data }: any) => patchJson(`/api/material-sources/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/material-sources"] }); },
  });
  const createSourceMut = useMutation({
    mutationFn: (data: any) => postJson("/api/material-sources", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/material-sources"] });
      toast({ title: "Supplier linked" });
    },
  });
  const updateDilutionMut = useMutation({
    mutationFn: ({ id, data }: any) => patchJson(`/api/dilutions/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials", material.id, "dilutions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dilutions"] });
    },
  });

  // Save helpers
  const saveDescription = () => {
    if (!descDirty) return;
    updateMaterialMut.mutate({ notesSensory: description || null });
    setDescDirty(false);
    toast({ title: "Description saved" });
  };
  const toggleSolvent = () => updateMaterialMut.mutate({ treatAsSolvent: !material.treatAsSolvent });
  const handlePyramidClick = (role: string) => updateMaterialMut.mutate({ pyramidRole: material.pyramidRole === role ? null : role });

  // Inline edit helpers
  const startEdit = (field: string, value: string) => { setEditField(field); setEditValue(value); };
  const commitEdit = () => {
    if (!editField) return;
    const val = editValue.replace(",", ".");
    if (editField === "inventory") {
      // Update the first source's stockGrams, or create a source if none
      if (sources.length > 0) {
        patchJson(`/api/material-sources/${sources[0].id}`, { stockGrams: val || null }).then(() => { queryClient.invalidateQueries({ queryKey: ["/api/material-sources"] }); }).catch((err: any) => console.error("inventory update failed", err));
         } else if (editValue) {
        postJson("/api/material-sources", { materialId: material.id, stockGrams: val }).then(() => { queryClient.invalidateQueries({ queryKey: ["/api/material-sources"] }); }).catch((err: any) => console.error("inventory create failed", err));
}
    } else if (editField === "ifra") {
      if (firstIfra) {
        patchJson(`/api/ifra-limits/${firstIfra.id}`, { limitPercent: val || null }).then(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/materials", material.id, "ifra-limits"] });
        });
      } else if (editValue) {
        postJson("/api/ifra-limits", { materialId: material.id, productType: "General", limitPercent: val }).then(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/materials", material.id, "ifra-limits"] });
        });
      }
    } else if (editField === "costManual") {
      if (sources.length > 0) {
        patchJson(`/api/material-sources/${sources[0].id}`, { pricePerGram: val || null, purchasePrice: null, purchaseQuantityGrams: null }).then(() => { queryClient.invalidateQueries({ queryKey: ["/api/material-sources"] }); }).catch((err: any) => console.error("cost update failed", err));
         } else if (editValue) {
        postJson("/api/material-sources", { materialId: material.id, pricePerGram: val, stockGrams: "0" }).then(() => { queryClient.invalidateQueries({ queryKey: ["/api/material-sources"] }); }).catch((err: any) => console.error("cost create failed", err));
      }
      }
        setEditField(null);
    setEditValue("");
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const dateStr = format(date, "yyyy-MM-dd");
    if (sources.length > 0) {
      updateSourceMut.mutate({ id: sources[0].id, data: { purchaseDate: dateStr } });
    } else {
      createSourceMut.mutate({ materialId: material.id, purchaseDate: dateStr, stockGrams: "0" });
    }
    setDateOpen(false);
  };

  const handleSupplierSelect = (supplierId: string) => {
    const alreadyLinked = sources.some((s: any) => s.supplierId === supplierId);
    if (!alreadyLinked) {
      createSourceMut.mutate({ materialId: material.id, supplierId, stockGrams: "0" });
    }
    setSupplierOpen(false);
  };

  // Pure entry for dilutions
  const pureEntry = { id: "__pure__", name: `${material.name} (pure)`, dilutionPercent: "100", solventName: null, notes: null, isPure: true, preparedDate: null };
  const allDilEntries = [pureEntry, ...dilutions];

  return (
    <div className="p-6 max-w-3xl">
            {editField === "name" ? (
        <Input
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          className="text-xl font-semibold h-auto py-1 px-2 -ml-2"
          autoFocus
          onBlur={() => { updateMaterialMut.mutate({ name: editValue || material.name }); setEditField(null); }}
          onKeyDown={e => { if (e.key === "Enter") { updateMaterialMut.mutate({ name: editValue || material.name }); setEditField(null); } if (e.key === "Escape") setEditField(null); }}
          data-testid="input-material-name"
        />
      ) : (
        <h1
          className="text-xl font-semibold cursor-pointer hover:bg-secondary/20 rounded px-2 py-1 -ml-2 transition-colors"
          onClick={() => startEdit("name", material.name)}
          data-testid="text-material-name"
        >{material.name}</h1>
      )}
      {editField === "cas" ? (
        <Input
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          placeholder="CAS # / Botanical Name..."
          className="text-sm h-auto py-1 px-2 -ml-2 mt-1 italic text-muted-foreground"
          autoFocus
          onBlur={() => { updateMaterialMut.mutate({ casNumber: editValue || null, botanicalName: editValue || null }); setEditField(null); }}
          onKeyDown={e => { if (e.key === "Enter") { updateMaterialMut.mutate({ casNumber: editValue || null, botanicalName: editValue || null }); setEditField(null); } if (e.key === "Escape") setEditField(null); }}
        />
      ) : (
        <p
          className="text-sm italic text-muted-foreground mt-0.5 cursor-pointer hover:bg-secondary/20 rounded px-2 py-1 -ml-2 transition-colors"
          onClick={() => startEdit("cas", material.botanicalName || material.casNumber || "")}
                  >{material.botanicalName || material.casNumber ? (material.botanicalName || `CAS ${material.casNumber}`) : "CAS # / Botanical Name..."}</p>
      )}
          <div className="space-y-0">
            <div className="divide-y divide-border/50">
              {/* Category — dropdown */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center justify-between py-2.5 px-1 w-full text-left hover:bg-secondary/20 transition-colors rounded">
                    <span className="text-xs text-muted-foreground w-24 shrink-0">Category</span>
                    <span className="text-sm text-right">
                      {family ? <span className="font-medium" style={{ color: familyColor }}>{family.name}</span> : <span className="text-muted-foreground/50">No category</span>}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="end">
                  {families.map((f: any) => (
                    <button key={f.id} className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-secondary/50 flex items-center gap-2"
                      onClick={() => { updateMaterialMut.mutate({ olfactiveFamilyId: f.id }); }}>
                      <span className="family-dot" style={{ backgroundColor: f.color || "#888" }} />
                      <span style={{ color: f.color }}>{f.name}</span>
                      {material.olfactiveFamilyId === f.id && <Check size={12} className="ml-auto" />}
                    </button>
                  ))}
                  {material.olfactiveFamilyId && (
                    <button className="w-full text-left px-2 py-1.5 text-xs text-muted-foreground rounded hover:bg-secondary/50 border-t border-border/50 mt-1 pt-1.5"
                      onClick={() => updateMaterialMut.mutate({ olfactiveFamilyId: null })}>Remove category</button>
                  )}
                </PopoverContent>
              </Popover>

              {/* Supplier — searchable dropdown */}
              <div className="py-2.5 px-1">
                <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                  <PopoverTrigger asChild>
                    <button className="flex items-center justify-between w-full text-left hover:bg-secondary/20 transition-colors rounded px-0">
                      <span className="text-xs text-muted-foreground w-24 shrink-0">Supplier</span>
                      <span className="text-sm text-right">
                        {uniqueSuppliers.length > 0
                          ? uniqueSuppliers.map((s: any) => s.name).join(", ")
                          : <span className="text-muted-foreground/50">No supplier</span>}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-0" align="end">
                    <Command>
                      <CommandInput placeholder="Search suppliers..." value={supplierSearch} onValueChange={setSupplierSearch} />
                      <CommandList>
                        <CommandEmpty>No suppliers found</CommandEmpty>
                        <CommandGroup>
                          {suppliers.map((s: any) => {
                            const linked = sources.some((src: any) => src.supplierId === s.id);
                            return (
                              <CommandItem key={s.id} value={s.name} onSelect={() => handleSupplierSelect(s.id)}>
                                <span className="flex-1">{s.name}</span>
                                {linked && <Check size={12} className="text-[hsl(183,70%,50%)]" />}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                        {suppliers.length === 0 && (
                          <div className="px-2 py-2">
                            <a href="#/suppliers" className="text-xs text-[hsl(183,70%,50%)] hover:underline">+ Add new supplier</a>
                          </div>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Inventory — inline edit */}
              {editField === "inventory" ? (
                <div className="flex items-center justify-between py-2 px-1">
                  <span className="text-xs text-muted-foreground w-24 shrink-0">Inventory</span>
                                <div className="relative">
                  <Input value={editValue} onChange={e => setEditValue(e.target.value)} type="text" inputMode="decimal"
                    className="h-7 text-sm w-32 text-right pr-7" autoFocus
                    onBlur={commitEdit}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitEdit(); } if (e.key === "Escape") { setEditField(null); setEditValue(""); } }} />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">g</span>
                                                  </div>
                </div>
              ) : (
                <button className="flex items-center justify-between py-2.5 px-1 w-full text-left hover:bg-secondary/20 transition-colors rounded"
                  onClick={() => startEdit("inventory", String(totalStock))}>
                  <span className="text-xs text-muted-foreground w-24 shrink-0">Inventory</span>
                  <span className="text-sm">{totalStock > 0 ? `${fmtGrams(totalStock)} total` : <span className="text-muted-foreground/50">0 g</span>}</span>
                </button>
              )}

              {/* Cost / g — right-click context menu */}
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  {editField === "costManual" ? (
                    <div className="flex items-center justify-between py-2 px-1">
                      <span className="text-xs text-muted-foreground w-24 shrink-0">Cost / g</span>
                      <div className="flex items-center gap-1 relative">
                        <span className="text-xs text-muted-foreground">€</span>
                        <Input value={editValue} onChange={e => setEditValue(e.target.value)} type="text" inputMode="decimal"
                          className="h-7 text-sm w-32 text-right pr-10" autoFocus
                          onBlur={commitEdit}
                          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitEdit(); } if (e.key === "Escape") { setEditField(null); setEditValue(""); } }} />
                                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">/g</span>
                      </div>
                    </div>
                  ) : (
                    <button className="flex items-center justify-between py-2.5 px-1 w-full text-left hover:bg-secondary/20 transition-colors rounded"
                      onClick={() => startEdit("costManual", cheapestPPG !== null ? String(cheapestPPG) : "")}>
                      <span className="text-xs text-muted-foreground w-24 shrink-0">Cost / g</span>
                      <span className="text-sm">{cheapestPPG !== null ? `€ ${fmtNum(cheapestPPG, 4)}` : <span className="text-muted-foreground/50">—</span>}</span>
                    </button>
                  )}
                </ContextMenuTrigger>
                <ContextMenuContent className="bg-card border-border">
                  <ContextMenuItem onClick={() => startEdit("costManual", cheapestPPG !== null ? String(cheapestPPG) : "")}>
                    ✏️  Enter manually
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => setShowCostCalc(true)}>
                    🧮  Calculate from total price
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>

              {/* IFRA limit — inline edit */}
              {editField === "ifra" ? (
                <div className="flex items-center justify-between py-2 px-1">
                  <span className="text-xs text-muted-foreground w-24 shrink-0">IFRA limit</span>
                  <div className="flex items-center gap-1 relative">
                    <Input value={editValue} onChange={e => setEditValue(e.target.value)} type="text" inputMode="decimal"
                      className="h-7 text-sm w-28 text-right pr-7" autoFocus
                      onBlur={commitEdit}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitEdit(); } if (e.key === "Escape") { setEditField(null); setEditValue(""); } }} />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">%</span>
                </div>
                            </div>
              ) : (
                <button className="flex items-center justify-between py-2.5 px-1 w-full text-left hover:bg-secondary/20 transition-colors rounded"
                  onClick={() => startEdit("ifra", firstIfra ? firstIfra.limitPercent : "")}>
                  <span className="text-xs text-muted-foreground w-24 shrink-0">IFRA limit</span>
                  <span className="text-sm">{firstIfra ? `${fmtNum(firstIfra.limitPercent)} % (${firstIfra.productType})` : <span className="text-muted-foreground/50">IFRA limit</span>}</span>
                </button>
              )}

              {/* Date obtained — enhanced calendar picker */}
              <EnhancedCalendarPicker
                value={latestDate}
                open={dateOpen}
                onOpenChange={setDateOpen}
                onSave={(dateStr) => {
                  if (sources.length > 0) {
                    updateSourceMut.mutate({ id: sources[0].id, data: { purchaseDate: dateStr } });
                  } else {
                    createSourceMut.mutate({ materialId: material.id, purchaseDate: dateStr, stockGrams: "0" });
                  }
                }}
                onRemove={() => {
                  if (sources.length > 0) {
                    updateSourceMut.mutate({ id: sources[0].id, data: { purchaseDate: null } });
                  }
                }}
              />
            </div>

            {/* Fragrance pyramid — icon segments */}
            <div className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground mb-2">Fragrance pyramid</p>
              <TooltipProvider delayDuration={300}>
                <div className="flex rounded-lg overflow-hidden border border-border/60">
                  {PYRAMID_ROLES.map((role, idx) => {
                    const isActive = material.pyramidRole === role;
                    const isLast = idx === PYRAMID_ROLES.length - 1;
                    const isUnknown = role === "unknown";
                    const label = role.charAt(0).toUpperCase() + role.slice(1);
                    return (
                      <Tooltip key={role}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handlePyramidClick(role)}
                            className={`flex-1 flex items-center justify-center py-2 transition-colors
                              ${!isLast ? 'border-r border-border/40' : ''}
                              ${isActive ? '' : 'bg-[#2a2a2a] hover:bg-[#333]'}`}
                            style={isActive ? { backgroundColor: familyColor } : {}}
                            data-testid={`pyramid-${role}`}
                          >
                            <PyramidIcon
                              size={18}
                              color={isActive ? "#fff" : "#888"}
                              unknown={isUnknown}
                            />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </TooltipProvider>
            </div>

            {/* Description — inline multiline */}
            <div className="border-t border-border/50 pt-4 pb-4">
              <p className="text-xs text-muted-foreground mb-2">Description</p>
              <Textarea value={description}
                onChange={e => { setDescription(e.target.value); setDescDirty(true); }}
                onBlur={saveDescription}
                placeholder="Sensory notes, personal impressions, usage tips..."
                rows={12} className="text-sm resize-none" data-testid="textarea-description" />
              {descDirty && <p className="text-[10px] text-muted-foreground mt-1">Unsaved — click outside to save</p>}
            </div>

            {/* Treat as solvent */}
            <div className="border-t border-border/50 pt-4 pb-4 flex items-center justify-between">
              <span className="text-sm">Treat as solvent?</span>
              <Switch checked={!!material.treatAsSolvent} onCheckedChange={toggleSolvent} data-testid="toggle-solvent" />
            </div>

            {/* Dilutions section */}
            <div className="border-t border-border/50 pt-4 pb-4">
              <p className="text-xs text-muted-foreground mb-2">Dilutions</p>
              <div className="space-y-1">
                {allDilEntries.map((d: any) => {
                  if (editDilutionId === d.id && !d.isPure) {
                    return <DilutionForm key={d.id} materialId={material.id} existing={d} onClose={() => setEditDilutionId(null)} />;
                  }
                  return (
                    <div key={d.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-secondary/30 group text-sm">
                      <span className="font-mono w-20 text-right shrink-0">{fmtNum(d.dilutionPercent)} %</span>
                      {d.solventName && <span className="text-muted-foreground text-xs">in {d.solventName}</span>}
                      <DilutionDatePicker dilution={d} materialId={material.id} updateMut={updateDilutionMut} />
                      <span className="flex-1" />
                      {d.isPure ? (
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100" onClick={() => setShowAddDilution(true)}>
                          <Plus size={12} />
                        </Button>
                      ) : (
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setShowCalc(true)} title="Calculator">
                            <Calculator size={12} />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditDilutionId(d.id)} title="Edit">
                            <Pencil size={11} />
                          </Button>
                          <DeleteDilutionButton id={d.id} materialId={material.id} />
                        </div>
                      )}
                    </div>
                  );
                })}
                {!showAddDilution && (
                  <button className="w-full text-left py-1.5 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-secondary/30"
                    onClick={() => setShowAddDilution(true)}>+ Add new dilution...</button>
                )}
                {showAddDilution && <div className="mt-1"><DilutionForm materialId={material.id} onClose={() => setShowAddDilution(false)} /></div>}
              </div>
            </div>

            {/* Usage in formulas */}
            <div className="border-t border-border/50 pt-4 pb-2">
              <p className="text-xs text-muted-foreground mb-2">Usage in formulas</p>
              {usageInFormulas.length > 0 ? (
                <div className="space-y-1">
                  {usageInFormulas.map((u: any, i: number) => (
                    <a key={`${u.formulaId}-${i}`} href={`#/formulas?id=${u.formulaId}`}
                      className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-secondary/30 text-sm cursor-pointer transition-colors">
                      <span>{u.formulaName}<span className="text-muted-foreground text-xs ml-1">({fmtNum(u.dilutionPct)} %)</span></span>
                      <span className="font-mono text-xs">{fmtNum(u.neatPct, 2)} %</span>
                    </a>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground/50 py-1">Not used in any formula</p>}
            </div>
          </div>
          <div className="space-y-4">
            <InfoRow label="In wax" value={material.behaviorWax} />
            <InfoRow label="In alcohol" value={material.behaviorAlcohol} />
            <InfoRow label="In nebulizer" value={material.behaviorNebulizer} />
            <InfoRow label="In diffuser" value={material.behaviorDiffuser} />
          </div>
          <SuppliersTab materialId={material.id} sources={sources} suppliers={suppliers} />
          <DilutionsTab materialId={material.id} dilutions={dilutions} materialName={material.name} />
          <div className="space-y-2">
            {ifraLimits.map((l: any) => (
              <div key={l.id} className="bg-card rounded-lg p-3 border border-border flex justify-between">
                <span className="text-sm">{l.productType}</span>
                <span className="text-sm">{fmtNum(l.limitPercent)} %</span>
              </div>
            ))}
            {ifraLimits.length === 0 && <p className="text-sm text-muted-foreground">No IFRA limits set</p>}
          </div>
      

      <DilutionCalculator open={showCalc} onOpenChange={setShowCalc} materialName={material.name} />
      <CostCalculatorDialog open={showCostCalc} onOpenChange={setShowCostCalc} materialId={material.id} sources={sources} />
    </div>
  );
}

// ─── Dilution date picker (per row) ─────────────────────────────
function DilutionDatePicker({ dilution, materialId, updateMut }: any) {
  const [open, setOpen] = useState(false);
  if (dilution.isPure) return null;
  const dateVal = dilution.preparedDate;
  return (
    <EnhancedCalendarPickerGeneric
      value={dateVal}
      open={open}
      onOpenChange={setOpen}
      onSave={(dateStr) => {
        updateMut.mutate({ id: dilution.id, data: { preparedDate: dateStr } });
      }}
      onRemove={() => {
        updateMut.mutate({ id: dilution.id, data: { preparedDate: null } });
      }}
    >
      <button className="text-[11px] text-muted-foreground hover:text-foreground transition-colors ml-1">
        {dateVal ? formatLongDate(dateVal) : <span className="text-muted-foreground/40">Date</span>}
      </button>
    </EnhancedCalendarPickerGeneric>
  );
}

// ─── Cost Calculator Dialog ─────────────────────────────────────
function CostCalculatorDialog({ open, onOpenChange, materialId, sources }: any) {
  const { toast } = useToast();
  const [totalPrice, setTotalPrice] = useState("");
  const [quantity, setQuantity] = useState("");

  const price = parseFloat(totalPrice) || 0;
  const qty = parseFloat(quantity) || 0;
  const ppg = qty > 0 ? price / qty : 0;

  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => patchJson(`/api/material-sources/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/material-sources"] });
      toast({ title: "Cost per gram updated" });
      onOpenChange(false);
      setTotalPrice(""); setQuantity("");
    },
  });
  const createMut = useMutation({
    mutationFn: (data: any) => postJson("/api/material-sources", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/material-sources"] });
      toast({ title: "Cost per gram saved" });
      onOpenChange(false);
      setTotalPrice(""); setQuantity("");
    },
  });

  const handleApply = () => {
    if (sources.length > 0) {
      updateMut.mutate({ id: sources[0].id, data: { purchasePrice: totalPrice, purchaseQuantityGrams: quantity, pricePerGram: String(ppg) } });
    } else {
      createMut.mutate({ materialId, purchasePrice: totalPrice, purchaseQuantityGrams: quantity, pricePerGram: String(ppg), stockGrams: quantity });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader><DialogTitle>Calculate cost per gram</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Total price paid</label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">€</span>
              <Input value={totalPrice} onChange={e => setTotalPrice(e.target.value)} type="number" step="0.01" className="h-8 text-sm" autoFocus />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Quantity (g)</label>
            <Input value={quantity} onChange={e => setQuantity(e.target.value)} type="number" step="0.01" className="h-8 text-sm" />
          </div>
          {qty > 0 && price > 0 && (
            <div className="bg-secondary/60 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">→ Cost / g</p>
              <p className="text-lg font-semibold text-[hsl(183,70%,50%)]">€ {fmtNum(ppg, 4)}</p>
            </div>
          )}
          <div className="flex gap-2">
            <Button className="flex-1" disabled={!price || !qty || updateMut.isPending || createMut.isPending} onClick={handleApply}>
              Apply
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Suppliers Tab ──────────────────────────────────────────────
function SuppliersTab({ materialId, sources, suppliers }: any) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="text-xs text-muted-foreground">Supplier records, pricing, and stock</p>
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-supplier-record">
          <Plus size={14} className="mr-1" /> Add Supplier
        </Button>
      </div>
      <div className="space-y-3">
        {sources.map((s: any) => {
          const sup = suppliers.find((sp: any) => sp.id === s.supplierId);
          const ppg = s.purchasePrice && s.purchaseQuantityGrams
            ? (parseFloat(s.purchasePrice) / parseFloat(s.purchaseQuantityGrams))
            : s.pricePerGram ? parseFloat(s.pricePerGram) : null;
          const stockLow = s.reorderThresholdGrams && parseFloat(s.stockGrams || "0") <= parseFloat(s.reorderThresholdGrams);

          if (editId === s.id) {
            return <SupplierRecordForm key={s.id} materialId={materialId} suppliers={suppliers} existing={s} onClose={() => setEditId(null)} />;
          }

          return (
            <div key={s.id} className="bg-card rounded-lg p-3 border border-border group">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium">{sup?.name || "Unknown supplier"}</p>
                  {s.supplierMaterialName && <p className="text-[11px] text-muted-foreground">as: {s.supplierMaterialName}</p>}
                  {s.batchLot && <p className="text-[11px] text-muted-foreground">Batch: {s.batchLot}</p>}
                  {s.purchaseDate && <p className="text-[11px] text-muted-foreground">Purchased: {s.purchaseDate}</p>}
                </div>
                <div className="text-right">
                  {s.purchasePrice && (
                    <p className="text-xs text-muted-foreground">
                      € {fmtNum(s.purchasePrice)} / {fmtGrams(s.purchaseQuantityGrams)}
                    </p>
                  )}
                  {ppg !== null && <p className="text-sm font-medium">€ {fmtNum(ppg, 4)}/g</p>}
                  <p className={`text-xs mt-0.5 ${stockLow ? 'text-yellow-400 font-medium' : 'text-muted-foreground'}`}>
                    Stock: {fmtGrams(s.stockGrams || "0")}
                    {stockLow && " (low)"}
                  </p>
                  {s.reorderThresholdGrams && (
                    <p className="text-[10px] text-muted-foreground">Reorder at: {fmtGrams(s.reorderThresholdGrams)}</p>
                  )}
                </div>
              </div>
              {s.notes && <p className="text-xs text-muted-foreground mt-2 border-t border-border/50 pt-2">{s.notes}</p>}
              <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditId(s.id)}>
                  <Pencil size={11} className="mr-1" /> Edit
                </Button>
                <DeleteSourceButton id={s.id} materialId={materialId} />
              </div>
            </div>
          );
        })}
        {sources.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No suppliers added yet</p>}
      </div>

      {showAdd && (
        <div className="mt-3">
          <SupplierRecordForm materialId={materialId} suppliers={suppliers} onClose={() => setShowAdd(false)} />
        </div>
      )}
    </div>
  );
}

function DeleteSourceButton({ id, materialId }: { id: string; materialId: string }) {
  const deleteMut = useMutation({
    mutationFn: () => deleteJson(`/api/material-sources/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/material-sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/materials", materialId, "sources"] });
    },
  });
  return (
    <Button size="sm" variant="ghost" className="h-6 text-xs text-destructive" onClick={() => deleteMut.mutate()}>
      <Trash2 size={11} className="mr-1" /> Delete
    </Button>
  );
}

function SupplierRecordForm({ materialId, suppliers, existing, onClose }: any) {
  const { toast } = useToast();
  const [supplierId, setSupplierId] = useState(existing?.supplierId || "");
  const [supplierMaterialName, setSupplierMaterialName] = useState(existing?.supplierMaterialName || "");
  const [batchLot, setBatchLot] = useState(existing?.batchLot || "");
  const [purchaseDate, setPurchaseDate] = useState(existing?.purchaseDate || "");
  const [purchasePrice, setPurchasePrice] = useState(existing?.purchasePrice || "");
  const [purchaseQty, setPurchaseQty] = useState(existing?.purchaseQuantityGrams || "");
  const [stockGrams, setStockGrams] = useState(existing?.stockGrams || "");
  const [reorderThreshold, setReorderThreshold] = useState(existing?.reorderThresholdGrams || "");
  const [notes, setNotes] = useState(existing?.notes || "");

  const computedPPG = purchasePrice && purchaseQty
    ? (parseFloat(purchasePrice) / parseFloat(purchaseQty)).toFixed(4) : "";

  const createMut = useMutation({
    mutationFn: (data: any) => existing
      ? patchJson(`/api/material-sources/${existing.id}`, data)
      : postJson("/api/material-sources", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/material-sources"] });
      toast({ title: existing ? "Supplier record updated" : "Supplier record added" });
      onClose();
    },
  });

  function handleSave() {
    const ppg = purchasePrice && purchaseQty
      ? String(parseFloat(purchasePrice) / parseFloat(purchaseQty))
      : "";
    createMut.mutate({
      materialId,
      supplierId: supplierId || null,
      supplierMaterialName: supplierMaterialName || null,
      batchLot: batchLot || null,
      purchaseDate: purchaseDate || null,
      purchasePrice: purchasePrice || null,
      purchaseQuantityGrams: purchaseQty || null,
      pricePerGram: ppg || null,
      stockGrams: stockGrams || "0",
      reorderThresholdGrams: reorderThreshold || null,
      notes: notes || null,
    });
  }

  return (
    <div className="bg-card rounded-lg p-3 border border-[hsl(183,70%,36%)]/40 space-y-2">
      <p className="text-xs font-medium text-[hsl(183,70%,50%)]">{existing ? "Edit Supplier Record" : "New Supplier Record"}</p>

      <Select value={supplierId} onValueChange={setSupplierId}>
        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select supplier..." /></SelectTrigger>
        <SelectContent>
          {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <Input placeholder="Supplier material name (optional)" value={supplierMaterialName} onChange={e => setSupplierMaterialName(e.target.value)} className="h-8 text-xs" />
      <Input placeholder="Batch / Lot #" value={batchLot} onChange={e => setBatchLot(e.target.value)} className="h-8 text-xs" />
      <Input type="date" placeholder="Purchase date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} className="h-8 text-xs" />

      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Purchase price (€)" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} className="h-8 text-xs" type="number" step="0.01" />
        <Input placeholder="Quantity (g)" value={purchaseQty} onChange={e => setPurchaseQty(e.target.value)} className="h-8 text-xs" type="number" step="0.01" />
      </div>
      {computedPPG && (
        <p className="text-xs text-[hsl(183,70%,50%)]">Calculated: € {fmtNum(computedPPG, 4)}/g</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Current stock (g)" value={stockGrams} onChange={e => setStockGrams(e.target.value)} className="h-8 text-xs" type="number" step="0.01" />
        <Input placeholder="Reorder threshold (g)" value={reorderThreshold} onChange={e => setReorderThreshold(e.target.value)} className="h-8 text-xs" type="number" step="0.01" />
      </div>

      <Textarea placeholder="Notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="text-xs" />

      <div className="flex gap-2">
        <Button size="sm" className="flex-1" disabled={createMut.isPending} onClick={handleSave}>
          {createMut.isPending ? "Saving..." : "Save"}
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Dilutions Tab ──────────────────────────────────────────────
function DilutionsTab({ materialId, dilutions, materialName }: any) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Always show 100% (pure) as first entry
  const pureEntry = { id: "__pure__", name: `${materialName} (pure)`, dilutionPercent: "100", solventName: null, notes: null, isPure: true };
  const allEntries = [pureEntry, ...dilutions];

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="text-xs text-muted-foreground">Dilutions and preparations</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowCalc(true)} data-testid="button-dilution-calc">
            <Calculator size={14} className="mr-1" /> Calculator
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-dilution">
            <Plus size={14} className="mr-1" /> Add
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {allEntries.map((d: any) => {
          if (editId === d.id && !d.isPure) {
            return <DilutionForm key={d.id} materialId={materialId} existing={d} onClose={() => setEditId(null)} />;
          }
          return (
            <div key={d.id} className="bg-card rounded-lg p-3 border border-border group">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium">{d.name}</p>
                  {d.solventName && <p className="text-[11px] text-muted-foreground">in {d.solventName}</p>}
                  {d.notes && <p className="text-[11px] text-muted-foreground mt-1">{d.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{fmtNum(d.dilutionPercent)} %</Badge>
                  {!d.isPure && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setEditId(d.id); }}>
                        <Pencil size={11} />
                      </Button>
                      <DeleteDilutionButton id={d.id} materialId={materialId} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showAdd && (
        <div className="mt-3">
          <DilutionForm materialId={materialId} onClose={() => setShowAdd(false)} />
        </div>
      )}

      <DilutionCalculator open={showCalc} onOpenChange={setShowCalc} materialName={materialName} />
    </div>
  );
}

function DeleteDilutionButton({ id, materialId }: { id: string; materialId: string }) {
  const deleteMut = useMutation({
    mutationFn: () => deleteJson(`/api/dilutions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials", materialId, "dilutions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dilutions"] });
    },
  });
  return (
    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteMut.mutate()}>
      <Trash2 size={11} />
    </Button>
  );
}

function DilutionForm({ materialId, existing, onClose }: any) {
  const { toast } = useToast();
  const [dilutionPercent, setDilutionPercent] = useState(existing?.dilutionPercent || "");
  const [solventName, setSolventName] = useState(existing?.solventName || "");
  const [name, setName] = useState(existing?.name || "");
  const [notes, setNotes] = useState(existing?.notes || "");

  // Auto-generate name
  const autoName = dilutionPercent && solventName
    ? `${dilutionPercent}% in ${solventName}`
    : dilutionPercent ? `${dilutionPercent}%` : "";

  const saveMut = useMutation({
    mutationFn: (data: any) => existing
      ? patchJson(`/api/dilutions/${existing.id}`, data)
      : postJson("/api/dilutions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials", materialId, "dilutions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dilutions"] });
      toast({ title: existing ? "Dilution updated" : "Dilution created" });
      onClose();
    },
  });

  function handleSave() {
    const pct = parseFloat(dilutionPercent);
    saveMut.mutate({
      sourceMaterialId: materialId,
      name: name || autoName,
      dilutionPercent: String(pct),
      solventName: solventName || null,
      neatMultiplier: String(pct / 100),
      notes: notes || null,
    });
  }

  return (
    <div className="bg-card rounded-lg p-3 border border-[hsl(183,70%,36%)]/40 space-y-2">
      <p className="text-xs font-medium text-[hsl(183,70%,50%)]">{existing ? "Edit Dilution" : "New Dilution"}</p>
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Dilution % (e.g. 10)" value={dilutionPercent} onChange={e => setDilutionPercent(e.target.value)} className="h-8 text-xs" type="number" step="0.1" />
        <Input placeholder="Solvent (e.g. Ethanol)" value={solventName} onChange={e => setSolventName(e.target.value)} className="h-8 text-xs" />
      </div>
      <Input placeholder={autoName ? `Label: ${autoName}` : "Custom label (optional)"} value={name} onChange={e => setName(e.target.value)} className="h-8 text-xs" />
      <Textarea placeholder="Notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="text-xs" />
      <div className="flex gap-2">
        <Button size="sm" className="flex-1" disabled={!dilutionPercent || saveMut.isPending} onClick={handleSave}>
          {saveMut.isPending ? "Saving..." : "Save"}
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Dilution Calculator ────────────────────────────────────────
function DilutionCalculator({ open, onOpenChange, materialName }: any) {
  const [sourceConc, setSourceConc] = useState("100");
  const [targetConc, setTargetConc] = useState("");
  const [finalQty, setFinalQty] = useState("");
  const [solvent, setSolvent] = useState("Ethanol");

  const src = parseFloat(sourceConc) || 0;
  const tgt = parseFloat(targetConc) || 0;
  const qty = parseFloat(finalQty) || 0;

  let sourceNeeded = 0;
  let solventNeeded = 0;
  let valid = false;

  if (src > 0 && tgt > 0 && qty > 0 && tgt <= src) {
    sourceNeeded = (tgt / src) * qty;
    solventNeeded = qty - sourceNeeded;
    valid = true;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader><DialogTitle>Dilution Calculator</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Calculate how much material and solvent you need for a dilution.
          </p>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Source concentration (%)</label>
            <Input value={sourceConc} onChange={e => setSourceConc(e.target.value)} type="number" step="0.1" className="h-8 text-sm" />
            <p className="text-[10px] text-muted-foreground mt-0.5">
              100% = pure material. Use lower if starting from an existing dilution.
            </p>
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Target concentration (%)</label>
            <Input value={targetConc} onChange={e => setTargetConc(e.target.value)} type="number" step="0.1" className="h-8 text-sm" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Desired final quantity (g)</label>
            <Input value={finalQty} onChange={e => setFinalQty(e.target.value)} type="number" step="0.01" className="h-8 text-sm" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Solvent</label>
            <Input value={solvent} onChange={e => setSolvent(e.target.value)} className="h-8 text-sm" />
          </div>

          {valid && (
            <div className="bg-secondary/60 rounded-lg p-3 space-y-1.5">
              <p className="text-xs font-semibold text-[hsl(183,70%,50%)]">Result</p>
              <div className="flex justify-between text-sm">
                <span>{materialName} ({fmtNum(sourceConc)}%)</span>
                <span className="font-mono font-medium">{fmtGrams(sourceNeeded)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{solvent}</span>
                <span className="font-mono font-medium">{fmtGrams(solventNeeded)}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-border/50 pt-1.5 text-muted-foreground">
                <span>Total</span>
                <span className="font-mono">{fmtGrams(qty)}</span>
              </div>
            </div>
          )}

          {targetConc && src > 0 && tgt > src && (
            <p className="text-xs text-destructive">Target concentration cannot exceed source concentration.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ label, value }: { label: string; value: any }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="text-sm mt-0.5">{value}</p>
    </div>
  );
}

function CreateMaterialDialog({ open, onOpenChange, families }: any) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [cas, setCas] = useState("");
  const [familyId, setFamilyId] = useState("");
  const [pyramid, setPyramid] = useState("");
  const [sensory, setSensory] = useState("");

  const mutation = useMutation({
    mutationFn: (data: any) => postJson("/api/materials", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
      onOpenChange(false);
      setName(""); setCas(""); setFamilyId(""); setPyramid(""); setSensory("");
      toast({ title: "Material created" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader><DialogTitle>New Material</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Name" value={name} onChange={e => setName(e.target.value)} data-testid="input-material-name" />
          <Input placeholder="CAS Number" value={cas} onChange={e => setCas(e.target.value)} />
          <Select value={familyId} onValueChange={setFamilyId}>
            <SelectTrigger><SelectValue placeholder="Olfactive family" /></SelectTrigger>
            <SelectContent>
              {families.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={pyramid} onValueChange={setPyramid}>
            <SelectTrigger><SelectValue placeholder="Pyramid role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="top">Top</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="middle">Middle</SelectItem>
              <SelectItem value="bottom">Bottom</SelectItem>
              <SelectItem value="base">Base</SelectItem>
            </SelectContent>
          </Select>
          <Textarea placeholder="Sensory notes" value={sensory} onChange={e => setSensory(e.target.value)} rows={2} />
          <Button className="w-full" disabled={!name || mutation.isPending}
            onClick={() => mutation.mutate({ name, casNumber: cas || null, olfactiveFamilyId: familyId || null, pyramidRole: pyramid || null, notesSensory: sensory || null })}
            data-testid="button-create-material"
          >
            {mutation.isPending ? "Creating..." : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Olfactive Family Dialog (from Materials header) ─────
function CreateFamilyDialog({ open, onOpenChange, familyCount }: { open: boolean; onOpenChange: (v: boolean) => void; familyCount: number }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#888888");

  const createMut = useMutation({
    mutationFn: (data: any) => postJson("/api/olfactive-families", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/olfactive-families"] });
      onOpenChange(false);
      setName(""); setColor("#888888");
      toast({ title: "Family created" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setName(""); setColor("#888888"); } }}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader><DialogTitle>New Olfactive Family</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Family name (e.g. Chypre, Tobacco, Leather)"
            value={name}
            onChange={e => setName(e.target.value)}
            data-testid="input-family-name-sidebar"
            autoFocus
          />
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground">Color</label>
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-border"
            />
            <span className="text-xs text-muted-foreground font-mono">{color}</span>
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={!name.trim() || createMut.isPending}
              onClick={() => createMut.mutate({ name: name.trim(), color, sortOrder: familyCount })}
              data-testid="button-create-family-sidebar"
            >
              {createMut.isPending ? "Saving..." : "Save"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Inline Edit Family (in sidebar header) ─────────────────────
function InlineEditFamily({ family, onClose }: { family: any; onClose: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState(family.name);
  const [color, setColor] = useState(family.color || "#888888");

  const updateMut = useMutation({
    mutationFn: (data: any) => patchJson(`/api/olfactive-families/${family.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/olfactive-families"] });
      toast({ title: "Family updated" });
      onClose();
    },
  });

  return (
    <div className="px-2 py-1 flex items-center gap-1.5 bg-secondary/40">
      <input
        type="color"
        value={color}
        onChange={e => setColor(e.target.value)}
        className="w-5 h-5 rounded cursor-pointer border border-border shrink-0"
      />
      <Input
        value={name}
        onChange={e => setName(e.target.value)}
        className="h-6 text-[11px] flex-1 px-1.5"
        autoFocus
        onKeyDown={e => {
          if (e.key === "Enter" && name.trim()) updateMut.mutate({ name: name.trim(), color });
          if (e.key === "Escape") onClose();
        }}
      />
      <Button
        size="sm" variant="ghost" className="h-5 text-[10px] px-1.5"
        disabled={!name.trim() || updateMut.isPending}
        onClick={() => updateMut.mutate({ name: name.trim(), color })}
      >
        Save
      </Button>
      <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5" onClick={onClose}>
        ✕
      </Button>
    </div>
  );
}

// ─── Material List Item with context menu + swipe ──────────────
function MaterialListItem({ m, selectedId, families, onSelect, onDeleteRequest }: {
  m: any;
  selectedId: string | null;
  families: any[];
  onSelect: (id: string) => void;
  onDeleteRequest: (id: string) => void;
}) {
  const mFamily = families.find((f: any) => f.id === m.olfactiveFamilyId);
  const mColor = mFamily?.color || "#888";
  const isUnknown = !m.pyramidRole || m.pyramidRole === "unknown";

  const [showDelete, setShowDelete] = useState(false);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setShowDelete(false);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = Math.abs(touchStartY.current - e.changedTouches[0].clientY);
    if (dx > 60 && dy < 40) {
      setShowDelete(true);
    } else if (dx < -20) {
      setShowDelete(false);
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="relative overflow-hidden">
          <div
            className={`px-3 py-1.5 text-sm cursor-pointer flex items-center gap-2 hover:bg-secondary/50 transition-all duration-200
              ${selectedId === m.id ? 'bg-[hsl(183,70%,36%)]/10 text-[hsl(183,70%,50%)]' : 'text-foreground/80'}`}
            style={{ transform: showDelete ? 'translateX(-80px)' : 'translateX(0)', transition: 'transform 0.2s ease' }}
            onClick={() => { if (showDelete) { setShowDelete(false); } else { onSelect(m.id); } }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            data-testid={`material-item-${m.id}`}
          >
            <span className="truncate flex-1">{m.name}</span>
            <PyramidIcon size={15} color={isUnknown ? "#666" : mColor} unknown={isUnknown} className="shrink-0 opacity-70" />
          </div>
          {showDelete && (
            <button
              className="absolute right-0 top-0 h-full w-20 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center justify-center"
              onClick={(e) => { e.stopPropagation(); onDeleteRequest(m.id); setShowDelete(false); }}
            >
              Delete
            </button>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="bg-card border-border">
        <ContextMenuItem
          className="text-red-500 focus:text-red-500 focus:bg-red-500/10 cursor-pointer"
          onClick={() => onDeleteRequest(m.id)}
        >
          Delete material
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
