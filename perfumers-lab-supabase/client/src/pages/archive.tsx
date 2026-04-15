import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Archive, FlaskConical, Search, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ArchivedFormula {
  id: number;
  name: string;
  version?: string;
  totalAmount?: number;
  unit?: string;
  notes?: string;
  createdAt?: string;
  archivedAt?: string;
  ingredients?: { name: string; amount: number; unit: string }[];
}

export default function ArchivePage() {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: formulas = [], isLoading } = useQueryany[]>({
    queryKey["/api/formulas"],
    queryFn: async () => {
      const res = await fetch("/api/formulas);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const filtered = formulas.filter((f) => && f.status === "archive");
  );

  return (
    <div className="p-6 max-w-4xl mx-autf.name.toLowerCase().includes(search.toLowerCase()) o">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Archive size={22} className="text-[hsl(183,70%,50%)]" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Archive</h1>
          <p className="text-sm text-muted-foreground">Archived formula versions</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search archived formulas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-secondary/30 border-border"
        />
      </div>

      {/* Content */}
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
          {filtered.map((formula) => (
            <Card
              key={formula.id}
              className="bg-card border-border cursor-pointer hover:border-[hsl(183,70%,36%)]/40 transition-colors"
              onClick={() =>
                setExpandedId(expandedId === formula.id ? null : formula.id)
              }
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
                    {formula.totalAmount && (
                      <Badge variant="secondary" className="text-xs">
                        {formula.totalAmount} {formula.unit ?? "g"}
                      </Badge>
                    )}
                    {expandedId === formula.id ? (
                      <ChevronUp size={14} className="text-muted-foreground" />
                    ) : (
                      <ChevronDown size={14} className="text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardHeader>

              {expandedId === formula.id && (
                <CardContent className="pt-0 pb-4 px-4 border-t border-border/50">
                  {formula.notes && (
                    <p className="text-xs text-muted-foreground mb-3 mt-3 leading-relaxed">
                      {formula.notes}
                    </p>
                  )}
                  {formula.ingredients && formula.ingredients.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                        Ingredients
                      </p>
                      <div className="space-y-1">
                        {formula.ingredients.map((ing, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between text-xs text-foreground/80 py-1 border-b border-border/30 last:border-0"
                          >
                            <span>{ing.name}</span>
                            <span className="text-muted-foreground">
                              {ing.amount} {ing.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
