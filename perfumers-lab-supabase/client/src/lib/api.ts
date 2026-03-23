import { queryClient } from "./queryClient";
import { supabase } from "./supabase";

/**
 * Map /api/... URLs to Supabase table names and handle mutations.
 * The page components call postJson("/api/materials", data) etc.,
 * so we parse the URL and route to the correct Supabase operation.
 *
 * All returned data is camelCase to match existing component expectations.
 */

// URL → table name mapping
const urlToTable: Record<string, string> = {
  "/api/olfactive-families": "olfactive_families",
  "/api/formula-categories": "formula_categories",
  "/api/suppliers": "suppliers",
  "/api/materials": "materials",
  "/api/material-sources": "material_sources",
  "/api/ifra-limits": "material_ifra_limits",
  "/api/dilutions": "material_dilutions",
  "/api/formulas": "formulas",
  "/api/formula-ingredients": "formula_ingredients",
  "/api/tests": "tests",
  "/api/decisions": "decisions",
  "/api/stock-movements": "stock_movements",
  "/api/supplier-price-history": "supplier_price_history",
  "/api/attachments": "attachments",
};

/** Convert camelCase keys to snake_case for Supabase inserts/updates */
function toSnakeCase(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
    result[snakeKey] = value;
  }
  return result;
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

/** Parse a URL like "/api/materials/123" → { basePath, id, extra } */
function parseUrl(url: string): { basePath: string; id?: string; extra?: string } {
  // /api/olfactive-families/reorder or /api/formula-categories/reorder
  if (url.endsWith("/reorder")) {
    const base = url.replace("/reorder", "");
    return { basePath: base, extra: "reorder" };
  }
  // /api/formulas/:id/duplicate
  const dupMatch = url.match(/^(\/api\/formulas)\/([^/]+)\/duplicate$/);
  if (dupMatch) {
    return { basePath: dupMatch[1], id: dupMatch[2], extra: "duplicate" };
  }
  // Standard: /api/something/:id
  const match = url.match(/^(\/api\/[\w-]+)\/([^/]+)$/);
  if (match) {
    return { basePath: match[1], id: match[2] };
  }
  return { basePath: url };
}

// ============ POST (create) ============
export async function postJson<T>(url: string, body: any): Promise<T> {
  const { basePath, id, extra } = parseUrl(url);

  // Special: reorder
  if (extra === "reorder") {
    return handleReorder(basePath, body) as T;
  }

  // Special: duplicate formula
  if (extra === "duplicate" && id) {
    return handleDuplicateFormula(id, body.name) as T;
  }

  const table = urlToTable[basePath];
  if (!table) throw new Error(`postJson: unknown URL ${url}`);

  const snakeBody = toSnakeCase(body);
  const { data, error } = await supabase.from(table).insert(snakeBody).select().single();
  if (error) throw new Error(`Insert ${table}: ${error.message}`);
  return toCamelCase(data) as T;
}

// ============ PATCH (update) ============
export async function patchJson<T>(url: string, body: any): Promise<T> {
  const { basePath, id } = parseUrl(url);
  if (!id) throw new Error(`patchJson: missing ID in ${url}`);

  const table = urlToTable[basePath];
  if (!table) throw new Error(`patchJson: unknown URL ${url}`);

  const snakeBody = toSnakeCase(body);
  // Add updated_at if the table has it
  const tablesWithUpdatedAt = ["materials", "material_sources", "material_dilutions", "formulas", "material_ifra_limits"];
  if (tablesWithUpdatedAt.includes(table)) {
    snakeBody.updated_at = new Date().toISOString();
  }

  const { data, error } = await supabase.from(table).update(snakeBody).eq("id", id).select().single();
  if (error) throw new Error(`Update ${table}: ${error.message}`);
  return toCamelCase(data) as T;
}

// ============ DELETE ============
export async function deleteJson(url: string): Promise<void> {
  const { basePath, id } = parseUrl(url);
  if (!id) throw new Error(`deleteJson: missing ID in ${url}`);

  const table = urlToTable[basePath];
  if (!table) throw new Error(`deleteJson: unknown URL ${url}`);


    // Special: when deleting a formula, first nullify FK references in other tables
  if (table === "formulas" && id) {
    await supabase.from("tests").update({ formula_id: null }).eq("formula_id", id);
    await supabase.from("decisions").update({ related_formula_id: null }).eq("related_formula_id", id);
    await supabase.from("stock_movements").update({ related_formula_id: null }).eq("related_formula_id", id);
    await supabase.from("formula_ingredients").update({ source_formula_id: null }).eq("source_formula_id", id);
        await supabase.from("formulas").update({ parent_formula_id: null }).eq("parent_formula_id", id);
  }
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw new Error(`Delete ${table}: ${error.message}`);
}
  

