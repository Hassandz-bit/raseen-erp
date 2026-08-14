const purchaseTransitions = {
  draft: ["approved", "cancelled"],
  approved: ["ordered", "cancelled"],
  ordered: ["partial_received", "received", "cancelled"],
  partial_received: ["received", "cancelled"],
  received: [],
  cancelled: [],
} as const;

const stockCountTransitions = {
  draft: ["counting", "cancelled"],
  counting: ["review", "cancelled"],
  review: ["posted", "cancelled"],
  posted: [],
  cancelled: [],
} as const;

export function canTransitionPurchaseDocument(from: keyof typeof purchaseTransitions, to: string) {
  return purchaseTransitions[from].includes(to as never);
}

export function canTransitionStockCount(from: keyof typeof stockCountTransitions, to: string) {
  return stockCountTransitions[from].includes(to as never);
}
