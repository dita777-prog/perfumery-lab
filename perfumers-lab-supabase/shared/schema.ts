/**
 * Shared types for Perfumer's Lab.
 * These match the Supabase table columns (camelCase after client-side transform).
 */

// 1) Olfactive Families
export type OlfactiveFamily = {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number | null;
  createdAt: string | null;
};
export type InsertOlfactiveFamily = Omit<OlfactiveFamily, "id" | "createdAt">;

// 2) Formula Categories
export type FormulaCategory = {
  id: string;
  name: string;
  sortOrder: number | null;
  createdAt: string | null;
};
export type InsertFormulaCategory = Omit<FormulaCategory, "id" | "createdAt">;

// 3) Suppliers
export type Supplier = {
  id: string;
  name: string;
  website: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  country: string | null;
  minOrderValue: string | null;
  shippingCostEstimate: string | null;
  avgDeliveryDays: number | null;
  reliabilityScore: number | null;
  qualityScore: number | null;
  notes: string | null;
  speciality: string | null;
  createdAt: string | null;
};
export type InsertSupplier = Omit<Supplier, "id" | "createdAt">;

// 4) Materials
export type Material = {
  id: string;
  name: string;
  altNames: string[] | null;
  casNumber: string | null;
  botanicalName: string | null;
  olfactiveFamilyId: string | null;
  pyramidRole: string | null;
  flashPoint: string | null;
  solubilityNotes: string | null;
  recommendedDilutions: string | null;
  behaviorWax: string | null;
  behaviorAlcohol: string | null;
  behaviorNebulizer: string | null;
  behaviorDiffuser: string | null;
  strength: number | null;
  dominance: number | null;
  projection: number | null;
  treatAsSolvent: boolean | null;
  tags: string[] | null;
  notesSensory: string | null;
  status: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};
export type InsertMaterial = Omit<Material, "id" | "createdAt" | "updatedAt">;

// 5) Material Sources
export type MaterialSource = {
  id: string;
  materialId: string;
  supplierId: string | null;
  supplierMaterialName: string | null;
  batchLot: string | null;
  purchaseDate: string | null;
  purchasePrice: string | null;
  purchaseQuantityGrams: string | null;
  pricePerGram: string | null;
  stockGrams: string | null;
  reorderThresholdGrams: string | null;
  status: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};
export type InsertMaterialSource = Omit<MaterialSource, "id" | "createdAt" | "updatedAt">;

// 6) Material IFRA Limits
export type MaterialIfraLimit = {
  id: string;
  materialId: string;
  productType: string;
  ifraCategory: string | null;
  limitPercent: string | null;
  notes: string | null;
  source: string | null;
  updatedAt: string | null;
};
export type InsertMaterialIfraLimit = Omit<MaterialIfraLimit, "id" | "updatedAt">;

// 7) Material Dilutions
export type MaterialDilution = {
  id: string;
  sourceMaterialId: string | null;
  sourceMaterialSourceId: string | null;
  name: string;
  dilutionPercent: string;
  solventMaterialId: string | null;
  solventName: string | null;
  neatMultiplier: string;
  preparedDate: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};
export type InsertMaterialDilution = Omit<MaterialDilution, "id" | "createdAt" | "updatedAt">;

// 8) Formulas
export type Formula = {
  id: string;
  name: string;
  categoryId: string | null;
  version: number | null;
  parentFormulaId: string | null;
  status: string | null;
  productType: string | null;
  intendedConcentrationPercent: string | null;
  totalBatchGrams: string | null;
  unitsInBatch: number | null;
  versionGoal: string | null;
  changeNotes: string | null;
  author: string | null;
  formulaNotes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};
export type InsertFormula = Omit<Formula, "id" | "createdAt" | "updatedAt">;

// 9) Formula Ingredients
export type FormulaIngredient = {
  id: string;
  formulaId: string;
  sourceType: string;
  materialId: string | null;
  dilutionId: string | null;
  sourceFormulaId: string | null;
  gramsAsWeighed: string;
  neatGrams: string | null;
  percentInFormula: string | null;
  pyramidRole: string | null;
  role: string | null;
  highlightType: string | null;
  highlightColor: string | null;
  notes: string | null;
  sortOrder: number | null;
  createdAt: string | null;
};
export type InsertFormulaIngredient = Omit<FormulaIngredient, "id" | "createdAt">;

// 10) Tests
export type Test = {
  id: string;
  formulaId: string | null;
  formulaVersion: number | null;
  testDate: string | null;
  medium: string | null;
  cureTimeHours: number | null;
  macerationTimeHours: number | null;
  intensity: number | null;
  throwDiffusion: number | null;
  longevity: number | null;
  whatWasWrong: string | null;
  whatToTryNext: string | null;
  decision: string | null;
  tester: string | null;
  notes: string | null;
  createdAt: string | null;
};
export type InsertTest = Omit<Test, "id" | "createdAt">;

// 11) Decisions
export type Decision = {
  id: string;
  date: string | null;
  category: string | null;
  whatWasDecided: string | null;
  why: string | null;
  whatWasRejected: string | null;
  whyRejected: string | null;
  relatedMaterialId: string | null;
  relatedFormulaId: string | null;
  relatedSupplierId: string | null;
  tags: string[] | null;
  createdAt: string | null;
};
export type InsertDecision = Omit<Decision, "id" | "createdAt">;

// 12) Stock Movements
export type StockMovement = {
  id: string;
  materialSourceId: string | null;
  movementType: string | null;
  gramsDelta: string | null;
  relatedFormulaId: string | null;
  date: string | null;
  notes: string | null;
  createdAt: string | null;
};
export type InsertStockMovement = Omit<StockMovement, "id" | "createdAt">;

// 13) Supplier Price History
export type SupplierPriceHistory = {
  id: string;
  supplierId: string | null;
  materialId: string | null;
  pricePerGram: string | null;
  dateRecorded: string | null;
  notes: string | null;
};
export type InsertSupplierPriceHistory = Omit<SupplierPriceHistory, "id">;

// 14) Attachments
export type Attachment = {
  id: string;
  entityType: string;
  entityId: string;
  filePath: string;
  fileName: string | null;
  mimeType: string | null;
  notes: string | null;
  createdAt: string | null;
};
export type InsertAttachment = Omit<Attachment, "id" | "createdAt">;

// 15) Audit Log
export type AuditLog = {
  id: string;
  tableName: string;
  recordId: string;
  action: string;
  changedFields: any;
  oldValues: any;
  newValues: any;
  author: string | null;
  createdAt: string | null;
};
