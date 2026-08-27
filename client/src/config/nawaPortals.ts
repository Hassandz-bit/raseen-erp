import { AlertTriangle, ArrowDownUp, BadgeCheck, BadgePercent, Banknote, BookOpen, Bot, Boxes, CalendarCheck2, CalendarDays, CarFront, ChartNoAxesCombined, ClipboardCheck, ClipboardList, Clock3, Coins, Contact, Factory, FileText, Gauge, GitBranch, Landmark, LayoutDashboard, MapPin, MapPinned, NotebookPen, Package, PackageCheck, PackageSearch, ReceiptText, Route, RotateCcw, ScanLine, Scale, Settings2, ShieldAlert, ShoppingBag, ShoppingCart, Store, Truck, type LucideIcon, UserCog, UserRoundCheck, UsersRound, WalletCards, Warehouse, Workflow } from "lucide-react";
import { HardDriveDownload } from "lucide-react";
export type SupportedLanguage = "ar" | "fr" | "en";
export type PortalId = "commerce" | "manufacturing" | "distribution" | "retail" | "finance" | "hr" | "administration";

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

const navigationIcons: Record<string, LucideIcon> = {
  overview: LayoutDashboard, products: Boxes, warehouses: Warehouse, batches: PackageSearch, sales: ReceiptText, purchases: ShoppingCart, operations: Workflow,
  orders: ClipboardList, materials: Package, consumption: ArrowDownUp, stages: GitBranch, output: PackageCheck, quality: BadgeCheck, traceability: ScanLine, costs: Coins,
  control: Gauge, routes: Route, fleet: CarFront, territories: MapPinned, compliance: ShieldAlert, "logistics-check": ClipboardCheck, driver: CarFront,
  supplier: Store, accesses: UsersRound, outlets: MapPin, "retail-users": UserCog, promotions: BadgePercent, "retail-orders": ClipboardList, returns: RotateCcw, retailer: ShoppingBag,
  accounts: BookOpen, entries: NotebookPen, aging: Scale, treasury: WalletCards, reports: ChartNoAxesCombined,
  employees: Contact, attendance: CalendarCheck2, overtime: Clock3, leave: CalendarDays, payroll: Banknote, "self-service": UserRoundCheck,
  settings: Settings2, modules: Boxes, security: ShieldAlert, backup: HardDriveDownload, details: FileText, "decision-alerts": AlertTriangle, vat: BadgePercent, appearance: Settings2, about: FileText,
};

