export type BatchCandidate = { id: number; availableQuantity: number; expiryDate: Date | null; status: "active" | "blocked" | "quarantined" | "expired" };

export function selectFefoBatches(batches: BatchCandidate[], requestedQuantity: number, now = new Date()) {
  let remaining = requestedQuantity;
  const ordered = batches
    .filter(batch => batch.status === "active" && batch.availableQuantity > 0 && (!batch.expiryDate || batch.expiryDate > now))
    .sort((a, b) => (a.expiryDate?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.expiryDate?.getTime() ?? Number.MAX_SAFE_INTEGER));
  const allocations = ordered.flatMap(batch => {
    if (remaining <= 0) return [];
    const quantity = Math.min(batch.availableQuantity, remaining);
    remaining -= quantity;
    return [{ batchId: batch.id, quantity }];
  });
  return { allocations, remainingQuantity: remaining };
}

export function convertUnitQuantity(quantity: number, factor: number) {
  if (factor <= 0) throw new Error("عامل التحويل يجب أن يكون أكبر من صفر.");
  return quantity * factor;
}

const transitions = {
  draft: ["confirmed", "cancelled"],
  confirmed: ["issued", "cancelled"],
  issued: ["partial", "paid", "returned"],
  partial: ["paid", "returned"],
  paid: ["returned"],
  returned: [],
  cancelled: [],
} as const;

export function canTransitionSalesDocument(from: keyof typeof transitions, to: string) {
  return transitions[from].includes(to as never);
}
