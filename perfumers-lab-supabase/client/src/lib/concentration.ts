/**
 * Pure concentration / solvent math for a formula.
 *
 * Kept free of any side-effecting imports (no supabase, no queryClient) so it
 * can be unit-tested in isolation. api.ts re-exports everything here for
 * backwards compatibility with existing `@/lib/api` imports.
 */
import type { Material, FormulaIngredient } from "@shared/schema";
import { neatGramsOf, weighedGramsOf } from "./dilution";

// Subset of FormulaIngredient fields the solvent helpers actually read.
// Accepting a partial shape keeps the helpers usable with preview objects
// (which may not carry every DB field) without resorting to `any`.
export type SolventIngredient = Pick<
  FormulaIngredient,
  "materialId" | "gramsAsWeighed" | "neatGrams" | "percentInFormula"
> & { id?: string; [key: string]: unknown };

export type MassSplit = {
  aromaticNeat: number;
  solventNeat: number;
  aromaticWeighed: number;
  solventWeighed: number;
  // Solvent carried inside aromatic dilutions (Σ max(0, weighed − neat) over
  // non-solvent rows). This is the solvent you already have but never weighed
  // out separately — e.g. the 0.9 g of carrier in 1 g of a 10% dilution.
  aromaticDilutionSolvent: number;
};

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

// ─── Solvent-awareness helpers ──────────────────────────────────
// A single source of truth for "is this ingredient a solvent?" — reads
// treatAsSolvent off the material the ingredient points to.
export function isSolventIngredient(
  ing: SolventIngredient | null | undefined,
  materials: Material[],
): boolean {
  if (!ing?.materialId) return false;
  const mat = materials?.find((m) => m.id === ing.materialId);
  return !!mat?.treatAsSolvent;
}

function ingNeat(ing: SolventIngredient): number {
  return neatGramsOf(ing);
}

function ingWeighed(ing: SolventIngredient): number {
  return weighedGramsOf(ing);
}

// Sum masses split by solvent flag. neatGramsOf falls back to weighed grams
// for undiluted materials, and derives from the persisted neatGrams for
// diluted rows (10%, 1%, 0.1%, 50%, …).
export function splitAromaticSolventMass(
  ingredients: SolventIngredient[],
  materials: Material[],
): MassSplit {
  let aromaticNeat = 0;
  let solventNeat = 0;
  let aromaticWeighed = 0;
  let solventWeighed = 0;
  let aromaticDilutionSolvent = 0;
  for (const ing of ingredients) {
    const neat = ingNeat(ing);
    const weighed = ingWeighed(ing);
    if (isSolventIngredient(ing, materials)) {
      solventNeat += neat;
      solventWeighed += weighed;
    } else {
      aromaticNeat += neat;
      aromaticWeighed += weighed;
      aromaticDilutionSolvent += Math.max(0, weighed - neat);
    }
  }
  return { aromaticNeat, solventNeat, aromaticWeighed, solventWeighed, aromaticDilutionSolvent };
}

// Total solvent mass in the formula: solvent hidden inside aromatic dilutions
// (weighed − neat, clamped per row) plus any explicit solvent rows weighed out
// on their own.
export function formulaSolventGrams(split: MassSplit): number {
  return split.aromaticDilutionSolvent + split.solventWeighed;
}

// Actual (live) concentration = pure aromatic mass / total weighed mass × 100.
// Using total weighed as the denominator counts BOTH explicit solvent rows and
// the solvent carried inside dilutions, so an all-10%-dilution formula reads
// 10%, not 100%.
export function calcConcentratePercent(
  ingredients: SolventIngredient[],
  materials: Material[],
): number {
  const { aromaticNeat, aromaticWeighed, solventWeighed } = splitAromaticSolventMass(ingredients, materials);
  const totalWeighed = aromaticWeighed + solventWeighed;
  if (totalWeighed <= 0) return 0;
  return (aromaticNeat / totalWeighed) * 100;
}

// ─── Neat composition (100% aromatic view) ──────────────────────
// A material whose name encodes a commercial dilution — e.g.
// "Galaxolide 50% DPG", "Iso E Super 10%". These CANNOT be made physically
// neat (you can't remove the carrier), so a "neat view" must flag them rather
// than silently pretend the weighed mass is pure aromatic.
const COMMERCIAL_DILUTION_NAME = /\d+(?:[.,]\d+)?\s*%/;

export function isCommercialDilutionMaterial(mat: Material | null | undefined): boolean {
  const name = (mat as { name?: string } | null | undefined)?.name;
  return typeof name === "string" && COMMERCIAL_DILUTION_NAME.test(name);
}

export type NeatCompositionRow = {
  id?: string;
  materialId: string | null;
  name: string;
  neatGrams: number;
  // Share of the total neat aromatic mass, renormalised to 100%.
  neatPercent: number;
  // Source material is inherently a commercial dilution — the carrier can't be
  // removed, so treating this row as "neat" is a lie the UI should surface.
  isCommercialDilution: boolean;
};

/**
 * Non-destructive projection of a formula onto its 100%-neat aromatic
 * composition. Drops solvent (explicit rows and dilution carrier), keeps only
 * pure aromatic mass per row, and renormalises to 100%. Rows whose source
 * material is a commercial dilution are flagged so a caller can warn the user
 * instead of overwriting them. This computes a *view* — it never mutates the
 * passed ingredients.
 */
export function computeNeatComposition(
  ingredients: SolventIngredient[],
  materials: Material[],
): { rows: NeatCompositionRow[]; totalNeat: number } {
  const aromatic = ingredients.filter((ing) => !isSolventIngredient(ing, materials));
  const totalNeat = aromatic.reduce((sum, ing) => sum + neatGramsOf(ing), 0);
  const rows = aromatic.map((ing) => {
    const mat = materials?.find((m) => m.id === ing.materialId);
    const neat = neatGramsOf(ing);
    return {
      id: ing.id,
      materialId: ing.materialId ?? null,
      name: (mat as { name?: string } | undefined)?.name ?? "Unknown",
      neatGrams: neat,
      neatPercent: totalNeat > 0 ? (neat / totalNeat) * 100 : 0,
      isCommercialDilution: isCommercialDilutionMaterial(mat),
    };
  });
  return { rows, totalNeat };
}
