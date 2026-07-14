import { describe, it, expect } from "vitest";
import {
  splitAromaticSolventMass,
  calcConcentratePercent,
  formulaSolventGrams,
  isSolventIngredient,
  isCommercialDilutionMaterial,
  computeNeatComposition,
  type SolventIngredient,
} from "./concentration";
import type { Material } from "@shared/schema";

// Minimal material factory — only the fields the solvent helpers read matter.
const mat = (id: string, treatAsSolvent = false, name = id): Material =>
  ({ id, name, treatAsSolvent } as unknown as Material);

// A formula row. gramsAsWeighed is what hits the scale; neatGrams is the pure
// aromatic mass after the dilution multiplier (null → treated as neat).
const row = (
  materialId: string,
  gramsAsWeighed: number,
  neatGrams: number | null,
): SolventIngredient =>
  ({
    id: `${materialId}-${gramsAsWeighed}`,
    materialId,
    gramsAsWeighed: String(gramsAsWeighed),
    neatGrams: neatGrams == null ? null : String(neatGrams),
    percentInFormula: null,
  } as SolventIngredient);

const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;

describe("all-10% dilution formula (the reported bug)", () => {
  const materials = [mat("a"), mat("b"), mat("c")];
  // Three 10% dilutions, 1.000 g weighed in total.
  const ings = [
    row("a", 0.4, 0.04),
    row("b", 0.4, 0.04),
    row("c", 0.2, 0.02),
  ];

  it("reports 10% actual concentration, not 100%", () => {
    expect(close(calcConcentratePercent(ings, materials), 10)).toBe(true);
  });

  it("splits 0.1 g aromatic / 0.9 g solvent-in-dilutions from 1.0 g weighed", () => {
    const s = splitAromaticSolventMass(ings, materials);
    expect(close(s.aromaticNeat, 0.1)).toBe(true);
    expect(close(s.aromaticWeighed, 1.0)).toBe(true);
    expect(close(s.solventWeighed, 0)).toBe(true);
    expect(close(s.aromaticDilutionSolvent, 0.9)).toBe(true);
    expect(close(formulaSolventGrams(s), 0.9)).toBe(true);
  });
});

describe("mixed 10% / 1% formula", () => {
  const materials = [mat("a"), mat("b")];
  // 0.5 g of a 10% dilution (0.05 neat) + 0.5 g of a 1% dilution (0.005 neat).
  const ings = [row("a", 0.5, 0.05), row("b", 0.5, 0.005)];

  it("concentration = totalNeat / totalWeighed", () => {
    // (0.05 + 0.005) / 1.0 = 5.5%
    expect(close(calcConcentratePercent(ings, materials), 5.5)).toBe(true);
  });

  it("solvent-in-dilutions = 0.945 g", () => {
    const s = splitAromaticSolventMass(ings, materials);
    expect(close(s.aromaticNeat, 0.055)).toBe(true);
    expect(close(formulaSolventGrams(s), 0.945)).toBe(true);
  });
});

describe("0.1% dilution", () => {
  const materials = [mat("a")];
  const ings = [row("a", 1.0, 0.001)];
  it("reads 0.1% concentration", () => {
    expect(close(calcConcentratePercent(ings, materials), 0.1)).toBe(true);
  });
});

describe("50% commercially diluted material", () => {
  const materials = [mat("a")];
  // e.g. Galaxolide 50% DPG: 1.0 g weighed → 0.5 g neat aromatic.
  const ings = [row("a", 1.0, 0.5)];
  it("reads 50% and 0.5 g solvent", () => {
    expect(close(calcConcentratePercent(ings, materials), 50)).toBe(true);
    expect(close(formulaSolventGrams(splitAromaticSolventMass(ings, materials)), 0.5)).toBe(true);
  });
});

describe("undiluted / neat material (neatGrams null)", () => {
  const materials = [mat("a")];
  const ings = [row("a", 1.0, null)];
  it("falls back to weighed grams → 100% neat, no solvent", () => {
    expect(close(calcConcentratePercent(ings, materials), 100)).toBe(true);
    const s = splitAromaticSolventMass(ings, materials);
    expect(close(s.aromaticNeat, 1.0)).toBe(true);
    expect(close(formulaSolventGrams(s), 0)).toBe(true);
  });
});