export function getPortalNavigationIcon(itemId: string, fallback: LucideIcon) {
  return navigationIcons[itemId] ?? fallback;
}

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
      { id: "products", label: text("المنتجات", "Produits", "Products"), href: "/commerce/products", group: text("الكتالوج", "Catalogue", "Catalog") },
      { id: "warehouses", label: text("المخازن", "Entrepôts", "Warehouses"), href: "/commerce/warehouses", group: text("المخزون", "Stock", "Inventory") },
      { id: "batches", label: text("الدفعات وFEFO", "Lots et FEFO", "Batches & FEFO"), href: "/commerce/batches", group: text("المخزون", "Stock", "Inventory") },
      { id: "inventory-reports", label: text("تقارير المخزون", "Rapports de stock", "Inventory reports"), href: "/commerce/reports", group: text("المخزون", "Stock", "Inventory") },
      { id: "sales", label: text("فواتير المبيعات", "Factures de vente", "Sales invoices"), href: "/commerce/sales", group: text("المبيعات", "Ventes", "Sales") },
      { id: "purchases", label: text("أوامر الشراء", "Commandes d’achat", "Purchase orders"), href: "/commerce/purchases", group: text("المشتريات", "Achats", "Purchasing") },
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
      { id: "orders", label: text("أوامر الإنتاج", "Ordres de production", "Production orders"), href: "/manufacturing/orders", group: text("الإنتاج", "Production", "Production") },
      { id: "materials", label: text("المواد", "Matières", "Materials"), href: "/manufacturing/materials", group: text("التشغيل", "Exécution", "Execution") },
      { id: "consumption", label: text("صرف المواد", "Consommation", "Material consumption"), href: "/manufacturing/consumption", group: text("التشغيل", "Exécution", "Execution") },
      { id: "stages", label: text("المراحل", "Étapes", "Stages"), href: "/manufacturing/stages", group: text("التشغيل", "Exécution", "Execution") },
      { id: "output", label: text("المخرجات", "Produits finis", "Production output"), href: "/manufacturing/output", group: text("التشغيل", "Exécution", "Execution") },
      { id: "quality", label: text("الجودة", "Qualité", "Quality"), href: "/manufacturing/quality", group: text("الرقابة", "Contrôle", "Control") },
      { id: "traceability", label: text("التتبع", "Traçabilité", "Traceability"), href: "/manufacturing/traceability", group: text("الرقابة", "Contrôle", "Control") },
      { id: "costs", label: text("تكاليف الإنتاج", "Coûts de production", "Production costs"), href: "/manufacturing/costs", group: text("الرقابة", "Contrôle", "Control") },
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
      { id: "routes", label: text("الجولات والتسليم", "Tournées et livraisons", "Routes & delivery"), href: "/distribution/routes", group: text("التوزيع", "Distribution", "Distribution") },
      { id: "fleet", label: text("المركبات والأسطول", "Véhicules et flotte", "Vehicles & fleet"), href: "/distribution/vehicles", group: text("الأسطول", "Flotte", "Fleet") },
      { id: "territories", label: text("نطاقات التوزيع", "Zones de distribution", "Distribution territories"), href: "/distribution/territories", group: text("الأسطول", "Flotte", "Fleet") },
      { id: "compliance", label: text("تنبيهات المركبات", "Alertes véhicules", "Vehicle alerts"), href: "/distribution/compliance", group: text("الأسطول", "Flotte", "Fleet") },
      { id: "logistics-check", label: text("فحص اللوجستيك", "Contrôle logistique", "Logistics check"), href: "/logistics-check", group: text("العمليات الميدانية", "Opérations terrain", "Field operations"), externalExperience: true },
      { id: "driver", label: text("مساحة السائق", "Espace conducteur", "Driver workspace"), href: "/driver", group: text("العمليات الميدانية", "Opérations terrain", "Field operations"), externalExperience: true },
    ],
  },
  {
    id: "retail",
    icon: Store,
    name: text("بوابة التاجر", "Portail marchand", "Merchant Portal"),
    description: text("إدارة علاقات التجار والطلبات والتسعير B2B", "Gestion des relations marchands, commandes et tarifs B2B", "Merchant relationships, orders, and B2B pricing"),
    href: "/b2b-orders",
    accent: "amber",
    requiredModules: ["nawa_retail"],
    localNavigation: [
      { id: "supplier", label: text("مركز التاجر", "Centre marchand", "Merchant center"), href: "/b2b-orders", group: text("إدارة البوابة", "Gestion du portail", "Portal administration") },
      { id: "accesses", label: text("علاقات التجار", "Relations marchands", "Merchant relationships"), href: "/retail/accesses", group: text("إدارة البوابة", "Gestion du portail", "Portal administration") },
      { id: "outlets", label: text("منافذ التجار", "Points de vente", "Merchant outlets"), href: "/retail/outlets", group: text("إدارة البوابة", "Gestion du portail", "Portal administration") },
      { id: "retail-users", label: text("مستخدمو التجار", "Utilisateurs marchands", "Merchant users"), href: "/retail/users", group: text("إدارة البوابة", "Gestion du portail", "Portal administration") },
      { id: "promotions", label: text("عروض B2B", "Offres B2B", "B2B promotions"), href: "/retail/promotions", group: text("العروض", "Offres", "Promotions") },
      { id: "retail-orders", label: text("طلبات التجار", "Commandes marchands", "Merchant orders"), href: "/retail/orders", group: text("الطلبات", "Commandes", "Orders") },
      { id: "returns", label: text("طلبات الإرجاع", "Demandes de retour", "Return requests"), href: "/retail/returns", group: text("الطلبات", "Commandes", "Orders") },
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
      { id: "accounts", label: text("دليل الحسابات", "Plan comptable", "Chart of accounts"), href: "/finance/accounts", group: text("المحاسبة", "Comptabilité", "Accounting") },
      { id: "entries", label: text("قيود اليومية", "Écritures", "Journal entries"), href: "/finance/entries", group: text("المحاسبة", "Comptabilité", "Accounting") },
      { id: "aging", label: text("الذمم", "Balances âgées", "Aging"), href: "/finance/aging", group: text("الرقابة", "Contrôle", "Control") },
      { id: "treasury", label: text("الخزينة", "Trésorerie", "Treasury"), href: "/finance/treasury", group: text("الرقابة", "Contrôle", "Control") },
      { id: "reports", label: text("التقارير المالية", "Rapports financiers", "Financial reports"), href: "/finance/reports", group: text("التقارير", "Rapports", "Reports") },
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
      { id: "employees", label: text("الموظفون", "Employés", "Employees"), href: "/hr/employees", group: text("الإدارة", "Administration", "Administration") },
      { id: "attendance", label: text("الحضور", "Présences", "Attendance"), href: "/hr/attendance", group: text("الوقت والإجازات", "Temps et congés", "Time & leave") },
      { id: "overtime", label: text("العمل الإضافي", "Heures supplémentaires", "Overtime"), href: "/hr/overtime", group: text("الوقت والإجازات", "Temps et congés", "Time & leave") },
      { id: "leave", label: text("الإجازات", "Congés", "Leave"), href: "/hr/leave", group: text("الوقت والإجازات", "Temps et congés", "Time & leave") },
      { id: "payroll", label: text("الرواتب", "Paie", "Payroll"), href: "/hr/payroll", group: text("الرواتب", "Paie", "Payroll") },
      { id: "self-service", label: text("الخدمة الذاتية", "Libre-service", "Self-service"), href: "/self-service", group: text("تجارب مستقلة", "Expériences indépendantes", "Independent experiences"), externalExperience: true },
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
      { id: "decision-alerts", label: text("تنبيهات تحتاج قرار", "Alertes à décider", "Decision alerts"), href: "/alerts", group: text("الإدارة", "Administration", "Administration") },
      { id: "organization", label: text("المؤسسة", "Organisation", "Organization"), href: "/settings?section=organization", group: text("الإدارة", "Administration", "Administration") },
      { id: "language", label: text("اللغة", "Langue", "Language"), href: "/settings?section=language", group: text("التفضيلات", "Préférences", "Preferences") },
      { id: "currencies", label: text("العملات", "Devises", "Currencies"), href: "/settings?section=currencies", group: text("التفضيلات", "Préférences", "Preferences") },
      { id: "exchange-rates", label: text("أسعار الصرف", "Taux de change", "Exchange rates"), href: "/settings?section=exchangeRates", group: text("التفضيلات", "Préférences", "Preferences") },
      { id: "date-numbers", label: text("التاريخ والأرقام", "Dates et nombres", "Dates & numbers"), href: "/settings?section=dateAndNumbers", group: text("التفضيلات", "Préférences", "Preferences") },
      { id: "appearance", label: text("ألوان رصين", "Couleurs RASEEN", "RASEEN colors"), href: "/appearance", group: text("التفضيلات", "Préférences", "Preferences") },
      { id: "typography", label: text("الخطوط والوصول", "Typographie et accessibilité", "Typography & accessibility"), href: "/settings?section=typography", group: text("التفضيلات", "Préférences", "Preferences") },
      { id: "module-view", label: text("عرض الوحدات", "Vue des modules", "Module view"), href: "/settings?section=moduleView", group: text("التفضيلات", "Préférences", "Preferences") },
      { id: "printing", label: text("الطباعة والمستندات", "Impression et documents", "Printing & documents"), href: "/settings?section=printing", group: text("الإدارة", "Administration", "Administration") },
      { id: "vat", label: text("ضريبة القيمة المضافة", "TVA", "Value-added tax"), href: "/settings?section=vat", group: text("الإدارة", "Administration", "Administration") },
      { id: "branches", label: text("الفروع", "Succursales", "Branches"), href: "/settings?section=branches", group: text("الإدارة", "Administration", "Administration") },
      { id: "users", label: text("المستخدمون", "Utilisateurs", "Users"), href: "/settings?section=users", group: text("الإدارة", "Administration", "Administration") },
      { id: "notifications", label: text("الإشعارات", "Notifications", "Notifications"), href: "/settings?section=notifications", group: text("الإدارة", "Administration", "Administration") },
      { id: "security", label: text("الأمان", "Sécurité", "Security"), href: "/settings?section=security", group: text("الإدارة", "Administration", "Administration") },
      { id: "backup", label: text("النسخ والتعافي", "Sauvegarde et reprise", "Backup & recovery"), href: "/settings?section=backup", group: text("الإدارة", "Administration", "Administration") },
      { id: "settings", label: text("ملخص الإعدادات", "Résumé des paramètres", "Settings overview"), href: "/settings", group: text("الإدارة", "Administration", "Administration") },
      { id: "modules", label: text("الوحدات والاشتراكات", "Modules et abonnements", "Modules & subscriptions"), href: "/modules", group: text("الاشتراك", "Abonnement", "Subscription") },
      { id: "about", label: text("حول رصين", "À propos de RASEEN", "About RASEEN"), href: "/about", group: text("الإدارة", "Administration", "Administration") },
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
  if (path.startsWith("/settings") || path.startsWith("/appearance") || path.startsWith("/about") || path.startsWith("/modules") || path.startsWith("/alerts")) return getPortal("administration");
  return undefined;
}
