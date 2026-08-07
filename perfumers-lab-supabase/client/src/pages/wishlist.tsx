import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useState, useRef } from "react";
import { Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { useToast } from "@/hooks/use-toast";
import { postJson, patchJson, deleteJson } from "@/lib/api";

export default function WishlistPage() {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const { data: items = [] } = useQuery<any[]>({ queryKey: ["/api/wishlist-materials"] });

  const createMut = useMutation({
    mutationFn: () => postJson("/api/wishlist-materials", { name: "New wishlist item" }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/wishlist-materials"] });
      setSelectedId(data.id);
    },
    onError: () => toast({ title: "Failed to create wishlist item", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteJson(`/api/wishlist-materials/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wishlist-materials"] });
      if (selectedId === deleteConfirmId) setSelectedId(null);
      setDeleteConfirmId(null);
      toast({ title: "Wishlist item deleted" });
    },
    onError: () => toast({ title: "Failed to delete wishlist item", variant: "destructive" }),
  });

  const sorted = [...items].sort((a: any, b: any) =>
    String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" })
  );

  const visible = sorted.filter((w: any) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      String(w.name || "").toLowerCase().includes(q) ||
      String(w.description || "").toLowerCase().includes(q)
    );
  });

  const selected = items.find((w: any) => w.id === selectedId);

  return (
    <div className="panel-layout h-full">
      {/* Left panel */}
      <div className={`border-r border-border flex-col h-full overflow-hidden ${selectedId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-3 pl-12 md:pl-3 border-b border-border flex items-center gap-2">
          <h2 className="text-sm font-semibold flex-1">Wishlist</h2>
          <Button size="sm" variant="ghost" onClick={() => createMut.mutate()} disabled={createMut.isPending} data-testid="button-add-wishlist" title="Add wishlist item">
            <Plus size={14} />
          </Button>
        </div>
        <div className="px-3 py-2">
          <Input placeholder="Filter..." value={filter} onChange={e => setFilter(e.target.value)} className="h-7 text-xs" data-testid="input-filter-wishlist" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {visible.map((w: any) => (
            <WishlistListItem
              key={w.id}
              w={w}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onDeleteRequest={setDeleteConfirmId}
            />
          ))}
          {visible.length === 0 && (
            <div className="px-3 py-4 text-xs text-muted-foreground">
              {items.length === 0 ? "No wishlist items yet." : "No matches."}
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
            <WishlistDetail item={selected} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Select a wishlist item</div>
        )}
      </div>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete wishlist item</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-2">
            Are you sure you want to delete{" "}
            <span className="font-medium text-foreground">
              "{items.find((w: any) => w.id === deleteConfirmId)?.name}"
            </span>
            ? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => { if (deleteConfirmId) deleteMut.mutate(deleteConfirmId); }}
              disabled={deleteMut.isPending}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WishlistDetail({ item }: { item: any }) {
  const { toast } = useToast();
  const [name, setName] = useState(item.name || "");
  const [description, setDescription] = useState(item.description || "");
  const [nameDirty, setNameDirty] = useState(false);
  const [descDirty, setDescDirty] = useState(false);

  // Reset on item change
  const [prevId, setPrevId] = useState(item.id);
  if (item.id !== prevId) {
    setPrevId(item.id);
    setName(item.name || "");
    setDescription(item.description || "");
    setNameDirty(false);
    setDescDirty(false);
  }

  const updateMut = useMutation({
    mutationFn: (data: any) => patchJson(`/api/wishlist-materials/${item.id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/wishlist-materials"] }),
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const saveName = () => {
    if (!nameDirty) return;
    setNameDirty(false);
    updateMut.mutate({ name: name.trim() || "Untitled" });
  };

  const saveDescription = () => {
    if (!descDirty) return;
    setDescDirty(false);
    updateMut.mutate({ description });
  };

  return (
    <div className="p-5 max-w-2xl">
      {/* Name */}
      <div className="pb-4">
        <p className="text-xs text-muted-foreground mb-2">Name</p>
        <Input
          value={name}
          onChange={e => { setName(e.target.value); setNameDirty(true); }}
          onBlur={saveName}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
          placeholder="Material name..."
          className="text-sm"
          data-testid="input-wishlist-name"
        />
      </div>

      {/* Description */}
      <div className="border-t border-border/50 pt-4 pb-4">
        <p className="text-xs text-muted-foreground mb-2">Description</p>
        <Textarea
          value={description}
          onChange={e => { setDescription(e.target.value); setDescDirty(true); }}
          onBlur={saveDescription}
          placeholder="Why you want it, supplier ideas, notes..."
          rows={12}
          className="text-sm resize-none"
          data-testid="textarea-wishlist-description"
        />
        {(descDirty || nameDirty) && <p className="text-[10px] text-muted-foreground mt-1">Unsaved — click outside to save</p>}
      </div>
    </div>
  );
}

function WishlistListItem({ w, selectedId, onSelect, onDeleteRequest }: {
  w: any;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDeleteRequest: (id: string) => void;
}) {
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
              ${selectedId === w.id ? 'bg-[hsl(183,70%,36%)]/10 text-[hsl(183,70%,50%)]' : 'text-foreground/80'}`}
            style={{ transform: showDelete ? 'translateX(-80px)' : 'translateX(0)', transition: 'transform 0.2s ease' }}
            onClick={() => { if (showDelete) { setShowDelete(false); } else { onSelect(w.id); } }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            data-testid={`wishlist-item-${w.id}`}
          >
            <span className="truncate flex-1">{w.name}</span>
          </div>
          {showDelete && (
            <button
              className="absolute right-0 top-0 h-full w-20 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center justify-center"
              onClick={(e) => { e.stopPropagation(); onDeleteRequest(w.id); setShowDelete(false); }}
            >
              Delete
            </button>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="bg-card border-border">
        <ContextMenuItem
          className="text-red-500 focus:text-red-500 focus:bg-red-500/10 cursor-pointer"
          onClick={() => onDeleteRequest(w.id)}
        >
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
