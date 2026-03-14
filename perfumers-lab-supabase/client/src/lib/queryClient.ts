import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { supabase } from "./supabase";

/**
 * Route table: maps API path patterns to Supabase table queries.
 * queryKey arrays like ["/api/materials"] or ["/api/materials", id, "dilutions"]
 * are joined and matched against these patterns.
 *
 * IMPORTANT: Supabase returns snake_case columns. We convert to camelCase
 * so page components keep working with .materialId, .gramsAsWeighed, etc.
 */

function throwSupabaseError(error: any, context: string) {
  if (error) throw new Error(`Supabase error (${context}): ${error.message}`);
}

/** Convert snake_case keys to camelCase */
function toCamelCase(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (typeof obj !== "object") return obj;
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = value !== null && typeof value === "object" ? toCamelCase(value) : value;
  }
  return result;
}

/** Parse queryKey into a supabase query. Returns camelCase data. */
async function supabaseQueryFromKey(queryKey: readonly unknown[]): Promise<any> {
  const parts = queryKey.map(String);
  const path = parts[0] as string;
  const segment1 = parts[1]; // usually an ID
  const segment2 = parts[2]; // usually a sub-resource name

  // === Nested: /api/materials/:id/dilutions ===
  if (path === "/api/materials" && segment1 && segment2 === "dilutions") {
    const { data, error } = await supabase
      .from("material_dilutions")
      .select("*")
      .eq("source_material_id", segment1)
      .order("created_at", { ascending: true });
    throwSupabaseError(error, "material dilutions");
    return toCamelCase(data);
  }

  // === Nested: /api/materials/:id/ifra-limits ===
  if (path === "/api/materials" && segment1 && segment2 === "ifra-limits") {
    const { data, error } = await supabase
      .from("material_ifra_limits")
      .select("*")
      .eq("material_id", segment1)
      .order("updated_at", { ascending: false });
    throwSupabaseError(error, "ifra limits");
    return toCamelCase(data);
  }

  // === Nested: /api/materials/:id/sources ===
  if (path === "/api/materials" && segment1 && segment2 === "sources") {
    const { data, error } = await supabase
      .from("material_sources")
      .select("*")
      .eq("material_id", segment1)
      .order("created_at", { ascending: true });
    throwSupabaseError(error, "material sources");
    return toCamelCase(data);
  }

  // === Nested: /api/formulas/:id/ingredients ===
  if (path === "/api/formulas" && segment1 && segment2 === "ingredients") {
    const { data, error } = await supabase
      .from("formula_ingredients")
      .select("*")
      .eq("formula_id", segment1)
      .order("sort_order", { ascending: true });
    throwSupabaseError(error, "formula ingredients");
    return toCamelCase(data);
  }

  // === Simple table queries ===
  const tableMap: Record<string, { table: string; order?: [string, { ascending: boolean }] }> = {
    "/api/olfactive-families": { table: "olfactive_families", order: ["sort_order", { ascending: true }] },
    "/api/formula-categories": { table: "formula_categories", order: ["sort_order", { ascending: true }] },
    "/api/suppliers": { table: "suppliers", order: ["created_at", { ascending: false }] },
    "/api/materials": { table: "materials", order: ["name", { ascending: true }] },
    "/api/material-sources": { table: "material_sources", order: ["created_at", { ascending: false }] },
    "/api/dilutions": { table: "material_dilutions", order: ["created_at", { ascending: true }] },
    "/api/formulas": { table: "formulas", order: ["updated_at", { ascending: false }] },
    "/api/formula-ingredients": { table: "formula_ingredients", order: ["sort_order", { ascending: true }] },
    "/api/tests": { table: "tests", order: ["test_date", { ascending: false }] },
    "/api/decisions": { table: "decisions", order: ["date", { ascending: false }] },
    "/api/stock-movements": { table: "stock_movements", order: ["date", { ascending: false }] },
    "/api/supplier-price-history": { table: "supplier_price_history", order: ["date_recorded", { ascending: false }] },
    "/api/audit-log": { table: "audit_log", order: ["created_at", { ascending: false }] },
  };

  const mapping = tableMap[path];
  if (mapping) {
    let query = supabase.from(mapping.table).select("*");
    if (mapping.order) {
      query = query.order(mapping.order[0], mapping.order[1]);
    }
    const { data, error } = await query;
    throwSupabaseError(error, mapping.table);
    return toCamelCase(data);
  }

  // === Single record: /api/suppliers/:id, /api/formulas/:id, /api/materials/:id, /api/dilutions/:id ===
  if (path === "/api/suppliers" && segment1 && !segment2) {
    const { data, error } = await supabase.from("suppliers").select("*").eq("id", segment1).single();
    throwSupabaseError(error, "supplier single");
    return toCamelCase(data);
  }
  if (path === "/api/formulas" && segment1 && !segment2) {
    const { data, error } = await supabase.from("formulas").select("*").eq("id", segment1).single();
    throwSupabaseError(error, "formula single");
    return toCamelCase(data);
  }
  if (path === "/api/materials" && segment1 && !segment2) {
    const { data, error } = await supabase.from("materials").select("*").eq("id", segment1).single();
    throwSupabaseError(error, "material single");
    return toCamelCase(data);
  }
  if (path === "/api/dilutions" && segment1 && !segment2) {
    const { data, error } = await supabase.from("material_dilutions").select("*").eq("id", segment1).single();
    throwSupabaseError(error, "dilution single");
    return toCamelCase(data);
  }

  throw new Error(`Unknown queryKey: ${JSON.stringify(queryKey)}`);
}

const defaultQueryFn: QueryFunction = async ({ queryKey }) => {
  return supabaseQueryFromKey(queryKey);
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: defaultQueryFn,
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Deprecated — search.tsx will use searchAll() from api.ts instead
export async function apiRequest(
  _method: string,
  _url: string,
  _data?: unknown,
): Promise<Response> {
  throw new Error("apiRequest is deprecated — use Supabase client directly");
}
