/**
 * Dilution-aware calculation helpers.
 *
 * A formula_ingredient has two mass fields:
 *   - gramsAsWeighed: what you physically weigh on the scale (includes any
 *     carrier/solvent from the dilution).
 *   - neatGrams: the pure aromatic mass after the dilution's concentration
 *     is applied. Equal to gramsAsWeighed for a neat (100%) ingredient.
 *
 * A dilution pointer (ing.dilutionId) references material_dilutions, which
 * stores a neatMultiplier (= dilutionPercent / 100). neatGrams is persisted
 * at the row level whenever gramsAsWeighed or dilutionId changes, so the
 * two fields stay in sync and do not need to be recomputed from the dilution
 * each time they're read.
 */

export type DilutionLike = { id: string; neatMultiplier?: string | null; dilutionPercent?: string | null };
export type IngredientLike = {
  gramsAsWeighed?: string | number | null;
  neatGrams?: string | number | null;
  dilutionId?: string | null;
};

/** Physical batch weight contribution — includes carrier/solvent. */
export function weighedGramsOf(ing: IngredientLike | null | undefined): number {
  const v = parseFloat(String(ing?.gramsAsWeighed ?? "0"));
  return Number.isFinite(v) ? v : 0;
}

/**
 * Pure aromatic mass contribution. Falls back to gramsAsWeighed when neatGrams
 * isn't populated (the case for legacy rows or freshly-created 100% ingredients
 * that haven't had neatGrams persisted yet).
 */
export function neatGramsOf(ing: IngredientLike | null | undefined): number {
  if (ing?.neatGrams != null && ing.neatGrams !== "") {
    const v = parseFloat(String(ing.neatGrams));
    if (Number.isFinite(v)) return v;
  }
  return weighedGramsOf(ing);
}

/**
 * Neat multiplier for an ingredient, derived from the dilution pointer if
 * present, otherwise 1 (100% neat). Prefers the explicit neatMultiplier
 * column, falls back to dilutionPercent/100.
 */
export function neatMultiplierFor(
  ing: IngredientLike | null | undefined,
  dilutions: DilutionLike[] | null | undefined,
): number {
  if (!ing?.dilutionId) return 1;
  const dil = (dilutions || []).find((d) => d.id === ing.dilutionId);
  if (!dil) return 1;
  const mult = parseFloat(String(dil.neatMultiplier ?? ""));
  if (Number.isFinite(mult) && mult > 0) return mult;
  const pct = parseFloat(String(dil.dilutionPercent ?? ""));
  if (Number.isFinite(pct) && pct > 0) return pct / 100;
  return 1;
}

/**
 * Stock deduction amount: the pure aromatic (neat) mass. material_sources
 * tracks neat material only — the carrier/solvent in a dilution is not
 * stock, so deductions must use neatGrams, not gramsAsWeighed.
 */
export function stockDeductionGrams(ing: IngredientLike | null | undefined): number {
  return neatGramsOf(ing);
}

/** Solvent mass carried into the formula by this ingredient's dilution. */
export function dilutionSolventGrams(ing: IngredientLike | null | undefined): number {
  return weighedGramsOf(ing) - neatGramsOf(ing);
}
