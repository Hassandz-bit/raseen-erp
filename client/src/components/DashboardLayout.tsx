import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { startLogin } from "@/const";
import { getPortalForPath, getPortalNavigationIcon, nawaPortals, type PortalNavigationItem } from "@/config/nawaPortals";
import { RASEEN_APP_ICON_URL, RASEEN_PRINT_LOGO_URL } from "@/config/raseenBrandAssets";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Bell, CheckCheck, ChevronDown, ChevronLeft, CircleHelp, Download, Grid2X2, Home, Inbox, Loader2, LogOut, Menu, Pin, PinOff, Plus, Search, Settings2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useLocation, useSearch } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { PagePrintPreview } from "./PagePrintPreview";

const ACTIVE_BRANCH_KEY = "nawa:active-branch";
const NAVIGATION_MODE_KEY = "nawa:navigation-mode";
type NavigationMode = "auto" | "expanded" | "compact";

const portalChrome = {
  ar: { portals: "كل البوابات", executive: "الملخص التنفيذي", workspace: "مساحة العمل", tools: "أدوات البوابة", notifications: "التنبيهات", markAllRead: "تحديد الكل كمقروء", emptyNotifications: "لا توجد تنبيهات حديثة", ai: "ذكاء رصين", demo: "بيانات تجريبية", portalSearch: "ابحث عن منتج، عميل، طلب، فاتورة أو صفحة...", searchTools: "ابحث في أدوات هذه البوابة", commandTitle: "أوامر رصين", commandDescription: "انتقل إلى بوابة أو أداة متاحة لك", pages: "الصفحات والأدوات", quickCreate: "إنشاء", quickCreateHint: "إجراء سريع في البوابة الحالية", noQuickCreate: "لا توجد إجراءات سريعة لهذه البوابة", pinNav: "تثبيت التنقل الموسع", unpinNav: "العودة للوضع التلقائي", navAuto: "تلقائي", navExpanded: "موسع", navCompact: "مضغوط", defaultBranch: "الفرع الافتراضي", profile: "الملف الشخصي", preferences: "التفضيلات", settings: "الإعدادات", print: "طباعة الصفحة", noResults: "لا توجد صفحات أو أدوات مطابقة", operational: "وضع العمل", discovery: "استكشاف البوابة" },
  fr: { portals: "Tous les portails", executive: "Vue exécutive", workspace: "Espace de travail", tools: "Outils du portail", notifications: "Notifications", markAllRead: "Tout marquer comme lu", emptyNotifications: "Aucune notification récente", ai: "RASEEN AI", demo: "Données de démonstration", portalSearch: "Rechercher un produit, client, commande, facture ou page…", searchTools: "Rechercher dans les outils du portail", commandTitle: "Commandes RASEEN", commandDescription: "Accédez à un portail ou outil autorisé", pages: "Pages et outils", quickCreate: "Créer", quickCreateHint: "Action rapide du portail actuel", noQuickCreate: "Aucune action rapide pour ce portail", pinNav: "Épingler la navigation développée", unpinNav: "Revenir au mode automatique", navAuto: "Automatique", navExpanded: "Développé", navCompact: "Compact", defaultBranch: "Branche par défaut", profile: "Profil", preferences: "Préférences", settings: "Paramètres", print: "Imprimer la page", noResults: "Aucune page ou outil correspondant", operational: "Mode travail", discovery: "Découvrir le portail" },
  en: { portals: "All portals", executive: "Executive overview", workspace: "Workspace", tools: "Portal tools", notifications: "Notifications", markAllRead: "Mark all as read", emptyNotifications: "No recent notifications", ai: "RASEEN AI", demo: "Demo data", portalSearch: "Search a product, customer, order, invoice, or page…", searchTools: "Search this portal's tools", commandTitle: "RASEEN commands", commandDescription: "Navigate to a portal or tool available to you", pages: "Pages & tools", quickCreate: "Create", quickCreateHint: "Quick action for the current portal", noQuickCreate: "No quick actions for this portal", pinNav: "Pin expanded navigation", unpinNav: "Return to auto mode", navAuto: "Auto", navExpanded: "Expanded", navCompact: "Compact", defaultBranch: "Default branch", profile: "Profile", preferences: "Preferences", settings: "Settings", print: "Print page", noResults: "No matching pages or tools", operational: "Work mode", discovery: "Explore portal" },
} as const;

function getStoredNavigationMode(value: string | null): NavigationMode {
  return value === "expanded" || value === "compact" || value === "auto" ? value : "auto";
}

