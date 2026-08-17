import { Boxes, Factory, Landmark, Package, ReceiptText, ShoppingCart, Truck, type LucideIcon, UsersRound } from "lucide-react";
import type { TranslationKey } from "@/i18n/translations";

export type FlowNodeId = "commerce" | "distribution" | "manufacturing" | "finance" | "hr";
export type FlowModuleKey = "inventory" | "sales" | "purchases" | "finance" | "hr" | "distribution" | "manufacturing";

export type FlowNodeConfig = {
  id: FlowNodeId;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  icon: LucideIcon;
  moduleRequirements: FlowModuleKey[];
  route?: string;
  position: { x: number; y: number };
  internalNodes?: { key: TranslationKey; icon: LucideIcon; module?: FlowModuleKey }[];
};

export type FlowEdgeConfig = { id: string; source: FlowNodeId; target: FlowNodeId };
export type FlowNodeStatus = "available" | "locked" | "restricted";
export type FlowSubscription = { key: string; status: string };

export const nawaFlowNodes: FlowNodeConfig[] = [
  { id: "commerce", labelKey: "commerceInventory", descriptionKey: "flowOverview", icon: Boxes, moduleRequirements: ["purchases", "inventory", "sales"], route: "/workspace", position: { x: 50, y: 44 }, internalNodes: [{ key: "purchases", icon: ShoppingCart, module: "purchases" }, { key: "inventory", icon: Package, module: "inventory" }, { key: "sales", icon: ReceiptText, module: "sales" }] },
  { id: "finance", labelKey: "financialAccounting", descriptionKey: "flowOverview", icon: Landmark, moduleRequirements: ["finance"], route: "/workspace", position: { x: 83, y: 72 } },
  { id: "hr", labelKey: "humanResources", descriptionKey: "flowOverview", icon: UsersRound, moduleRequirements: ["hr"], route: "/hr", position: { x: 18, y: 76 } },
  { id: "distribution", labelKey: "distributionFleet", descriptionKey: "flowLockedDescription", icon: Truck, moduleRequirements: ["distribution"], route: "/distribution", position: { x: 84, y: 17 }, internalNodes: [{ key: "inventory", icon: Package, module: "inventory" }, { key: "sales", icon: ReceiptText, module: "sales" }, { key: "finance", icon: Landmark, module: "finance" }] },
  { id: "manufacturing", labelKey: "manufacturingProduction", descriptionKey: "flowLockedDescription", icon: Factory, moduleRequirements: ["manufacturing"], route: "/manufacturing", position: { x: 17, y: 18 } },
];

export const nawaFlowEdges: FlowEdgeConfig[] = [
  { id: "manufacturing-commerce", source: "manufacturing", target: "commerce" },
  { id: "commerce-distribution", source: "commerce", target: "distribution" },
  { id: "commerce-finance", source: "commerce", target: "finance" },
  { id: "distribution-finance", source: "distribution", target: "finance" },
  { id: "hr-commerce", source: "hr", target: "commerce" },
  { id: "hr-finance", source: "hr", target: "finance" },
];

export function getFlowNodeStatus(node: FlowNodeConfig, modules: FlowSubscription[], restrictedNodeIds: FlowNodeId[] = []): FlowNodeStatus {
  if (restrictedNodeIds.includes(node.id)) return "restricted";
  const active = new Set(modules.filter(module => module.status === "active").map(module => module.key));
  return node.moduleRequirements.every(key => active.has(key)) ? "available" : "locked";
}
