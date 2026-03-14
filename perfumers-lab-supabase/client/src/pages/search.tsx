import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { searchAll } from "@/lib/api";
import { Link } from "wouter";

export default function SearchPage() {
  const [query, setQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/search", query],
    queryFn: async () => {
      if (query.length < 2) return null;
      return searchAll(query);
    },
    enabled: query.length >= 2,
  });

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">Search</h1>
      <div className="relative mb-6">
        <SearchIcon size={16} className="absolute left-3 top-2.5 text-muted-foreground" />
        <Input
          placeholder="Search materials, formulas, decisions..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="pl-9"
          data-testid="input-search"
        />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Searching...</p>}

      {data && (
        <div className="space-y-6">
          {data.materials?.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">MATERIALS ({data.materials.length})</h3>
              <div className="space-y-1">
                {data.materials.map((m: any) => (
                  <div key={m.id} className="bg-card rounded p-2.5 border border-border">
                    <p className="text-sm font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.casNumber} {m.notesSensory ? `· ${m.notesSensory}` : ""}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.formulas?.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">FORMULAS ({data.formulas.length})</h3>
              <div className="space-y-1">
                {data.formulas.map((f: any) => (
                  <Link key={f.id} href={`/formulas/${f.id}`}>
                    <div className="bg-card rounded p-2.5 border border-border cursor-pointer hover:bg-secondary/30">
                      <p className="text-sm font-medium">{f.name}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="secondary" className="text-[10px]">{f.productType}</Badge>
                        <Badge variant="outline" className="text-[10px]">{f.status}</Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {data.decisions?.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">DECISIONS ({data.decisions.length})</h3>
              <div className="space-y-1">
                {data.decisions.map((d: any) => (
                  <div key={d.id} className="bg-card rounded p-2.5 border border-border">
                    <p className="text-sm">{d.whatWasDecided}</p>
                    {d.category && <Badge variant="outline" className="text-[10px] mt-1">{d.category}</Badge>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.materials?.length === 0 && data.formulas?.length === 0 && data.decisions?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No results for "{query}"</p>
          )}
        </div>
      )}

      {!data && query.length < 2 && (
        <p className="text-sm text-muted-foreground text-center py-8">Type at least 2 characters to search</p>
      )}
    </div>
  );
}