describe("explicit solvent row + aromatic dilution", () => {
  const materials = [mat("a"), mat("solv", true)];
  // 1.0 g of a 10% aromatic dilution + 0.5 g of a pure solvent weighed on its own.
  const ings = [row("a", 1.0, 0.1), row("solv", 0.5, 0.5)];

  it("flags the solvent row via treatAsSolvent", () => {
    expect(isSolventIngredient(ings[1], materials)).toBe(true);
    expect(isSolventIngredient(ings[0], materials)).toBe(false);
  });

  it("counts both implicit and explicit solvent", () => {
    const s = splitAromaticSolventMass(ings, materials);
    expect(close(s.aromaticNeat, 0.1)).toBe(true);
    expect(close(s.solventWeighed, 0.5)).toBe(true);
    expect(close(s.aromaticDilutionSolvent, 0.9)).toBe(true);
    // total solvent = 0.9 hidden + 0.5 explicit = 1.4
    expect(close(formulaSolventGrams(s), 1.4)).toBe(true);
    // concentration = 0.1 aromatic / 1.5 weighed
    expect(close(calcConcentratePercent(ings, materials), (0.1 / 1.5) * 100)).toBe(true);
  });
});

describe("commercial-dilution material detection", () => {
  it("flags names encoding a percentage", () => {
    expect(isCommercialDilutionMaterial(mat("g", false, "Galaxolide 50% DPG"))).toBe(true);
    expect(isCommercialDilutionMaterial(mat("i", false, "Iso E Super 10%"))).toBe(true);
    expect(isCommercialDilutionMaterial(mat("c", false, "Cashmeran 0,1 %"))).toBe(true);
  });
  it("does not flag plain neat material names", () => {
    expect(isCommercialDilutionMaterial(mat("l", false, "Linalool"))).toBe(false);
  });
});

describe("computeNeatComposition (100% neat view)", () => {
  const materials = [
    mat("a", false, "Hedione"),
    mat("g", false, "Galaxolide 50% DPG"),
    mat("solv", true, "Ethanol"),
  ];
  // Hedione 10% dilution (0.05 neat) + Galaxolide 50% (0.5 neat) + 0.3 g solvent.
  const ings = [row("a", 0.5, 0.05), row("g", 1.0, 0.5), row("solv", 0.3, 0.3)];

  it("drops solvent rows and renormalises aromatic to 100%", () => {
    const { rows, totalNeat } = computeNeatComposition(ings, materials);
    expect(rows).toHaveLength(2); // solvent row excluded
    expect(close(totalNeat, 0.55)).toBe(true);
    const sum = rows.reduce((s, r) => s + r.neatPercent, 0);
    expect(close(sum, 100)).toBe(true);
    const hedione = rows.find((r) => r.materialId === "a")!;
    expect(close(hedione.neatPercent, (0.05 / 0.55) * 100)).toBe(true);
  });

  it("flags the commercially-diluted row and not the plain one", () => {
    const { rows } = computeNeatComposition(ings, materials);
    expect(rows.find((r) => r.materialId === "g")!.isCommercialDilution).toBe(true);
    expect(rows.find((r) => r.materialId === "a")!.isCommercialDilution).toBe(false);
  });

  it("does not mutate the input ingredients", () => {
    const snapshot = JSON.stringify(ings);
    computeNeatComposition(ings, materials);
    expect(JSON.stringify(ings)).toBe(snapshot);
  });
});

describe("required-solvent-to-target (panel math)", () => {
  const materials = [mat("a"), mat("b"), mat("c")];
  const ings = [row("a", 0.4, 0.04), row("b", 0.4, 0.04), row("c", 0.2, 0.02)];

  it("all-10% formula at 10% target needs no extra solvent", () => {
    const s = splitAromaticSolventMass(ings, materials);
    const target = 10;
    const requiredTotal = s.aromaticNeat / (target / 100);
    const requiredSolvent = requiredTotal - s.aromaticNeat;
    const needed = requiredSolvent - formulaSolventGrams(s);
    expect(close(needed, 0)).toBe(true);
  });

  it("all-10% formula at 5% target needs 1.0 g more solvent", () => {
    const s = splitAromaticSolventMass(ings, materials);
    const target = 5;
    const requiredTotal = s.aromaticNeat / (target / 100); // 0.1 / 0.05 = 2.0
    const requiredSolvent = requiredTotal - s.aromaticNeat; // 1.9
    const needed = requiredSolvent - formulaSolventGrams(s); // 1.9 - 0.9 = 1.0
    expect(close(needed, 1.0)).toBe(true);
  });
});
