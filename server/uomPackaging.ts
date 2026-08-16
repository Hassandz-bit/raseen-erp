import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "./db";
import { fleetVehicles, organizationCustomPackages, productPackagingLevels, products, uomAliases, uomCatalog } from "../drizzle/schema";
import { assessVehicleCapacity, calculateLogistics, type LogisticsSummary } from "./uomLogisticsPolicy";

export async function listUomCatalog() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const units = await db.select().from(uomCatalog).where(eq(uomCatalog.status, "active")).orderBy(asc(uomCatalog.code));
  const aliases = await db.select().from(uomAliases).where(inArray(uomAliases.uomId, units.map(unit => unit.id)));
  return units.map(unit => ({ ...unit, aliases: aliases.filter(alias => alias.uomId === unit.id).map(alias => ({ value: alias.alias, language: alias.language })) }));
}

export async function listProductPackaging(organizationId: number, productId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [product] = await db.select({ id: products.id, baseUnit: products.baseUnit, defaultGrossWeight: products.grossWeight, defaultVolume: products.volume }).from(products).where(and(eq(products.id, productId), eq(products.organizationId, organizationId))).limit(1);
  if (!product) throw new Error("المنتج غير موجود ضمن المؤسسة.");
  const levels = await db.select({ level: productPackagingLevels, unit: uomCatalog, custom: organizationCustomPackages }).from(productPackagingLevels).leftJoin(uomCatalog, eq(uomCatalog.id, productPackagingLevels.uomId)).leftJoin(organizationCustomPackages, and(eq(organizationCustomPackages.id, productPackagingLevels.customPackageId), eq(organizationCustomPackages.organizationId, productPackagingLevels.organizationId))).where(and(eq(productPackagingLevels.organizationId, organizationId), eq(productPackagingLevels.productId, productId), eq(productPackagingLevels.status, "active"))).orderBy(asc(productPackagingLevels.factorToBase));
  return { product, levels: levels.map(({ level, unit, custom }) => ({ ...level, canonicalUnit: unit ? { code: unit.code, nameAr: unit.nameAr, nameFr: unit.nameFr, nameEn: unit.nameEn } : null, customPackageName: custom?.name ?? null })) };
}

export async function validatePackagingUsage(input: { organizationId: number; productId: number; packagingLevelId: number; channel: "purchase" | "sales" | "b2b" | "distribution" }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const [level] = await db.select().from(productPackagingLevels).where(and(eq(productPackagingLevels.id, input.packagingLevelId), eq(productPackagingLevels.organizationId, input.organizationId), eq(productPackagingLevels.productId, input.productId), eq(productPackagingLevels.status, "active"))).limit(1);
  if (!level) throw new Error("مستوى التغليف غير متاح لهذا المنتج.");
  const allowed = input.channel === "purchase" ? level.allowedPurchase : input.channel === "sales" ? level.allowedSales : input.channel === "b2b" ? level.allowedB2b : level.allowedDistribution;
  if (allowed !== "yes") throw new Error("وحدة التغليف غير مسموحة في هذا المسار.");
  return level;
}

export async function calculatePackagingLogistics(organizationId: number, lines: Array<{ productId: number; packagingLevelId: number; quantity: string | number }>): Promise<LogisticsSummary> {
  const inputs = [];
  for (const line of lines) {
    const level = await validatePackagingUsage({ organizationId, productId: line.productId, packagingLevelId: line.packagingLevelId, channel: "distribution" });
    inputs.push({ label: level.displayName ?? level.code, quantity: line.quantity, grossWeightKg: level.grossWeightKg, actualVolumeM3: level.actualVolumeM3, lengthMm: level.lengthMm, widthMm: level.widthMm, heightMm: level.heightMm, palletCount: level.uomId ? undefined : level.cartonsPerPallet ? "1" : undefined });
  }
  return calculateLogistics(inputs);
}

export async function findSuitableVehicles(organizationId: number, summary: LogisticsSummary) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const vehicles = await db.select().from(fleetVehicles).where(and(eq(fleetVehicles.organizationId, organizationId), eq(fleetVehicles.status, "active")));
  return vehicles.map(vehicle => ({ vehicle, assessment: assessVehicleCapacity(summary, { maximumPayloadWeight: vehicle.maximumPayloadWeight, maximumVolume: vehicle.maximumVolume, palletCapacity: vehicle.palletCapacity }) })).sort((left, right) => Number(right.assessment.suitable) - Number(left.assessment.suitable) || Number(left.assessment.volumeUtilization ?? "999999") - Number(right.assessment.volumeUtilization ?? "999999") || Number(left.assessment.weightUtilization ?? "999999") - Number(right.assessment.weightUtilization ?? "999999"));
}
