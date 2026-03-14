# Perfumer's Lab — Drip of Infinity

Formulační aplikace pro nezávislé parfuméry. React frontend + Supabase (PostgreSQL) databáze, nasaditelná na Vercel.

## Architektura

- **Frontend:** React 18, Vite, Tailwind CSS, shadcn/ui, TanStack Query
- **Databáze:** Supabase (PostgreSQL) — přímé volání z klienta přes `@supabase/supabase-js`
- **Hosting:** Vercel (statické SPA + rewrites)
- **Bez backendu** — Express server byl odstraněn, veškerá komunikace jde přímo frontend → Supabase

---

## Krok 1: Supabase — vytvoření projektu a databáze

1. Jdi na [supabase.com](https://supabase.com) a vytvoř nový projekt (free tier stačí)
2. Po vytvoření projektu otevři **SQL Editor** v levém menu
3. Zkopíruj obsah souboru `supabase/migrations/001_init.sql` a vlož ho do SQL Editoru
4. Klikni **Run** — vytvoří se všech 15 tabulek, triggery a RPC funkce
5. V **Project Settings → API** si zkopíruj:
   - **Project URL** (např. `https://xyzxyz.supabase.co`)
   - **anon public key** (dlouhý JWT token)

### Důležité nastavení v Supabase

V **Table Editor** zkontroluj, že je pro všechny tabulky vypnutý **RLS** (Row Level Security):
- Klikni na každou tabulku → tři tečky → **Disable RLS**
- Případně v SQL Editoru spusť:
```sql
ALTER TABLE olfactive_families DISABLE ROW LEVEL SECURITY;
ALTER TABLE formula_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE materials DISABLE ROW LEVEL SECURITY;
ALTER TABLE material_sources DISABLE ROW LEVEL SECURITY;
ALTER TABLE material_ifra_limits DISABLE ROW LEVEL SECURITY;
ALTER TABLE material_dilutions DISABLE ROW LEVEL SECURITY;
ALTER TABLE formulas DISABLE ROW LEVEL SECURITY;
ALTER TABLE formula_ingredients DISABLE ROW LEVEL SECURITY;
ALTER TABLE tests DISABLE ROW LEVEL SECURITY;
ALTER TABLE decisions DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_price_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE attachments DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;
```

---

## Krok 2: Lokální vývoj

```bash
# Nainstaluj závislosti
npm install

# Vytvoř soubor .env v kořenu projektu
cp .env.example .env

# Uprav .env — doplň svoje Supabase údaje:
# VITE_SUPABASE_URL=https://tvuj-projekt.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJhbGci...tvuj-anon-key

# Spusť vývojový server
npm run dev
```

Aplikace poběží na `http://localhost:5173`

---

## Krok 3: Nasazení na Vercel

### Varianta A: Přes Vercel Dashboard (doporučeno)

1. Nahraj projekt na GitHub (nebo GitLab/Bitbucket)
2. Jdi na [vercel.com](https://vercel.com) a klikni **New Project**
3. Importuj svůj repozitář
4. V **Environment Variables** přidej:
   - `VITE_SUPABASE_URL` = tvoje Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = tvůj anon key
5. Klikni **Deploy**

### Varianta B: Přes Vercel CLI

```bash
# Nainstaluj Vercel CLI
npm i -g vercel

# Přihlaš se
vercel login

# Nasaď (nastaví env proměnné při prvním deployi)
vercel --prod
```

Při deploymentu Vercel automaticky:
- Spustí `npm run build` (Vite build)
- Servíruje obsah ze složky `dist/`
- Všechny cesty přesměruje na `index.html` (SPA routing)

---

## Struktura projektu

```
perfumery/
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/      # shadcn/ui komponenty
│   │   ├── hooks/           # React hooks
│   │   ├── lib/
│   │   │   ├── supabase.ts  # Supabase klient
│   │   │   ├── queryClient.ts # TanStack Query → Supabase adapter
│   │   │   ├── api.ts       # CRUD operace (postJson, patchJson, deleteJson)
│   │   │   └── utils.ts     # Utility funkce
│   │   ├── pages/           # Stránky aplikace
│   │   ├── App.tsx          # Router + sidebar
│   │   └── main.tsx         # Entry point
│   ├── public/              # Statické soubory (logo, favicon, manifest)
│   └── index.html
├── shared/
│   └── schema.ts            # TypeScript typy (sdílené)
├── supabase/
│   └── migrations/
│       └── 001_init.sql     # SQL migrace — všech 15 tabulek
├── .env.example             # Vzor env proměnných
├── vercel.json              # Vercel konfigurace
├── vite.config.ts           # Vite konfigurace
├── package.json
└── README.md
```

---

## Jak to funguje

### Čtení dat (queries)
`queryClient.ts` obsahuje defaultní `queryFn`, která mapuje queryKey na Supabase dotazy:
- `["/api/materials"]` → `supabase.from("materials").select("*")`
- `["/api/materials", id, "dilutions"]` → `supabase.from("material_dilutions").select("*").eq("source_material_id", id)`

### Zápis dat (mutations)
`api.ts` obsahuje `postJson`, `patchJson`, `deleteJson`, které parsují URL a volají Supabase:
- `postJson("/api/materials", data)` → `supabase.from("materials").insert(data)`
- `patchJson("/api/materials/123", data)` → `supabase.from("materials").update(data).eq("id", "123")`

### Speciální operace
- **Duplikace vzorce:** Supabase RPC funkce `duplicate_formula`
- **Stock movements:** Databázový trigger automaticky aktualizuje `stock_grams`
- **Mazání kategorie:** Trigger nastaví `category_id = NULL` u všech vzorců
- **Řazení:** Reorder endpointy aktualizují `sort_order` pro jednotlivé záznamy
- **Vyhledávání:** Klientský dotaz s `ilike` přes tabulky materials, formulas, decisions

---

## Poznámky

- Supabase vrací sloupce v `snake_case`, adaptér je automaticky převádí na `camelCase`
- Data se posílají z klienta v `camelCase` a převádí se na `snake_case` před vložením
- RLS je momentálně vypnutý (jednouživatelská aplikace) — při přidání autentizace zapni RLS a nastav politiky
- Aplikace startuje s prázdnými daty — materiály, vzorce a kategorie přidáváš ručně