function formatNotificationTime(value: Date | string | number, language: "ar" | "fr" | "en") {
  return new Intl.DateTimeFormat(language === "ar" ? "ar" : language === "fr" ? "fr-FR" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function RailButton({ label, active = false, onClick, badge, expanded = false, onPointerEnter, children, tooltipSide }: { label: string; active?: boolean; onClick: () => void; badge?: number; expanded?: boolean; onPointerEnter?: () => void; children: ReactNode; tooltipSide: "left" | "right" }) {
  return <Tooltip delayDuration={240}><TooltipTrigger asChild><button type="button" aria-label={label} aria-current={active ? "page" : undefined} onPointerEnter={onPointerEnter} onClick={onClick} className={`nawa-rail-button relative ${active ? "nawa-rail-button-active" : ""} ${expanded ? "nawa-rail-button-expanded" : ""}`}><span className="nawa-rail-button-icon">{children}</span>{expanded ? <span className="nawa-rail-label">{label}</span> : null}{badge ? <span className="absolute -end-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-extrabold text-primary-foreground">{badge > 99 ? "99+" : badge}</span> : null}</button></TooltipTrigger><TooltipContent side={tooltipSide} className="font-semibold">{label}</TooltipContent></Tooltip>;
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth();
  const { direction, t } = useLanguage();
  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return <div dir={direction} className="grid min-h-svh place-items-center p-6"><section className="nawa-auth-card w-full max-w-md rounded-[1.75rem] p-8 text-center"><p className="text-sm font-semibold text-primary">RASEEN ERP</p><h1 className="mt-3 text-2xl font-black text-foreground">{t("signInToContinue")}</h1><p className="mt-3 text-sm leading-7 text-muted-foreground">{t("workspaceAccountRequired")}</p><Button onClick={() => startLogin()} size="lg" className="mt-7 w-full">{t("signIn")}</Button></section></div>;
  return <DashboardLayoutContent>{children}</DashboardLayoutContent>;
}

function DashboardLayoutContent({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { direction, language, t } = useLanguage();
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const pathWithoutQuery = location.split(/[?#]/)[0];
  const currentHash = window.location.hash;
  const activePortal = getPortalForPath(pathWithoutQuery);
  const chrome = portalChrome[language];
  const isPortalLauncher = pathWithoutQuery === "/";
  const isPortalOverview = Boolean(activePortal && pathWithoutQuery === activePortal.href);
  const localItems = activePortal?.localNavigation ?? [];
  const activeMenuItem = localItems.find(item => item.href.includes("#") ? `${pathWithoutQuery}${currentHash}` === item.href : item.href.includes("?") ? `${pathWithoutQuery}${search}` === item.href : !currentHash && pathWithoutQuery === item.href)
    ?? localItems.filter(item => !item.href.includes("#") && !item.href.includes("?") && pathWithoutQuery.startsWith(`${item.href}/`)).sort((a, b) => b.href.length - a.href.length)[0];
  const groups = useMemo<Array<{ key: string; label: string; items: PortalNavigationItem[] }>>(() => {
    const map = new Map<string, { key: string; label: string; items: PortalNavigationItem[] }>();
    localItems.forEach(item => {
      const key = item.group.ar;
      const existing = map.get(key);
      if (existing) existing.items.push(item);
      else map.set(key, { key, label: item.group[language], items: [item] });
    });
    return Array.from(map.values());
  }, [language, localItems]);
  const preferenceKey = `${NAVIGATION_MODE_KEY}:${user?.id ?? "anonymous"}`;
  const [navigationMode, setNavigationMode] = useState<NavigationMode>(() => getStoredNavigationMode(localStorage.getItem(preferenceKey)));
  const [isPanelOpen, setPanelOpen] = useState(false);
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
  const [isRailOpenOnMobile, setRailOpenOnMobile] = useState(false);
  const [toolQuery, setToolQuery] = useState("");
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bootstrap = trpc.erp.bootstrap.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const organizationSettings = trpc.erp.preferences.organization.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const branches = trpc.erp.preferences.availableBranches.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(() => { const id = Number(localStorage.getItem(ACTIVE_BRANCH_KEY)); return Number.isInteger(id) && id > 0 ? id : null; });
  const selectedBranch = (branches.data ?? []).find(branch => branch.id === selectedBranchId) ?? branches.data?.[0];
  const notifications = trpc.erp.notifications.list.useQuery(undefined, { retry: false, refetchInterval: 30_000, refetchOnWindowFocus: true });
  const utilities = trpc.useUtils();
  const markRead = trpc.erp.notifications.markRead.useMutation({ onSuccess: () => utilities.erp.notifications.list.invalidate() });
  const markAllRead = trpc.erp.notifications.markAllRead.useMutation({ onSuccess: () => utilities.erp.notifications.list.invalidate() });
  const unreadCount = (notifications.data ?? []).filter(notification => notification.isRead === "no").length;
  const effectiveNavigationMode: Exclude<NavigationMode, "auto"> = navigationMode === "auto" ? (isPortalOverview ? "expanded" : "compact") : navigationMode;
  const navigationIsExpanded = effectiveNavigationMode === "expanded";
  const navigationRendersExpanded = navigationIsExpanded || isRailOpenOnMobile;
  const selectedGroup = groups.find(group => group.key === activeGroupKey) ?? groups.find(group => group.items.some(item => item.id === activeMenuItem?.id)) ?? groups[0];
  const normalizedQuery = toolQuery.trim().toLocaleLowerCase(language === "ar" ? "ar" : language);
  const filteredTools = (selectedGroup?.items ?? []).filter(item => `${item.label[language]} ${item.group[language]}`.toLocaleLowerCase(language === "ar" ? "ar" : language).includes(normalizedQuery));
  const PortalIcon = activePortal?.icon ?? Grid2X2;
  const isDemo = bootstrap.data?.organization?.isDemo === "yes";
  const activeModuleKeys = useMemo(() => new Set((bootstrap.data?.modules ?? []).filter(module => module.status === "active").map(module => module.key)), [bootstrap.data?.modules]);
  const allowedPortals = useMemo(() => nawaPortals.filter(portal => portal.requiredModules.length === 0 || portal.requiredModules.some(module => activeModuleKeys.has(module))), [activeModuleKeys]);
  const commandItems = useMemo(() => allowedPortals.flatMap(portal => portal.localNavigation.map(item => ({ ...item, portal }))), [allowedPortals]);
  const commandSearchInput = useMemo(() => ({ query: commandQuery.trim() }), [commandQuery]);
  const commandEntitySearch = trpc.erp.navigation.commandSearch.useQuery(commandSearchInput, { enabled: commandOpen && commandSearchInput.query.length >= 2, retry: false, refetchOnWindowFocus: false });
  const quickActions = useMemo(() => {
    const actions = activePortal?.id === "commerce" ? [{ label: language === "ar" ? "فاتورة مبيعات" : language === "fr" ? "Facture de vente" : "Sales invoice", href: "/commerce#operations" }, { label: language === "ar" ? "طلب شراء" : language === "fr" ? "Commande d’achat" : "Purchase order", href: "/commerce/purchases" }]
      : activePortal?.id === "manufacturing" ? [{ label: language === "ar" ? "أمر إنتاج" : language === "fr" ? "Ordre de production" : "Production order", href: "/manufacturing/orders" }, { label: language === "ar" ? "فحص جودة" : language === "fr" ? "Contrôle qualité" : "Quality check", href: "/manufacturing/quality" }]
        : activePortal?.id === "distribution" ? [{ label: language === "ar" ? "جولة" : language === "fr" ? "Tournée" : "Route", href: "/distribution/routes" }, { label: language === "ar" ? "مركبة" : language === "fr" ? "Véhicule" : "Vehicle", href: "/distribution/vehicles" }]
          : activePortal?.id === "retail" ? [{ label: language === "ar" ? "تاجر" : language === "fr" ? "Détaillant" : "Retailer", href: "/retail/accesses" }, { label: language === "ar" ? "عرض B2B" : language === "fr" ? "Offre B2B" : "B2B promotion", href: "/retail/promotions" }]
            : activePortal?.id === "finance" ? [{ label: language === "ar" ? "قيد يومية" : language === "fr" ? "Écriture" : "Journal entry", href: "/finance/entries" }, { label: language === "ar" ? "تحصيل" : language === "fr" ? "Encaissement" : "Collection", href: "/finance/treasury" }]
              : activePortal?.id === "hr" ? [{ label: language === "ar" ? "موظف" : language === "fr" ? "Employé" : "Employee", href: "/hr/employees" }, { label: language === "ar" ? "إجازة" : language === "fr" ? "Congé" : "Leave", href: "/hr/leave" }]
                : [];
    return actions;
  }, [activePortal?.id, language]);
  const canQuickCreate = ["owner", "admin"].includes(bootstrap.data?.membership?.roleKey ?? "");

  const clearHoverTimer = useCallback(() => { if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null; } }, []);
  const openGroup = useCallback((key: string) => { clearHoverTimer(); setActiveGroupKey(key); setToolQuery(""); setPanelOpen(true); }, [clearHoverTimer]);
  const closePanelSoon = useCallback(() => { clearHoverTimer(); hoverTimer.current = setTimeout(() => setPanelOpen(false), 320); }, [clearHoverTimer]);
  const navigate = useCallback((href: string) => { setLocation(href); setPanelOpen(false); setRailOpenOnMobile(false); }, [setLocation]);

  useEffect(() => { setNavigationMode(getStoredNavigationMode(localStorage.getItem(preferenceKey))); }, [preferenceKey]);
  useEffect(() => { localStorage.setItem(preferenceKey, navigationMode); }, [navigationMode, preferenceKey]);
  useEffect(() => { if (selectedBranch) localStorage.setItem(ACTIVE_BRANCH_KEY, String(selectedBranch.id)); }, [selectedBranch]);
  useEffect(() => () => clearHoverTimer(), [clearHoverTimer]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandOpen(true); }
      if (event.key === "Escape") { setPanelOpen(false); setRailOpenOnMobile(false); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const OrganizationPicker = () => <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="nawa-organization-switcher"><span className="min-w-0"><span className="block truncate text-sm font-bold text-foreground">{bootstrap.data?.organization?.name ?? "—"}</span><span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground"><span className="truncate">{selectedBranch?.name ?? chrome.defaultBranch}</span><ChevronDown className="h-3.5 w-3.5 shrink-0" /></span></span>{isDemo ? <Badge className="hidden border-primary/25 bg-primary/10 text-[10px] text-primary hover:bg-primary/10 xl:inline-flex">{chrome.demo}</Badge> : null}</button></DropdownMenuTrigger><DropdownMenuContent align={direction === "rtl" ? "start" : "end"} className="w-64 rounded-2xl p-1.5">{branches.isLoading ? <div className="grid min-h-20 place-items-center"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div> : branches.data?.length ? branches.data.map(branch => <DropdownMenuItem key={branch.id} onClick={() => { setSelectedBranchId(branch.id); toast.success(branch.name); }} className={`mt-1 cursor-pointer rounded-xl py-2.5 ${selectedBranch?.id === branch.id ? "bg-primary/10 font-bold text-primary focus:bg-primary/10 focus:text-primary" : ""}`}><span className="min-w-0"><span className="block truncate">{branch.name}</span><span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">{branch.code}</span></span></DropdownMenuItem>) : <p className="px-3 py-4 text-center text-xs text-muted-foreground">{chrome.defaultBranch}</p>}</DropdownMenuContent></DropdownMenu>;

  const NotificationMenu = () => <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={chrome.notifications} className="nawa-header-icon relative"><Bell className="h-5 w-5" />{unreadCount ? <span className="absolute end-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-extrabold text-primary-foreground">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}</Button></DropdownMenuTrigger><DropdownMenuContent align={direction === "rtl" ? "start" : "end"} className="w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl p-0"><div className="flex items-center justify-between border-b border-border/70 px-4 py-3"><p className="text-sm font-black">{chrome.notifications}</p><Button variant="ghost" size="sm" onClick={() => markAllRead.mutate()} disabled={!unreadCount || markAllRead.isPending} className="h-8 gap-1.5 text-xs text-primary"><CheckCheck className="h-4 w-4" />{chrome.markAllRead}</Button></div><div className="max-h-80 overflow-y-auto p-1.5">{notifications.isLoading ? <div className="grid min-h-28 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : notifications.data?.length ? notifications.data.slice(0, 6).map(notification => <button key={notification.id} type="button" onClick={() => notification.isRead === "no" && markRead.mutate({ notificationId: notification.id })} className={`w-full rounded-xl p-3 text-start transition-colors hover:bg-primary/[.06] ${notification.isRead === "no" ? "bg-primary/[.04]" : ""}`}><span className="flex gap-2.5"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.isRead === "no" ? "bg-primary" : "bg-muted-foreground/30"}`} /><span className="min-w-0"><span className="block truncate text-sm font-bold">{notification.title}</span><span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">{notification.content}</span><span className="mt-1.5 block text-[10px] text-muted-foreground">{formatNotificationTime(notification.createdAt, language)}</span></span></span></button>) : <div className="grid min-h-28 place-items-center gap-2 text-center text-sm text-muted-foreground"><Inbox className="h-5 w-5 text-primary" />{chrome.emptyNotifications}</div>}</div></DropdownMenuContent></DropdownMenu>;

  const navigationModeLabel = navigationMode === "auto" ? chrome.navAuto : navigationMode === "expanded" ? chrome.navExpanded : chrome.navCompact;
  const tooltipSide = direction === "rtl" ? "left" : "right";

  return <div dir={direction} className="nawa-app-shell">
    <header className="nawa-global-header nawa-command-bar">
      <div className="nawa-header-topline">
        <div className="nawa-header-brandline">
          <button type="button" onClick={() => navigate("/")} className="nawa-wordmark" aria-label={chrome.portals} title={chrome.portals}><span className="nawa-wordmark-mark"><img src={RASEEN_APP_ICON_URL} alt="" /></span><span className="hidden text-sm font-black tracking-tight sm:inline">RASEEN ERP</span></button>
        </div>
        <div className="nawa-header-organization">
          <OrganizationPicker />
        </div>
        <nav className="nawa-header-context" aria-label={isPortalLauncher ? chrome.portals : activePortal?.name[language] ?? chrome.executive}>
          <button type="button" onClick={() => activePortal ? navigate(activePortal.href) : navigate("/executive")} className="nawa-header-context-portal" title={isPortalLauncher ? chrome.portals : activePortal?.name[language] ?? chrome.executive}><PortalIcon className="h-5 w-5 shrink-0" /><span className="truncate">{isPortalLauncher ? chrome.portals : activePortal?.name[language] ?? chrome.executive}</span></button>
        </nav>
        <span className="nawa-header-top-spacer" aria-hidden="true" />
        <div className="nawa-header-accountline">
          <span className="nawa-header-usercopy hidden lg:grid"><strong className="truncate">{user?.name || "—"}</strong><small>{chrome.profile}</small></span>
          <DropdownMenu><DropdownMenuTrigger asChild><button type="button" aria-label={chrome.profile} title={chrome.profile} className="rounded-xl p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Avatar className="h-9 w-9 border border-primary/20"><AvatarFallback className="bg-primary/10 text-xs font-black text-primary">{user?.name?.charAt(0).toUpperCase() || "R"}</AvatarFallback></Avatar></button></DropdownMenuTrigger><DropdownMenuContent align={direction === "rtl" ? "start" : "end"} className="w-52 rounded-2xl p-1.5"><div className="px-2.5 py-2"><p className="truncate text-sm font-bold">{user?.name || "—"}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{user?.email || "—"}</p></div><DropdownMenuSeparator /><DropdownMenuItem onClick={() => navigate("/settings?section=appearance")} className="cursor-pointer rounded-xl py-2.5"><Settings2 className="me-2 h-4 w-4" />{chrome.preferences}</DropdownMenuItem><DropdownMenuItem onClick={logout} className="cursor-pointer rounded-xl py-2.5 text-destructive focus:text-destructive"><LogOut className="me-2 h-4 w-4" />{t("signOut")}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        </div>
      </div>
      <div className="nawa-header-workline">
        <nav className="nawa-header-navigation" aria-label={chrome.portals}>
          {!isPortalLauncher ? <Button variant="ghost" size="icon" onClick={() => setRailOpenOnMobile(true)} aria-label={chrome.tools} title={chrome.tools} className="nawa-mobile-rail-trigger"><Menu className="h-5 w-5" /></Button> : null}
          <button type="button" onClick={() => navigate("/")} className="nawa-mobile-wordmark sm:hidden" aria-label={chrome.portals} title={chrome.portals}><img src={RASEEN_APP_ICON_URL} alt="" /></button>
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label={chrome.portals} title={chrome.portals} className="nawa-header-icon hidden sm:inline-grid"><Grid2X2 className="h-5 w-5" /></Button>
          <span className="nawa-workline-divider hidden sm:block" aria-hidden="true" />
          <span className="nawa-header-breadcrumb truncate">{activeMenuItem?.label[language] ?? chrome.executive}</span>
        </nav>
        <div className="nawa-header-search">
          <button type="button" onClick={() => setCommandOpen(true)} className="nawa-command-trigger" aria-label={chrome.portalSearch} title={chrome.portalSearch}><Search className="h-5 w-5 shrink-0" /><span className="truncate">{chrome.portalSearch}</span><kbd className="hidden shrink-0 lg:inline-flex">⌘K</kbd></button>
        </div>
        <div className="nawa-header-utilities">
          {canQuickCreate && quickActions.length ? <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" className="nawa-quick-create hidden gap-1.5 sm:inline-flex"><Plus className="h-4 w-4" />{chrome.quickCreate}</Button></DropdownMenuTrigger><DropdownMenuContent align={direction === "rtl" ? "start" : "end"} className="w-56 rounded-2xl p-1.5"><DropdownMenuLabel className="px-2.5 py-2 text-xs text-muted-foreground">{chrome.quickCreateHint}</DropdownMenuLabel><DropdownMenuSeparator />{quickActions.map(action => <DropdownMenuItem key={action.href} onClick={() => navigate(action.href)} className="cursor-pointer rounded-xl py-2.5"><Plus className="me-2 h-4 w-4 text-primary" />{action.label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu> : null}
          <Button variant="ghost" size="icon" onClick={() => setCommandOpen(true)} aria-label={chrome.portalSearch} title={chrome.portalSearch} className="nawa-header-icon lg:hidden"><Search className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" onClick={() => window.dispatchEvent(new Event("nawa-pwa-open-install"))} aria-label={language === "ar" ? "تثبيت التطبيق" : language === "fr" ? "Installer l’application" : "Install app"} title={language === "ar" ? "تثبيت التطبيق" : language === "fr" ? "Installer l’application" : "Install app"} className="nawa-header-icon"><Download className="h-5 w-5" /></Button>
          <PagePrintPreview language={language} direction={direction} organizationName={bootstrap.data?.organization?.name ?? "RASEEN ERP"} pageLabel={`${activePortal?.name[language] ?? chrome.executive}${activeMenuItem ? ` · ${activeMenuItem.label[language]}` : ""}`} documentSettings={organizationSettings.data?.documentSettings} />
          <NotificationMenu />
          <Button variant="ghost" size="icon" onClick={() => toast.info(language === "ar" ? "سيضاف مركز المساعدة في تحديث لاحق." : language === "fr" ? "Le centre d’aide sera ajouté dans une prochaine mise à jour." : "The help center will be added in a future update.")} aria-label={language === "ar" ? "المساعدة" : language === "fr" ? "Aide" : "Help"} title={language === "ar" ? "المساعدة" : language === "fr" ? "Aide" : "Help"} className="nawa-header-icon"><CircleHelp className="h-5 w-5" /></Button>
        </div>
      </div>
    </header>

    <CommandDialog open={commandOpen} onOpenChange={open => { setCommandOpen(open); if (!open) setCommandQuery(""); }} title={chrome.commandTitle} description={chrome.commandDescription} className="nawa-command-dialog" showCloseButton={false}>
      <CommandInput value={commandQuery} onValueChange={setCommandQuery} placeholder={chrome.portalSearch} />
      <CommandList className="max-h-[min(58vh,32rem)]">
        <CommandEmpty>{chrome.noResults}</CommandEmpty>
        {commandSearchInput.query.length >= 2 && commandEntitySearch.isLoading ? <div className="flex items-center gap-2 px-4 py-5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" />{chrome.portalSearch}</div> : null}
        {commandEntitySearch.data?.products.length ? <CommandGroup heading={language === "ar" ? "المنتجات" : language === "fr" ? "Produits" : "Products"}>{commandEntitySearch.data.products.map(result => <CommandItem key={`product-${result.id}`} value={`product ${result.label} ${result.detail}`} onSelect={() => { navigate("/commerce/products"); setCommandOpen(false); }}><Search /><span className="min-w-0 flex-1 truncate">{result.label}</span><CommandShortcut>{result.detail}</CommandShortcut></CommandItem>)}</CommandGroup> : null}
        {commandEntitySearch.data?.customers.length ? <CommandGroup heading={language === "ar" ? "العملاء" : language === "fr" ? "Clients" : "Customers"}>{commandEntitySearch.data.customers.map(result => <CommandItem key={`customer-${result.id}`} value={`customer ${result.label} ${result.detail}`} onSelect={() => { navigate("/commerce/sales"); setCommandOpen(false); }}><Search /><span className="min-w-0 flex-1 truncate">{result.label}</span><CommandShortcut>{result.detail}</CommandShortcut></CommandItem>)}</CommandGroup> : null}
        {commandEntitySearch.data?.invoices.length ? <CommandGroup heading={language === "ar" ? "الفواتير" : language === "fr" ? "Factures" : "Invoices"}>{commandEntitySearch.data.invoices.map(result => <CommandItem key={`invoice-${result.id}`} value={`invoice ${result.label} ${result.detail}`} onSelect={() => { navigate(`/commerce/sales/${result.id}`); setCommandOpen(false); }}><Search /><span className="min-w-0 flex-1 truncate">{result.label}</span><CommandShortcut>{result.detail}</CommandShortcut></CommandItem>)}</CommandGroup> : null}
        {activePortal ? <CommandGroup heading={`${activePortal.name[language]} · ${chrome.pages}`}>{localItems.map(item => { const ItemIcon = getPortalNavigationIcon(item.id, activePortal.icon); return <CommandItem key={`active-${item.id}`} value={`${item.label[language]} ${item.group[language]}`} onSelect={() => { navigate(item.href); setCommandOpen(false); }}><ItemIcon /><span>{item.label[language]}</span><CommandShortcut>{item.group[language]}</CommandShortcut></CommandItem>; })}</CommandGroup> : null}
        <CommandGroup heading={chrome.portals}>{allowedPortals.map(portal => { const Icon = portal.icon; return <CommandItem key={portal.id} value={`${portal.name[language]} ${portal.description[language]}`} onSelect={() => { navigate(portal.href); setCommandOpen(false); }}><Icon /><span>{portal.name[language]}</span><CommandShortcut>{chrome.discovery}</CommandShortcut></CommandItem>; })}</CommandGroup>
      </CommandList>
    </CommandDialog>

    <div className={`nawa-shell-body ${isPortalLauncher ? "nawa-shell-body-launcher" : ""}`}>
      {!isPortalLauncher ? <>
        <aside onPointerLeave={navigationRendersExpanded ? undefined : closePanelSoon} className={`nawa-navigation-rail ${navigationRendersExpanded ? "nawa-navigation-rail-expanded" : ""} ${isRailOpenOnMobile ? "nawa-navigation-rail-open" : ""}`} aria-label={chrome.tools}>
          <div className="nawa-rail-top"><RailButton tooltipSide={tooltipSide} label={chrome.portals} expanded={navigationRendersExpanded} onClick={() => navigate("/")}><Grid2X2 className="h-5 w-5" /></RailButton><RailButton tooltipSide={tooltipSide} label={activePortal?.name[language] ?? chrome.executive} active={!activeMenuItem} expanded={navigationRendersExpanded} onClick={() => activePortal ? navigate(activePortal.href) : navigate("/executive")}><Home className="h-5 w-5" /></RailButton></div>
          {navigationRendersExpanded ? <div className="nawa-expanded-navigation"><div className="nawa-expanded-navigation-head"><span>{isPortalOverview ? chrome.discovery : chrome.operational}</span><Button variant="ghost" size="icon" aria-label={navigationMode === "expanded" ? chrome.unpinNav : chrome.pinNav} onClick={() => setNavigationMode(navigationMode === "expanded" ? "auto" : "expanded")} className="h-8 w-8">{navigationMode === "expanded" ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}</Button></div>{groups.map(group => { const GroupIcon = getPortalNavigationIcon(group.items[0]?.id ?? "", activePortal?.icon ?? Grid2X2); const groupActive = group.items.some(item => item.id === activeMenuItem?.id); return <section key={group.key} className={`nawa-expanded-group ${groupActive ? "nawa-expanded-group-active" : ""}`}><p className="nawa-expanded-group-label"><GroupIcon className="h-3.5 w-3.5" />{group.label}</p>{group.items.map(item => { const ItemIcon = getPortalNavigationIcon(item.id, activePortal?.icon ?? Grid2X2); const isActive = item.id === activeMenuItem?.id; return <button key={item.id} type="button" aria-current={isActive ? "page" : undefined} onClick={() => navigate(item.href)} className={`nawa-expanded-page ${isActive ? "nawa-expanded-page-active" : ""}`}><ItemIcon className="h-4 w-4" /><span>{item.label[language]}</span>{isActive ? <span className="nawa-active-dot" /> : null}</button>; })}</section>; })}</div> : <div className="nawa-rail-groups">{groups.map(group => { const GroupIcon = getPortalNavigationIcon(group.items[0]?.id ?? "", activePortal?.icon ?? Grid2X2); const isActive = group.items.some(item => item.id === activeMenuItem?.id) || (isPanelOpen && selectedGroup?.key === group.key); return <RailButton key={group.key} tooltipSide={tooltipSide} label={group.label} active={isActive} onPointerEnter={() => { if (window.matchMedia("(min-width: 901px)").matches) { clearHoverTimer(); hoverTimer.current = setTimeout(() => openGroup(group.key), 240); } }} onClick={() => openGroup(group.key)}><GroupIcon className="h-5 w-5" /></RailButton>; })}</div>}
          <div className="nawa-rail-bottom"><RailButton tooltipSide={tooltipSide} label={navigationMode === "expanded" ? chrome.unpinNav : chrome.pinNav} expanded={navigationRendersExpanded} onClick={() => setNavigationMode(navigationMode === "expanded" ? "auto" : "expanded")}><Pin className="h-5 w-5" /></RailButton><RailButton tooltipSide={tooltipSide} label={navigationModeLabel} expanded={navigationRendersExpanded} onClick={() => setNavigationMode(navigationMode === "auto" ? "compact" : navigationMode === "compact" ? "expanded" : "auto")}><Settings2 className="h-5 w-5" /></RailButton></div>
        </aside>
        {isRailOpenOnMobile ? <button aria-label={chrome.tools} className="nawa-rail-backdrop" onClick={() => setRailOpenOnMobile(false)} /> : null}
        {!navigationRendersExpanded && isPanelOpen && selectedGroup ? <aside onPointerEnter={clearHoverTimer} onPointerLeave={closePanelSoon} className="nawa-context-panel" aria-label={chrome.tools}><div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3"><div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-[.12em] text-primary">{activePortal?.name[language]}</p><p className="mt-1 truncate text-base font-black text-foreground">{selectedGroup.label}</p></div><div className="flex items-center gap-1"><Button variant="ghost" size="icon" onClick={() => setNavigationMode("expanded")} aria-label={chrome.pinNav} className="h-8 w-8"><Pin className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => setPanelOpen(false)} aria-label={chrome.tools} className="h-8 w-8"><X className="h-4 w-4" /></Button></div></div><div className="border-b border-border/70 p-3"><label className="relative block"><Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input autoFocus value={toolQuery} onChange={event => setToolQuery(event.target.value)} placeholder={chrome.searchTools} className="h-10 w-full rounded-xl border border-border bg-muted/30 ps-3 pe-9 text-sm outline-none transition focus:border-primary/45 focus:ring-2 focus:ring-primary/15" /></label></div><div className="nawa-context-list">{filteredTools.length ? filteredTools.map(item => { const ItemIcon = getPortalNavigationIcon(item.id, activePortal?.icon ?? Grid2X2); const isActive = item.id === activeMenuItem?.id; return <button key={item.id} type="button" aria-current={isActive ? "page" : undefined} onClick={() => navigate(item.href)} className={`nawa-context-tool ${isActive ? "nawa-context-tool-active" : ""}`}><ItemIcon className="h-4 w-4" /><span className="min-w-0 flex-1 truncate">{item.label[language]}</span>{isActive ? <span className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}</button>; }) : <p className="px-4 py-8 text-center text-sm text-muted-foreground">{chrome.noResults}</p>}</div></aside> : null}
      </> : null}
      <div className="nawa-workspace"><div className="nawa-workspace-inner"><div className="nawa-print-only"><img src={RASEEN_PRINT_LOGO_URL} alt="RASEEN ERP" className="nawa-print-platform-logo" />{organizationSettings.data?.documentSettings?.logoUrl ? <img src={organizationSettings.data.documentSettings.logoUrl} alt="" className="nawa-print-organization-logo" /> : null}<span className="nawa-print-organization-copy"><strong>{bootstrap.data?.organization?.name ?? "RASEEN ERP"}</strong><span>{activePortal?.name[language] ?? chrome.executive}{activeMenuItem ? ` · ${activeMenuItem.label[language]}` : ""}</span></span><span className="nawa-print-organization-legal">{[organizationSettings.data?.documentSettings?.address, organizationSettings.data?.documentSettings?.phone, organizationSettings.data?.documentSettings?.taxNumber ? `${language === "ar" ? "الرقم الضريبي" : language === "fr" ? "N° fiscal" : "Tax number"}: ${organizationSettings.data.documentSettings.taxNumber}` : undefined, organizationSettings.data?.documentSettings?.legalInfo].filter(Boolean).map((item, index) => <span key={index}>{item}</span>)}</span><span>{new Intl.DateTimeFormat(language === "ar" ? "ar" : language === "fr" ? "fr-FR" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}</span></div>{!isPortalLauncher && activeMenuItem ? <div className="nawa-page-context"><span className="text-primary">{activePortal?.name[language]}</span><ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" /><span>{activeMenuItem.label[language]}</span></div> : null}{children}</div></div>
    </div>
  </div>;
}