// ============ Special: Reorder ============
async function handleReorder(basePath: string, body: { ids: string[] }): Promise<any> {
  const table = urlToTable[basePath];
  if (!table) throw new Error(`Reorder: unknown base ${basePath}`);

  for (let i = 0; i < body.ids.length; i++) {
    const { error } = await supabase.from(table).update({ sort_order: i }).eq("id", body.ids[i]);
    if (error) throw new Error(`Reorder ${table}: ${error.message}`);
  }

  const { data, error } = await supabase.from(table).select("*").order("sort_order", { ascending: true });
  if (error) throw new Error(`Reorder fetch ${table}: ${error.message}`);
  return toCamelCase(data);
}

// ============ Special: Duplicate Formula (RPC) ============
async function handleDuplicateFormula(originalId: string, newName: string): Promise<any> {
  const { data: newId, error } = await supabase.rpc("duplicate_formula", {
    original_id: originalId,
    new_name: newName,
  });
  if (error) throw new Error(`Duplicate formula: ${error.message}`);

  const { data: formula, error: fetchErr } = await supabase
    .from("formulas")
    .select("*")
    .eq("id", newId)
    .single();
  if (fetchErr) throw new Error(`Fetch duplicated formula: ${fetchErr.message}`);
  return toCamelCase(formula);
}

// ============ Search (used by search.tsx) ============
export async function searchAll(query: string): Promise<{ materials: any[]; formulas: any[]; decisions: any[] }> {
  const q = `%${query.toLowerCase()}%`;

  const [mResult, fResult, dResult] = await Promise.all([
    supabase.from("materials").select("*").or(`name.ilike.${q},cas_number.ilike.${q},notes_sensory.ilike.${q}`),
    supabase.from("formulas").select("*").or(`name.ilike.${q},formula_notes.ilike.${q}`),
    supabase.from("decisions").select("*").or(`what_was_decided.ilike.${q},why.ilike.${q},category.ilike.${q}`),
  ]);

  return {
    materials: toCamelCase(mResult.data || []),
    formulas: toCamelCase(fResult.data || []),
    decisions: toCamelCase(dResult.data || []),
  };
}

// ============ Formula calculation utilities (unchanged) ============
export function calcNeatGrams(gramsAsWeighed: number, neatMultiplier: number): number {
  return gramsAsWeighed * neatMultiplier;
}

export function calcPercentInFormula(neatGrams: number, totalNeatGrams: number): number {
  if (totalNeatGrams === 0) return 0;
  return (neatGrams / totalNeatGrams) * 100;
}

export function calcNeatMultiplier(dilutionPercent: number): number {
  return dilutionPercent / 100;
}

// Scaling functions
export function scaleToTotalWeight(ingredients: any[], targetWeight: number) {
  const currentTotal = ingredients.reduce((sum, i) => sum + parseFloat(i.gramsAsWeighed || "0"), 0);
  if (currentTotal === 0) return ingredients;
  const factor = targetWeight / currentTotal;
  return ingredients.map(i => ({
    ...i,
    gramsAsWeighed: String((parseFloat(i.gramsAsWeighed || "0") * factor).toFixed(3)),
    neatGrams: String((parseFloat(i.neatGrams || "0") * factor).toFixed(3)),
  }));
}

export function scaleByFactor(ingredients: any[], factor: number) {
  return ingredients.map(i => ({
    ...i,
    gramsAsWeighed: String((parseFloat(i.gramsAsWeighed || "0") * factor).toFixed(3)),
    neatGrams: String((parseFloat(i.neatGrams || "0") * factor).toFixed(3)),
  }));
}

export function scaleToAbsolutePercent(ingredients: any[], finalProductGrams: number, concentrationPercent: number) {
  const concentrateWeight = finalProductGrams * (concentrationPercent / 100);
  const solventWeight = finalProductGrams - concentrateWeight;
  const currentTotal = ingredients.reduce((sum, i) => sum + parseFloat(i.gramsAsWeighed || "0"), 0);
  if (currentTotal === 0) return { ingredients, concentrateWeight, solventWeight };
  const factor = concentrateWeight / currentTotal;
  return {
    ingredients: ingredients.map(i => ({
      ...i,
      gramsAsWeighed: String((parseFloat(i.gramsAsWeighed || "0") * factor).toFixed(3)),
      neatGrams: String((parseFloat(i.neatGrams || "0") * factor).toFixed(3)),
    })),
    concentrateWeight,
    solventWeight,
  };
}

