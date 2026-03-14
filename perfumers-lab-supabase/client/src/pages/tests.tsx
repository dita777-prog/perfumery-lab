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
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { postJson } from "@/lib/api";

export default function TestsPage() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);

  const { data: tests = [] } = useQuery<any[]>({ queryKey: ["/api/tests"] });
  const { data: formulas = [] } = useQuery<any[]>({ queryKey: ["/api/formulas"] });

  const getFormulaName = (id: string | null) => formulas.find((f: any) => f.id === id)?.name || "—";

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Tests</h1>
        <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-add-test">
          <Plus size={14} className="mr-1" /> New Test
        </Button>
      </div>

      <div className="space-y-3">
        {tests.map((t: any) => (
          <div key={t.id} className="bg-card rounded-lg border border-border p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-sm font-medium">{getFormulaName(t.formulaId)}</p>
                <p className="text-xs text-muted-foreground">
                  v{t.formulaVersion || "?"} · {t.medium || "—"} · {t.testDate ? new Date(t.testDate).toLocaleDateString() : "—"}
                </p>
              </div>
              {t.decision && <Badge variant={t.decision === "approved" ? "default" : "secondary"}>{t.decision}</Badge>}
            </div>

            <div className="grid grid-cols-3 gap-4 mb-3">
              <ScoreBar label="Intensity" value={t.intensity} />
              <ScoreBar label="Throw" value={t.throwDiffusion} />
              <ScoreBar label="Longevity" value={t.longevity} />
            </div>

            {t.cureTimeHours && <p className="text-xs text-muted-foreground">Cure: {t.cureTimeHours}h</p>}
            {t.macerationTimeHours && <p className="text-xs text-muted-foreground">Maceration: {t.macerationTimeHours}h</p>}

            {t.whatWasWrong && (
              <div className="mt-2 bg-red-900/10 rounded p-2">
                <span className="text-[10px] text-red-400 font-semibold">What was wrong</span>
                <p className="text-xs mt-0.5">{t.whatWasWrong}</p>
              </div>
            )}
            {t.whatToTryNext && (
              <div className="mt-2 bg-blue-900/10 rounded p-2">
                <span className="text-[10px] text-blue-400 font-semibold">What to try next</span>
                <p className="text-xs mt-0.5">{t.whatToTryNext}</p>
              </div>
            )}
            {t.notes && <p className="text-xs text-muted-foreground mt-2">{t.notes}</p>}
          </div>
        ))}
        {tests.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No tests yet</p>
        )}
      </div>

      <CreateTestDialog open={showCreate} onOpenChange={setShowCreate} formulas={formulas} />
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  if (!value) return <div className="text-xs text-muted-foreground">{label}: —</div>;
  return (
    <div>
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-secondary rounded-full h-1.5 overflow-hidden">
          <div className="h-full bg-[hsl(183,70%,36%)] rounded-full" style={{ width: `${value * 10}%` }} />
        </div>
        <span className="text-xs font-mono w-4">{value}</span>
      </div>
    </div>
  );
}

function CreateTestDialog({ open, onOpenChange, formulas }: any) {
  const { toast } = useToast();
  const [formulaId, setFormulaId] = useState("");
  const [medium, setMedium] = useState("");
  const [intensity, setIntensity] = useState(5);
  const [throwVal, setThrowVal] = useState(5);
  const [longevity, setLongevity] = useState(5);
  const [wrong, setWrong] = useState("");
  const [tryNext, setTryNext] = useState("");
  const [decision, setDecision] = useState("");

  const mutation = useMutation({
    mutationFn: (data: any) => postJson("/api/tests", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
      onOpenChange(false);
      toast({ title: "Test recorded" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader><DialogTitle>New Test</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          <Select value={formulaId} onValueChange={setFormulaId}>
            <SelectTrigger><SelectValue placeholder="Formula" /></SelectTrigger>
            <SelectContent>
              {formulas.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={medium} onValueChange={setMedium}>
            <SelectTrigger><SelectValue placeholder="Medium" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="skin">Skin</SelectItem>
              <SelectItem value="paper">Paper strip</SelectItem>
              <SelectItem value="candle">Candle</SelectItem>
              <SelectItem value="wax_melt">Wax melt</SelectItem>
              <SelectItem value="diffuser">Diffuser</SelectItem>
              <SelectItem value="nebulizer">Nebulizer</SelectItem>
            </SelectContent>
          </Select>
          <div>
            <label className="text-xs text-muted-foreground">Intensity: {intensity}</label>
            <Slider value={[intensity]} onValueChange={v => setIntensity(v[0])} min={1} max={10} step={1} className="mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Throw/Diffusion: {throwVal}</label>
            <Slider value={[throwVal]} onValueChange={v => setThrowVal(v[0])} min={1} max={10} step={1} className="mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Longevity: {longevity}</label>
            <Slider value={[longevity]} onValueChange={v => setLongevity(v[0])} min={1} max={10} step={1} className="mt-1" />
          </div>
          <Textarea placeholder="What was wrong?" value={wrong} onChange={e => setWrong(e.target.value)} rows={2} />
          <Textarea placeholder="What to try next?" value={tryNext} onChange={e => setTryNext(e.target.value)} rows={2} />
          <Select value={decision} onValueChange={setDecision}>
            <SelectTrigger><SelectValue placeholder="Decision" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="iterate">Iterate</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="archive">Archive</SelectItem>
            </SelectContent>
          </Select>
          <Button className="w-full" disabled={!formulaId || mutation.isPending} onClick={() => mutation.mutate({
            formulaId, medium: medium || null, intensity, throwDiffusion: throwVal, longevity,
            whatWasWrong: wrong || null, whatToTryNext: tryNext || null, decision: decision || null,
            formulaVersion: formulas.find((f: any) => f.id === formulaId)?.version || 1,
          })} data-testid="button-create-test">
            Record Test
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
