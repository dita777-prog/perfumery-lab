import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { patchJson, fmtNum } from "@/lib/api";

/**
 * Purchase invoices. Freight, VAT and line prices are frozen into the purchase lines when
 * they are saved, so the only thing editable here is the FX rate of a non-EUR invoice that
 * has none yet. Entering it fills the EUR cost of that invoice's lines exactly once.
 */
export default function InvoicesPage() {
  const { data: documents = [] } = useQuery<any[]>({ queryKey: ["/api/purchase-documents"] });
  const { data: sources = [] } = useQuery<any[]>({ queryKey: ["/api/component-sources"] });
  const { data: suppliers = [] } = useQuery<any[]>({ queryKey: ["/api/suppliers"] });

  const supplierById = useMemo(() => new Map(suppliers.map((s: any) => [s.id, s])), [suppliers]);
  const missing = documents.filter((d: any) => d.fxRateToEur == null).length;

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-xl font-semibold mb-1">Purchase invoices</h1>
      <p className="text-xs text-muted-foreground mb-4">
        {missing > 0
          ? `${missing} invoice(s) are waiting for an FX rate to EUR. Enter the rate at the payment date; the EUR cost of the lines is then filled once and stays frozen.`
          : "All invoices have an FX rate."}
      </p>
      <div className="bg-card border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="p-2">Date</th>
              <th className="p-2">Invoice</th>
              <th className="p-2">Supplier</th>
              <th className="p-2">Cur.</th>
              <th className="p-2 text-right">Goods net</th>
              <th className="p-2 text-right">Freight</th>
              <th className="p-2 text-right">VAT %</th>
              <th className="p-2">VAT</th>
              <th className="p-2 text-right">Lines</th>
              <th className="p-2">FX to EUR</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((d: any) => (
              <InvoiceRow key={d.id} doc={d}
                supplier={supplierById.get(d.supplierId)?.name}
                lines={sources.filter((s: any) => s.purchaseDocumentId === d.id).length} />
            ))}
            {documents.length === 0 && (
              <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">No invoices yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InvoiceRow({ doc, supplier, lines }: { doc: any; supplier?: string; lines: number }) {
  const { toast } = useToast();
  const [fx, setFx] = useState("");

  const mutation = useMutation({
    mutationFn: (rate: number) => patchJson(`/api/purchase-documents/${doc.id}`, { fxRateToEur: rate }),
    onSuccess: () => {
      for (const key of ["/api/purchase-documents", "/api/component-sources", "/api/component-cost-current", "/api/product-cost"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      setFx("");
      toast({ title: "FX rate saved", description: "EUR cost of the invoice lines has been filled." });
    },
    onError: (e: any) => toast({ title: "Could not save FX rate", description: e.message, variant: "destructive" }),
  });

  const rate = Number(fx.replace(",", "."));

  return (
    <tr className="border-b border-border/30">
      <td className="p-2 whitespace-nowrap">{doc.documentDate}</td>
      <td className="p-2">{doc.documentNo}</td>
      <td className="p-2">{supplier ?? "—"}</td>
      <td className="p-2">{doc.currency}</td>
      <td className="p-2 text-right font-mono">{fmtNum(doc.goodsSubtotal)}</td>
      <td className="p-2 text-right font-mono">{fmtNum(Number(doc.freightTotal) + Number(doc.otherCharges))}</td>
      <td className="p-2 text-right font-mono">{fmtNum(doc.vatRate)}</td>
      <td className="p-2">
        <Badge variant="outline" className="text-[9px]">
          {doc.vatRecoverable ? "recoverable" : "cost"}
        </Badge>
      </td>
      <td className="p-2 text-right">{lines}</td>
      <td className="p-2">
        {doc.fxRateToEur != null ? (
          <span className="font-mono">{fmtNum(doc.fxRateToEur, 6)}</span>
        ) : (
          <div className="flex gap-1">
            <Input className="h-7 w-28 text-xs" placeholder="e.g. 0.0405" value={fx}
              onChange={e => setFx(e.target.value)} data-testid={`input-fx-${doc.id}`} />
            <Button size="sm" className="h-7" disabled={!(rate > 0) || mutation.isPending}
              onClick={() => mutation.mutate(rate)} data-testid={`button-save-fx-${doc.id}`}>
              Save
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}