export function scalePercentByFactor(ingredients: any[], currentConcentration: number, factor: number, totalBatchGrams: number) {
  const newConcentration = currentConcentration * factor;
  const concentrateWeight = totalBatchGrams * (newConcentration / 100);
  const solventWeight = totalBatchGrams - concentrateWeight;
  const currentTotal = ingredients.reduce((sum, i) => sum + parseFloat(i.gramsAsWeighed || "0"), 0);
  if (currentTotal === 0) return { ingredients, concentrateWeight, solventWeight, newConcentration };
  const scaleFactor = concentrateWeight / currentTotal;
  return {
    ingredients: ingredients.map(i => ({
      ...i,
      gramsAsWeighed: String((parseFloat(i.gramsAsWeighed || "0") * scaleFactor).toFixed(3)),
      neatGrams: String((parseFloat(i.neatGrams || "0") * scaleFactor).toFixed(3)),
    })),
    concentrateWeight,
    solventWeight,
    newConcentration,
  };
}

// Recalculate all ingredient percentages
export function recalcPercents(ingredients: any[]) {
  const totalNeat = ingredients.reduce((sum, i) => sum + parseFloat(i.neatGrams || i.gramsAsWeighed || "0"), 0);
  return ingredients.map(i => {
    const neat = parseFloat(i.neatGrams || i.gramsAsWeighed || "0");
    return {
      ...i,
      percentInFormula: totalNeat > 0 ? String(((neat / totalNeat) * 100).toFixed(2)) : "0",
    };
  });
}

// Pyramid breakdown
export function calcPyramidBreakdown(ingredients: any[], materials: any[]) {
  const roles: Record<string, number> = { top: 0, high: 0, middle: 0, bottom: 0, base: 0 };
  let total = 0;
  for (const ing of ingredients) {
    const neat = parseFloat(ing.neatGrams || ing.gramsAsWeighed || "0");
    total += neat;
    const mat = materials.find((m: any) => m.id === ing.materialId);
    const role = ing.pyramidRole || mat?.pyramidRole || "middle";
    if (roles[role] !== undefined) roles[role] += neat;
    else roles.middle += neat;
  }
  if (total === 0) return roles;
  return Object.fromEntries(Object.entries(roles).map(([k, v]) => [k, Math.round((v / total) * 100)]));
}

// Olfactive fingerprint
export function calcOlfactiveFingerprint(ingredients: any[], materials: any[], families: any[]) {
  const fingerprint: Record<string, number> = {};
  let total = 0;
  for (const ing of ingredients) {
    const neat = parseFloat(ing.neatGrams || ing.gramsAsWeighed || "0");
    total += neat;
    const mat = materials.find((m: any) => m.id === ing.materialId);
    if (mat?.olfactiveFamilyId) {
      const fam = families.find((f: any) => f.id === mat.olfactiveFamilyId);
      if (fam) {
        fingerprint[fam.name] = (fingerprint[fam.name] || 0) + neat;
      }
    }
  }
  if (total === 0) return {};
  return Object.fromEntries(
    Object.entries(fingerprint)
      .map(([k, v]) => [k, Math.round((v / total) * 100)])
      .sort((a, b) => (b[1] as number) - (a[1] as number))
  );
}

// European number formatting (comma decimal, space thousands)
export function fmtNum(n: string | number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined || n === "") return "—";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(num)) return "—";
  let s = num.toFixed(decimals);
  if (s.includes(".")) {
    s = s.replace(/0+$/, "").replace(/\.$/, "");
  }
  const parts = s.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  return parts.length > 1 ? parts[0] + "," + parts[1] : parts[0];
}

export function fmtGrams(n: string | number | null | undefined): string {
  if (n === null || n === undefined || n === "") return "0,000 g";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(num)) return "0,000 g";
  let s = num.toFixed(3);
  const parts = s.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  return parts[0] + "," + parts[1] + " g";
}

export function fmtPercent(n: string | number | null | undefined): string {
  return fmtNum(n, 2) + " %";
}
