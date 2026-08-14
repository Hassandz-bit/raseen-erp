const purchaseTransitions = {
  draft: ["sent", "cancelled"],
  sent: ["partial", "received", "cancelled"],
  partial: ["received", "cancelled"],
  received: [],
  cancelled: [],
} as const;

const stockCountTransitions = {
  draft: ["in_progress", "cancelled"],
  in_progress: ["review", "cancelled"],
  review: ["approved", "cancelled"],
  approved: [],
  cancelled: [],
} as const;

export function canTransitionPurchaseDocument(from: keyof typeof purchaseTransitions, to: string) {
  return purchaseTransitions[from].includes(to as never);
}

export function canTransitionStockCount(from: keyof typeof stockCountTransitions, to: string) {
  return stockCountTransitions[from].includes(to as never);
}
