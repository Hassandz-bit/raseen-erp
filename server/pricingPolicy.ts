export type PriceCandidate = { kind: "promotion" | "customer" | "segment" | "region" | "wholesale" | "retail" | "default"; price: number; minimumQuantity: number; priority: number; startsAt?: Date; endsAt?: Date };

const rank: Record<PriceCandidate["kind"], number> = { promotion: 0, customer: 1, segment: 2, region: 3, wholesale: 4, retail: 5, default: 6 };

export function resolveCommercePrice(candidates: PriceCandidate[], quantity: number, now = new Date()) {
  const eligible = candidates.filter(candidate => candidate.minimumQuantity <= quantity && (!candidate.startsAt || candidate.startsAt <= now) && (!candidate.endsAt || candidate.endsAt >= now));
  return eligible.sort((a, b) => rank[a.kind] - rank[b.kind] || a.priority - b.priority || b.minimumQuantity - a.minimumQuantity)[0];
}
