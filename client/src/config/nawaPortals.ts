import { Bot, Boxes, Factory, Landmark, Settings2, Store, Truck, type LucideIcon, UsersRound } from "lucide-react";

export type SupportedLanguage = "ar" | "fr" | "en";
export type PortalId = "commerce" | "manufacturing" | "distribution" | "retail" | "finance" | "hr" | "ai" | "administration";

export type LocalizedPortalText = Record<SupportedLanguage, string>;

export type PortalNavigationItem = {
  id: string;
  label: LocalizedPortalText;
  href: string;
  group: LocalizedPortalText;
  externalExperience?: boolean;
};

export type NawaPortal = {
  id: PortalId;
  icon: LucideIcon;
  name: LocalizedPortalText;
  description: LocalizedPortalText;
  href: string;
  accent: "gold" | "sky" | "violet" | "emerald" | "rose" | "amber" | "cyan" | "slate";
  requiredModules: string[];
  localNavigation: PortalNavigationItem[];
};

const text = (ar: string, fr: string, en: string): LocalizedPortalText => ({ ar, fr, en });

export const nawaPortals: NawaPortal[] = [
  {
    id: "commerce",
    icon: Boxes,
    name: text("التجارة والمخزون", "Commerce et stock", "Commerce & inventory"),
    description: text("المنتجات والمبيعات والمشتريات وحركة المخزون", "Produits, ventes, achats et mouvements de stock", "Products, sales, purchasing and stock movement"),
    href: "/commerce",
    accent: "sky",
    requiredModules: ["inventory", "commerce"],
    localNavigation: [
      { id: "overview", label: text("نظرة عامة", "Vue d’ensemble", "Overview"), href: "/commerce", group: text("التشغيل", "Opérations", "Operations") },
      { id: "products", label: text("المنتجات", "Produits", "Products"), href: "/commerce#products", group: text("الكتالوج", "Catalogue", "Catalog") },
      { id: "operations", label: text("العمليات التجارية", "Opérations commerciales", "Commercial operations"), href: "/commerce#operations", group: text("التشغيل", "Opérations", "Operations") },
    ],
  },
  {
    id: "manufacturing",
    icon: Factory,
    name: text("التصنيع والإنتاج", "Fabrication et production", "Manufacturing & production"),
    description: text("التخطيط وأوامر الإنتاج والمراحل والجودة", "Planification, ordres, étapes et qualité", "Planning, production orders, stages and quality"),
    href: "/manufacturing",
    accent: "violet",
    requiredModules: ["manufacturing"],
    localNavigation: [
      { id: "overview", label: text("لوحة التصنيع", "Tableau de production", "Manufacturing dashboard"), href: "/manufacturing", group: text("الإنتاج", "Production", "Production") },
      { id: "orders", label: text("أوامر الإنتاج", "Ordres de production", "Production orders"), href: "/manufacturing?tab=overview", group: text("الإنتاج", "Production", "Production") },
      { id: "materials", label: text("المواد", "Matières", "Materials"), href: "/manufacturing?tab=materials", group: text("التشغيل", "Exécution", "Execution") },
      { id: "stages", label: text("المراحل", "Étapes", "Stages"), href: "/manufacturing?tab=stages", group: text("التشغيل", "Exécution", "Execution") },
      { id: "quality", label: text("الجودة", "Qualité", "Quality"), href: "/manufacturing?tab=quality", group: text("الرقابة", "Contrôle", "Control") },
      { id: "traceability", label: text("التتبع", "Traçabilité", "Traceability"), href: "/manufacturing?tab=traceability", group: text("الرقابة", "Contrôle", "Control") },
    ],
  },
  {
    id: "distribution",
    icon: Truck,
    name: text("التوزيع والأسطول", "Distribution et flotte", "Distribution & fleet"),
    description: text("الجولات والتحميل والمركبات والتسليم", "Tournées, chargements, véhicules et livraisons", "Routes, loads, vehicles and delivery"),
    href: "/distribution",
    accent: "emerald",
    requiredModules: ["distribution"],
    localNavigation: [
      { id: "control", label: text("مركز العمليات", "Centre de contrôle", "Control center"), href: "/distribution", group: text("التوزيع", "Distribution", "Distribution") },
      { id: "routes", label: text("الجولات والتسليم", "Tournées et livraisons", "Routes & delivery"), href: "/distribution?section=routes", group: text("التوزيع", "Distribution", "Distribution") },
      { id: "fleet", label: text("المركبات والأسطول", "Véhicules et flotte", "Vehicles & fleet"), href: "/distribution?section=fleet", group: text("الأسطول", "Flotte", "Fleet") },
      { id: "territories", label: text("نطاقات التوزيع", "Zones de distribution", "Distribution territories"), href: "/distribution?section=territories", group: text("الأسطول", "Flotte", "Fleet") },
      { id: "driver", label: text("مساحة السائق", "Espace conducteur", "Driver workspace"), href: "/driver", group: text("العمليات الميدانية", "Opérations terrain", "Field operations"), externalExperience: true },
    ],
  },
  {
    id: "retail",
    icon: Store,
    name: text("Nawa Retail", "Nawa Retail", "Nawa Retail"),
    description: text("إدارة المورد للعلاقات والطلبات والتسعير B2B", "Administration fournisseur des relations et commandes B2B", "Supplier administration for B2B relationships and orders"),
    href: "/b2b-orders",
    accent: "amber",
    requiredModules: ["nawa_retail"],
    localNavigation: [
      { id: "supplier", label: text("مركز المورد", "Centre fournisseur", "Supplier center"), href: "/b2b-orders", group: text("إدارة Retail", "Gestion Retail", "Retail administration") },
      { id: "retailer", label: text("بوابة التاجر", "Portail détaillant", "Retailer portal"), href: "/retailer", group: text("تجارب مستقلة", "Expériences indépendantes", "Independent experiences"), externalExperience: true },
    ],
  },
  {
    id: "finance",
    icon: Landmark,
    name: text("المالية والمحاسبة", "Finance et comptabilité", "Finance & accounting"),
    description: text("الحسابات والخزينة والذمم والرقابة", "Comptabilité, trésorerie, tiers et contrôle", "Accounting, treasury, receivables and control"),
    href: "/finance",
    accent: "rose",
    requiredModules: ["finance"],
    localNavigation: [
      { id: "overview", label: text("مركز المالية", "Centre finance", "Finance center"), href: "/finance", group: text("المالية", "Finance", "Finance") },
      { id: "accounts", label: text("دليل الحسابات", "Plan comptable", "Chart of accounts"), href: "/finance?tab=accounts", group: text("المحاسبة", "Comptabilité", "Accounting") },
      { id: "entries", label: text("قيود اليومية", "Écritures", "Journal entries"), href: "/finance?tab=entries", group: text("المحاسبة", "Comptabilité", "Accounting") },
      { id: "aging", label: text("الذمم", "Balances âgées", "Aging"), href: "/finance?tab=aging", group: text("الرقابة", "Contrôle", "Control") },
      { id: "treasury", label: text("الخزينة", "Trésorerie", "Treasury"), href: "/finance?tab=treasury", group: text("الرقابة", "Contrôle", "Control") },
      { id: "reports", label: text("التقارير المالية", "Rapports financiers", "Financial reports"), href: "/finance?tab=reports", group: text("التقارير", "Rapports", "Reports") },
    ],
  },
  {
    id: "hr",
    icon: UsersRound,
    name: text("الموارد البشرية والرواتب", "RH et paie", "HR & payroll"),
    description: text("الموظفون والحضور والإجازات والرواتب", "Employés, temps, congés et paie", "Employees, time, leave and payroll"),
    href: "/hr",
    accent: "cyan",
    requiredModules: ["hr"],
    localNavigation: [
      { id: "overview", label: text("مركز الموارد البشرية", "Centre RH", "HR center"), href: "/hr", group: text("الإدارة", "Administration", "Administration") },
      { id: "employees", label: text("الموظفون", "Employés", "Employees"), href: "/hr?tab=employees", group: text("الإدارة", "Administration", "Administration") },
      { id: "attendance", label: text("الحضور", "Présences", "Attendance"), href: "/hr?tab=attendance", group: text("الوقت والإجازات", "Temps et congés", "Time & leave") },
      { id: "leave", label: text("الإجازات", "Congés", "Leave"), href: "/hr?tab=leave", group: text("الوقت والإجازات", "Temps et congés", "Time & leave") },
      { id: "payroll", label: text("الرواتب", "Paie", "Payroll"), href: "/hr?tab=payroll", group: text("الرواتب", "Paie", "Payroll") },
      { id: "self-service", label: text("الخدمة الذاتية", "Libre-service", "Self-service"), href: "/self-service", group: text("تجارب مستقلة", "Expériences indépendantes", "Independent experiences"), externalExperience: true },
    ],
  },
  {
    id: "ai",
    icon: Bot,
    name: text("مساحة العمل", "Espace de travail", "Workspace"),
    description: text("Nawa AI وخريطة Nawa Flow للعمليات", "Nawa AI et la carte de processus Nawa Flow", "Nawa AI and the Nawa Flow process map"),
    href: "/workspace",
    accent: "gold",
    requiredModules: ["ai_assistant"],
    localNavigation: [
      { id: "ai", label: text("Nawa AI", "Nawa AI", "Nawa AI"), href: "/workspace", group: text("التحليل", "Analyse", "Analysis") },
      { id: "flow", label: text("Nawa Flow", "Nawa Flow", "Nawa Flow"), href: "/workspace?view=nawa_flow", group: text("العمليات", "Processus", "Processes") },
    ],
  },
  {
    id: "administration",
    icon: Settings2,
    name: text("الإدارة والإعدادات", "Administration et paramètres", "Administration & settings"),
    description: text("المؤسسة والوصول والاشتراكات والتفضيلات", "Organisation, accès, abonnements et préférences", "Organization, access, subscriptions and preferences"),
    href: "/settings",
    accent: "slate",
    requiredModules: [],
    localNavigation: [
      { id: "settings", label: text("الإعدادات", "Paramètres", "Settings"), href: "/settings", group: text("الإدارة", "Administration", "Administration") },
      { id: "modules", label: text("الوحدات والاشتراكات", "Modules et abonnements", "Modules & subscriptions"), href: "/modules", group: text("الاشتراك", "Abonnement", "Subscription") },
    ],
  },
];

export function getPortal(portalId: PortalId) {
  return nawaPortals.find(portal => portal.id === portalId);
}

export function getPortalForPath(path: string) {
  if (path.startsWith("/b2b-orders") || path.startsWith("/retailer")) return getPortal("retail");
  if (path.startsWith("/driver") || path.startsWith("/distribution") || path.startsWith("/logistics-check")) return getPortal("distribution");
  if (path.startsWith("/self-service") || path.startsWith("/hr")) return getPortal("hr");
  if (path.startsWith("/commerce")) return getPortal("commerce");
  if (path.startsWith("/manufacturing")) return getPortal("manufacturing");
  if (path.startsWith("/finance")) return getPortal("finance");
  if (path.startsWith("/workspace")) return getPortal("ai");
  if (path.startsWith("/settings") || path.startsWith("/modules")) return getPortal("administration");
  return undefined;
}
