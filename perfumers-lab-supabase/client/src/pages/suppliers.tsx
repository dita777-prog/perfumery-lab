import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { Plus, Star, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { postJson, fmtNum } from "@/lib/api";

export default function SuppliersPage() {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: suppliers = [] } = useQuery<any[]>({ queryKey: ["/api/suppliers"] });
  const { data: allSources = [] } = useQuery<any[]>({ queryKey: ["/api/material-sources"] });
  const { data: materials = [] } = useQuery<any[]>({ queryKey: ["/api/materials"] });

  const selected = suppliers.find((s: any) => s.id === selectedId);
  const supplierSources = allSources.filter((s: any) => s.supplierId === selectedId);

  return (
    <div className="panel-layout h-full">
      <div className="border-r border-border flex flex-col h-full overflow-hidden">
        <div className="p-3 border-b border-border flex items-center gap-2">
          <h2 className="text-sm font-semibold flex-1">Suppliers</h2>
          <Button size="sm" variant="ghost" onClick={() => setShowCreate(true)} data-testid="button-add-supplier">
            <Plus size={14} />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {suppliers.map((s: any) => (
            <div key={s.id}
              className={`px-3 py-2 cursor-pointer hover:bg-secondary/50 border-b border-border/30
                ${selectedId === s.id ? 'bg-[hsl(183,70%,36%)]/10' : ''}`}
              onClick={() => setSelectedId(s.id)}
              data-testid={`supplier-item-${s.id}`}
            >
              <p className="text-sm font-medium">{s.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {s.country && <span className="text-[10px] text-muted-foreground">{s.country}</span>}
                {s.reliabilityScore && (
                  <span className="text-[10px] text-yellow-500 flex items-center gap-0.5">
                    <Star size={8} fill="currentColor" /> {s.reliabilityScore}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <div className="p-6 max-w-3xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-xl font-semibold">{selected.name}</h1>
                {selected.website && (
                  <a href={selected.website} target="_blank" rel="noopener noreferrer" className="text-xs text-[hsl(183,70%,50%)] flex items-center gap-1 mt-1">
                    <Globe size={10} /> {selected.website}
                  </a>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <InfoCard label="Country" value={selected.country} />
              <InfoCard label="Speciality" value={selected.speciality} />
              <InfoCard label="Avg delivery" value={selected.avgDeliveryDays ? `${selected.avgDeliveryDays} days` : null} />
              <InfoCard label="Min order" value={selected.minOrderValue ? `€ ${fmtNum(selected.minOrderValue)}` : null} />
              <InfoCard label="Reliability" value={selected.reliabilityScore ? `${selected.reliabilityScore}/5` : null} />
              <InfoCard label="Quality" value={selected.qualityScore ? `${selected.qualityScore}/5` : null} />
            </div>

            <h3 className="text-sm font-semibold mb-3">Linked Materials ({supplierSources.length})</h3>
            <div className="space-y-2">
              {supplierSources.map((src: any) => {
                const mat = materials.find((m: any) => m.id === src.materialId);
                return (
                  <div key={src.id} className="bg-card rounded-lg p-3 border border-border flex justify-between items-center">
                    <span className="text-sm">{mat?.name || "Unknown"}</span>
                    <div className="text-right">
                      <span className="text-sm font-mono">€ {fmtNum(src.pricePerGram)}/g</span>
                      <span className="text-xs text-muted-foreground ml-3">{fmtNum(src.stockGrams)} g</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {selected.notes && (
              <div className="mt-6 bg-card rounded-lg p-4 border border-border">
                <h3 className="text-xs font-semibold text-muted-foreground mb-2">Notes</h3>
                <p className="text-sm">{selected.notes}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Select a supplier
          </div>
        )}
      </div>

      <CreateSupplierDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-card rounded-lg p-3 border border-border">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <p className="text-sm mt-0.5">{value || "—"}</p>
    </div>
  );
}

function CreateSupplierDialog({ open, onOpenChange }: any) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [website, setWebsite] = useState("");

  const mutation = useMutation({
    mutationFn: (data: any) => postJson("/api/suppliers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      onOpenChange(false);
      setName(""); setCountry(""); setWebsite("");
      toast({ title: "Supplier created" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader><DialogTitle>New Supplier</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Name" value={name} onChange={e => setName(e.target.value)} data-testid="input-supplier-name" />
          <Input placeholder="Country" value={country} onChange={e => setCountry(e.target.value)} />
          <Input placeholder="Website" value={website} onChange={e => setWebsite(e.target.value)} />
          <Button className="w-full" disabled={!name || mutation.isPending} onClick={() => mutation.mutate({ name, country: country || null, website: website || null })} data-testid="button-create-supplier">
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
