import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { postJson, patchJson, deleteJson } from "@/lib/api";

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">Settings</h1>
      <Tabs defaultValue="families">
        <TabsList className="bg-secondary/50 mb-4">
          <TabsTrigger value="families">Olfactive Families</TabsTrigger>
          <TabsTrigger value="categories">Formula Categories</TabsTrigger>
        </TabsList>
        <TabsContent value="families"><FamilyManager /></TabsContent>
        <TabsContent value="categories"><CategoryManager /></TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Shared reorder helper ──────────────────────────────────────
function moveItem<T>(arr: T[], fromIndex: number, direction: -1 | 1): T[] {
  const toIndex = fromIndex + direction;
  if (toIndex < 0 || toIndex >= arr.length) return arr;
  const copy = [...arr];
  [copy[fromIndex], copy[toIndex]] = [copy[toIndex], copy[fromIndex]];
  return copy;
}

// ─── Olfactive Families ─────────────────────────────────────────
function FamilyManager() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#888888");

  const { data: families = [] } = useQuery<any[]>({ queryKey: ["/api/olfactive-families"] });

  const createMut = useMutation({
    mutationFn: (data: any) => postJson("/api/olfactive-families", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/olfactive-families"] });
      setShowAdd(false); setName(""); setColor("#888888");
      toast({ title: "Family created" });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => patchJson(`/api/olfactive-families/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/olfactive-families"] });
      setEditId(null);
      toast({ title: "Family updated" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteJson(`/api/olfactive-families/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/olfactive-families"] });
      toast({ title: "Family deleted" });
    },
  });

  const reorderMut = useMutation({
    mutationFn: (ids: string[]) => postJson("/api/olfactive-families/reorder", { ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/olfactive-families"] });
    },
  });

  function handleMove(index: number, direction: -1 | 1) {
    const reordered = moveItem(families, index, direction);
    reorderMut.mutate(reordered.map((f: any) => f.id));
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm text-muted-foreground">Manage olfactive families, colors, and ordering</p>
        <Button size="sm" onClick={() => { setShowAdd(true); setName(""); setColor("#888888"); }} data-testid="button-add-family">
          <Plus size={14} className="mr-1" /> Add
        </Button>
      </div>
      <div className="space-y-1">
        {families.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">No olfactive families yet. Click Add to create one.</p>
        )}
        {families.map((f: any, i: number) => (
          <div key={f.id} className="flex items-center gap-2 bg-card rounded p-2 border border-border group">
            {/* Order arrows */}
            <div className="flex flex-col">
              <button
                className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0 leading-none"
                disabled={i === 0}
                onClick={() => handleMove(i, -1)}
                data-testid={`family-move-up-${f.id}`}
              >
                <ChevronUp size={14} />
              </button>
              <button
                className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0 leading-none"
                disabled={i === families.length - 1}
                onClick={() => handleMove(i, 1)}
                data-testid={`family-move-down-${f.id}`}
              >
                <ChevronDown size={14} />
              </button>
            </div>

            <span className="family-dot shrink-0" style={{ backgroundColor: f.color || "#888" }} />

            {editId === f.id ? (
              <>
                <Input value={name} onChange={e => setName(e.target.value)} className="h-7 text-sm flex-1" />
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer" />
                <Button size="sm" variant="ghost" onClick={() => updateMut.mutate({ id: f.id, data: { name, color } })}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Cancel</Button>
              </>
            ) : (
              <>
                <span className="text-sm flex-1" style={{ color: f.color }}>{f.name}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums mr-2 opacity-0 group-hover:opacity-100">#{i + 1}</span>
                <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0" onClick={() => { setEditId(f.id); setName(f.name); setColor(f.color || "#888888"); }}>
                  <Pencil size={12} />
                </Button>
                <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 text-destructive h-7 w-7 p-0" onClick={() => deleteMut.mutate(f.id)}>
                  <Trash2 size={12} />
                </Button>
              </>
            )}
          </div>
        ))}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>New Olfactive Family</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Name" value={name} onChange={e => setName(e.target.value)} data-testid="input-family-name" />
            <div className="flex items-center gap-3">
              <label className="text-xs text-muted-foreground">Color</label>
              <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
            </div>
            <Button className="w-full" disabled={!name || createMut.isPending} onClick={() => createMut.mutate({ name, color, sortOrder: families.length })} data-testid="button-create-family">
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Formula Categories ─────────────────────────────────────────
function CategoryManager() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");

  const { data: categories = [] } = useQuery<any[]>({ queryKey: ["/api/formula-categories"] });

  const createMut = useMutation({
    mutationFn: (data: any) => postJson("/api/formula-categories", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/formula-categories"] });
      setShowAdd(false); setName("");
      toast({ title: "Category created" });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => patchJson(`/api/formula-categories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/formula-categories"] });
      setEditId(null);
      toast({ title: "Category updated" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteJson(`/api/formula-categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/formula-categories"] });
      toast({ title: "Category deleted" });
    },
  });

  const reorderMut = useMutation({
    mutationFn: (ids: string[]) => postJson("/api/formula-categories/reorder", { ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/formula-categories"] });
    },
  });

  function handleMove(index: number, direction: -1 | 1) {
    const reordered = moveItem(categories, index, direction);
    reorderMut.mutate(reordered.map((c: any) => c.id));
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm text-muted-foreground">Manage formula categories and ordering</p>
        <Button size="sm" onClick={() => { setShowAdd(true); setName(""); }} data-testid="button-add-category">
          <Plus size={14} className="mr-1" /> Add
        </Button>
      </div>
      <div className="space-y-1">
        {categories.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">No formula categories yet. Click Add to create one.</p>
        )}
        {categories.map((c: any, i: number) => (
          <div key={c.id} className="flex items-center gap-2 bg-card rounded p-2 border border-border group">
            {/* Order arrows */}
            <div className="flex flex-col">
              <button
                className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0 leading-none"
                disabled={i === 0}
                onClick={() => handleMove(i, -1)}
                data-testid={`category-move-up-${c.id}`}
              >
                <ChevronUp size={14} />
              </button>
              <button
                className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0 leading-none"
                disabled={i === categories.length - 1}
                onClick={() => handleMove(i, 1)}
                data-testid={`category-move-down-${c.id}`}
              >
                <ChevronDown size={14} />
              </button>
            </div>

            {editId === c.id ? (
              <>
                <Input value={name} onChange={e => setName(e.target.value)} className="h-7 text-sm flex-1" />
                <Button size="sm" variant="ghost" onClick={() => updateMut.mutate({ id: c.id, data: { name } })}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Cancel</Button>
              </>
            ) : (
              <>
                <span className="text-sm flex-1">{c.name}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums mr-2 opacity-0 group-hover:opacity-100">#{i + 1}</span>
                <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0" onClick={() => { setEditId(c.id); setName(c.name); }}>
                  <Pencil size={12} />
                </Button>
                <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 text-destructive h-7 w-7 p-0" onClick={() => deleteMut.mutate(c.id)}>
                  <Trash2 size={12} />
                </Button>
              </>
            )}
          </div>
        ))}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>New Formula Category</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Name" value={name} onChange={e => setName(e.target.value)} data-testid="input-category-name" />
            <Button className="w-full" disabled={!name || createMut.isPending} onClick={() => createMut.mutate({ name, sortOrder: categories.length })} data-testid="button-create-category">
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
