import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { postJson } from "@/lib/api";

export default function DecisionsPage() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState("");

  const { data: decisions = [] } = useQuery<any[]>({ queryKey: ["/api/decisions"] });
  const { data: materials = [] } = useQuery<any[]>({ queryKey: ["/api/materials"] });
  const { data: formulas = [] } = useQuery<any[]>({ queryKey: ["/api/formulas"] });

  const filtered = filter
    ? decisions.filter((d: any) =>
        d.whatWasDecided?.toLowerCase().includes(filter.toLowerCase()) ||
        d.why?.toLowerCase().includes(filter.toLowerCase()) ||
        d.category?.toLowerCase().includes(filter.toLowerCase())
      )
    : decisions;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Decisions</h1>
        <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-add-decision">
          <Plus size={14} className="mr-1" /> New Decision
        </Button>
      </div>
      <Input placeholder="Search decisions..." value={filter} onChange={e => setFilter(e.target.value)} className="mb-4 max-w-sm" data-testid="input-filter-decisions" />

      <div className="space-y-3">
        {filtered.map((d: any) => (
          <div key={d.id} className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                {d.category && <Badge variant="outline">{d.category}</Badge>}
                <span className="text-xs text-muted-foreground">{d.date ? new Date(d.date).toLocaleDateString() : ""}</span>
              </div>
            </div>
            {d.whatWasDecided && (
              <div className="mb-2">
                <span className="text-[10px] text-muted-foreground font-semibold">DECIDED</span>
                <p className="text-sm">{d.whatWasDecided}</p>
              </div>
            )}
            {d.why && (
              <div className="mb-2">
                <span className="text-[10px] text-muted-foreground font-semibold">WHY</span>
                <p className="text-sm text-muted-foreground">{d.why}</p>
              </div>
            )}
            {d.whatWasRejected && (
              <div className="mb-2 bg-red-900/10 rounded p-2">
                <span className="text-[10px] text-red-400 font-semibold">REJECTED</span>
                <p className="text-xs">{d.whatWasRejected}</p>
                {d.whyRejected && <p className="text-xs text-muted-foreground mt-0.5">{d.whyRejected}</p>}
              </div>
            )}
            <div className="flex gap-2 mt-2">
              {d.relatedMaterialId && (
                <Badge variant="secondary" className="text-[10px]">
                  {materials.find((m: any) => m.id === d.relatedMaterialId)?.name || "Material"}
                </Badge>
              )}
              {d.relatedFormulaId && (
                <Badge variant="secondary" className="text-[10px]">
                  {formulas.find((f: any) => f.id === d.relatedFormulaId)?.name || "Formula"}
                </Badge>
              )}
              {d.tags?.map((t: string) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No decisions yet</p>}
      </div>

      <CreateDecisionDialog open={showCreate} onOpenChange={setShowCreate} materials={materials} formulas={formulas} />
    </div>
  );
}

function CreateDecisionDialog({ open, onOpenChange, materials, formulas }: any) {
  const { toast } = useToast();
  const [category, setCategory] = useState("");
  const [decided, setDecided] = useState("");
  const [why, setWhy] = useState("");
  const [rejected, setRejected] = useState("");
  const [whyRejected, setWhyRejected] = useState("");

  const mutation = useMutation({
    mutationFn: (data: any) => postJson("/api/decisions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/decisions"] });
      onOpenChange(false);
      setCategory(""); setDecided(""); setWhy(""); setRejected(""); setWhyRejected("");
      toast({ title: "Decision recorded" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader><DialogTitle>New Decision</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="formula">Formula</SelectItem>
              <SelectItem value="material">Material</SelectItem>
              <SelectItem value="supplier">Supplier</SelectItem>
              <SelectItem value="process">Process</SelectItem>
              <SelectItem value="business">Business</SelectItem>
            </SelectContent>
          </Select>
          <Textarea placeholder="What was decided?" value={decided} onChange={e => setDecided(e.target.value)} rows={2} />
          <Textarea placeholder="Why?" value={why} onChange={e => setWhy(e.target.value)} rows={2} />
          <Textarea placeholder="What was rejected? (optional)" value={rejected} onChange={e => setRejected(e.target.value)} rows={2} />
          {rejected && <Textarea placeholder="Why rejected?" value={whyRejected} onChange={e => setWhyRejected(e.target.value)} rows={2} />}
          <Button className="w-full" disabled={!decided || mutation.isPending} onClick={() => mutation.mutate({
            category: category || null, whatWasDecided: decided, why: why || null,
            whatWasRejected: rejected || null, whyRejected: whyRejected || null,
          })} data-testid="button-create-decision">
            Record
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
