const ZERO = BigInt(0);
const TEN = BigInt(10);
const HUNDRED = BigInt(100);
const SCALE = BigInt(1_000_000_000);
const CUBIC_MILLIMETERS_PER_M3 = BigInt(1_000_000_000);

function powerOfTen(exponent: number): bigint {
  let result = BigInt(1);
  for (let index = 0; index < exponent; index += 1) result *= TEN;
  return result;
}

function parseDecimal(value: string | number, scale = 9): bigint {
  const normalized = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) throw new Error("قيمة عشرية غير صالحة.");
  const negative = normalized.startsWith("-");
  const [wholeRaw, fractionRaw = ""] = (negative ? normalized.slice(1) : normalized).split(".");
  const fraction = `${fractionRaw}${"0".repeat(scale)}`.slice(0, scale);
  const result = BigInt(wholeRaw) * powerOfTen(scale) + BigInt(fraction || "0");
  return negative ? -result : result;
}

function formatDecimal(value: bigint, scale = 9): string {
  const negative = value < ZERO;
  const absolute = negative ? -value : value;
  const divisor = powerOfTen(scale);
  const whole = absolute / divisor;
  const fractional = (absolute % divisor).toString().padStart(scale, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fractional ? `.${fractional}` : ""}`;
}

export function convertToBaseQuantity(quantity: string | number, factorToBase: string | number): string {
  return formatDecimal((parseDecimal(quantity) * parseDecimal(factorToBase)) / SCALE);
}

export function convertFromBaseQuantity(baseQuantity: string | number, factorToBase: string | number): string {
  const factor = parseDecimal(factorToBase);
  if (factor <= ZERO) throw new Error("معامل التحويل يجب أن يكون أكبر من صفر.");
  return formatDecimal((parseDecimal(baseQuantity) * SCALE) / factor);
}

export type LogisticsInput = { quantity: string | number; grossWeightKg?: string | number | null; actualVolumeM3?: string | number | null; lengthMm?: string | number | null; widthMm?: string | number | null; heightMm?: string | number | null; palletCount?: string | number | null; label: string };
export type LogisticsSummary = { totalGrossWeightKg: string; totalVolumeM3: string; totalPallets: string; missing: string[] };

export function calculateLogistics(items: LogisticsInput[]): LogisticsSummary {
  let weight = ZERO;
  let volume = ZERO;
  let pallets = ZERO;
  const missing: string[] = [];
  for (const item of items) {
    const quantity = parseDecimal(item.quantity);
    if (item.grossWeightKg == null || item.actualVolumeM3 == null && (item.lengthMm == null || item.widthMm == null || item.heightMm == null)) missing.push(item.label);
    if (item.grossWeightKg != null) weight += (quantity * parseDecimal(item.grossWeightKg)) / SCALE;
    const unitVolume = item.actualVolumeM3 != null ? parseDecimal(item.actualVolumeM3) : item.lengthMm != null && item.widthMm != null && item.heightMm != null ? (parseDecimal(item.lengthMm) * parseDecimal(item.widthMm) * parseDecimal(item.heightMm)) / (SCALE * CUBIC_MILLIMETERS_PER_M3) : ZERO;
    volume += (quantity * unitVolume) / SCALE;
    if (item.palletCount != null) pallets += (quantity * parseDecimal(item.palletCount)) / SCALE;
  }
  return { totalGrossWeightKg: formatDecimal(weight), totalVolumeM3: formatDecimal(volume), totalPallets: formatDecimal(pallets), missing };
}

export function assessVehicleCapacity(summary: LogisticsSummary, vehicle: { maximumPayloadWeight: string | number; maximumVolume: string | number; palletCapacity: string | number }) {
  const weight = parseDecimal(summary.totalGrossWeightKg);
  const volume = parseDecimal(summary.totalVolumeM3);
  const pallets = parseDecimal(summary.totalPallets);
  const maximumWeight = parseDecimal(vehicle.maximumPayloadWeight);
  const maximumVolume = parseDecimal(vehicle.maximumVolume);
  const maximumPallets = parseDecimal(vehicle.palletCapacity);
  const reasons: string[] = [];
  if (weight > maximumWeight) reasons.push("payload_exceeded");
  if (volume > maximumVolume) reasons.push("volume_exceeded");
  if (maximumPallets > ZERO && pallets > maximumPallets) reasons.push("pallet_capacity_exceeded");
  return { suitable: reasons.length === 0, reasons, weightUtilization: maximumWeight > ZERO ? formatDecimal((weight * HUNDRED * SCALE) / maximumWeight) : null, volumeUtilization: maximumVolume > ZERO ? formatDecimal((volume * HUNDRED * SCALE) / maximumVolume) : null, palletUtilization: maximumPallets > ZERO ? formatDecimal((pallets * HUNDRED * SCALE) / maximumPallets) : null, remainingKg: formatDecimal(maximumWeight - weight), remainingM3: formatDecimal(maximumVolume - volume) };
}
