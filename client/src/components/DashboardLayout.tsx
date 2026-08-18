import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { startLogin } from "@/const";
import { getPortalForPath, getPortalNavigationIcon, type PortalNavigationItem } from "@/config/nawaPortals";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Bell, Bot, CheckCheck, ChevronDown, Grid2X2, Home, Inbox, Loader2, LogOut, Menu, Pin, PinOff, Search, Settings2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useLocation, useSearch } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const ACTIVE_BRANCH_KEY = "nawa:active-branch";
const PANEL_PIN_KEY = "nawa:navigation-panel-pinned";
const portalChrome = {
  ar: { portals: "بوابات نواة", executive: "الملخص التنفيذي", workspace: "مساحة العمل", tools: "أدوات البوابة", notifications: "التنبيهات", markAllRead: "تحديد الكل كمقروء", emptyNotifications: "لا توجد تنبيهات حديثة", settings: "الإعدادات", ai: "Nawa AI", demo: "بيانات Demo", searchTools: "ابحث في أدوات البوابة", pin: "تثبيت اللوحة", unpin: "إلغاء تثبيت اللوحة", close: "إغلاق", defaultBranch: "الفرع الافتراضي" },
  fr: { portals: "Portails Nawa", executive: "Vue exécutive", workspace: "Espace de travail", tools: "Outils du portail", notifications: "Notifications", markAllRead: "Tout marquer comme lu", emptyNotifications: "Aucune notification récente", settings: "Paramètres", ai: "Nawa AI", demo: "Données Demo", searchTools: "Rechercher dans les outils", pin: "Épingler le panneau", unpin: "Désépingler le panneau", close: "Fermer", defaultBranch: "Branche par défaut" },
  en: { portals: "Nawa portals", executive: "Executive overview", workspace: "Workspace", tools: "Portal tools", notifications: "Notifications", markAllRead: "Mark all as read", emptyNotifications: "No recent notifications", settings: "Settings", ai: "Nawa AI", demo: "Demo data", searchTools: "Search portal tools", pin: "Pin panel", unpin: "Unpin panel", close: "Close", defaultBranch: "Default branch" },
} as const;

function formatNotificationTime(value: Date | string | number, language: "ar" | "fr" | "en") {
  return new Intl.DateTimeFormat(language === "ar" ? "ar" : language === "fr" ? "fr-FR" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function RailButton({ label, active = false, onClick, badge, children }: { label: string; active?: boolean; onClick: () => void; badge?: number; children: ReactNode }) {
  return <Tooltip><TooltipTrigger asChild><button type="button" aria-label={label} onClick={onClick} className={`nawa-rail-button relative ${active ? "nawa-rail-button-active" : ""}`}>{children}{badge ? <span className="absolute -end-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-extrabold text-primary-foreground">{badge > 99 ? "99+" : badge}</span> : null}</button></TooltipTrigger><TooltipContent side="left" className="font-semibold">{label}</TooltipContent></Tooltip>;
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth();
  const { direction, t } = useLanguage();
  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return <div dir={direction} className="grid min-h-svh place-items-center p-6"><section className="nawa-auth-card w-full max-w-md rounded-[1.75rem] p-8 text-center"><p className="text-sm font-semibold text-primary">Nawa ERP</p><h1 className="mt-3 text-2xl font-black text-foreground">{t("signInToContinue")}</h1><p className="mt-3 text-sm leading-7 text-muted-foreground">{t("workspaceAccountRequired")}</p><Button onClick={() => startLogin()} size="lg" className="mt-7 w-full">{t("signIn")}</Button></section></div>;
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
  const localItems = activePortal?.localNavigation ?? [];
  const activeMenuItem = localItems.find(item => item.href.includes("#") ? `${pathWithoutQuery}${currentHash}` === item.href : item.href.includes("?") ? `${pathWithoutQuery}${search}` === item.href : !currentHash && pathWithoutQuery === item.href);
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
  const [isPanelOpen, setPanelOpen] = useState(false);
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
  const [isRailOpenOnMobile, setRailOpenOnMobile] = useState(false);
  const [toolQuery, setToolQuery] = useState("");
  const [pinnedPanel, setPinnedPanel] = useState(() => localStorage.getItem(PANEL_PIN_KEY) === "yes");
  const bootstrap = trpc.erp.bootstrap.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const branches = trpc.erp.preferences.availableBranches.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(() => { const id = Number(localStorage.getItem(ACTIVE_BRANCH_KEY)); return Number.isInteger(id) && id > 0 ? id : null; });
  const selectedBranch = (branches.data ?? []).find(branch => branch.id === selectedBranchId) ?? branches.data?.[0];
  const notifications = trpc.erp.notifications.list.useQuery(undefined, { retry: false, refetchInterval: 30_000, refetchOnWindowFocus: true });
  const utilities = trpc.useUtils();
  const markRead = trpc.erp.notifications.markRead.useMutation({ onSuccess: () => utilities.erp.notifications.list.invalidate() });
  const markAllRead = trpc.erp.notifications.markAllRead.useMutation({ onSuccess: () => utilities.erp.notifications.list.invalidate() });
  const unreadCount = (notifications.data ?? []).filter(notification => notification.isRead === "no").length;
  const previousPortal = useRef<string | undefined>(undefined);

  useEffect(() => { if (selectedBranch) localStorage.setItem(ACTIVE_BRANCH_KEY, String(selectedBranch.id)); }, [selectedBranch]);
  useEffect(() => { localStorage.setItem(PANEL_PIN_KEY, pinnedPanel ? "yes" : "no"); }, [pinnedPanel]);
  useEffect(() => {
    if (activePortal?.id !== previousPortal.current) {
      setToolQuery("");
      setActiveGroupKey(null);
      setPanelOpen(pinnedPanel);
      previousPortal.current = activePortal?.id;
    }
  }, [activePortal?.id, pinnedPanel]);

  const navigate = (href: string) => {
    setLocation(href);
    if (!pinnedPanel) setPanelOpen(false);
    setRailOpenOnMobile(false);
  };
  const selectedGroup = groups.find(group => group.key === activeGroupKey) ?? groups.find(group => group.items.some(item => item.id === activeMenuItem?.id)) ?? groups[0];
  const normalizedQuery = toolQuery.trim().toLocaleLowerCase(language === "ar" ? "ar" : language);
  const filteredTools = (selectedGroup?.items ?? []).filter(item => `${item.label[language]} ${item.group[language]}`.toLocaleLowerCase(language === "ar" ? "ar" : language).includes(normalizedQuery));
  const PortalIcon = activePortal?.icon ?? Grid2X2;
  const isDemo = bootstrap.data?.organization?.isDemo === "yes";

  const OrganizationPicker = () => <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="nawa-organization-switcher"><span className="min-w-0"><span className="block truncate text-sm font-bold text-foreground">{bootstrap.data?.organization?.name ?? "—"}</span><span className="mt-0.5 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">{selectedBranch?.name ?? chrome.defaultBranch}<ChevronDown className="h-3.5 w-3.5" /></span></span>{isDemo ? <Badge className="border-primary/25 bg-primary/10 text-[10px] text-primary hover:bg-primary/10">{chrome.demo}</Badge> : null}</button></DropdownMenuTrigger><DropdownMenuContent align="center" className="w-64 rounded-2xl p-1.5">{branches.isLoading ? <div className="grid min-h-20 place-items-center"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div> : branches.data?.length ? branches.data.map(branch => <DropdownMenuItem key={branch.id} onClick={() => { setSelectedBranchId(branch.id); toast.success(branch.name); }} className={`mt-1 cursor-pointer rounded-xl py-2.5 ${selectedBranch?.id === branch.id ? "bg-primary/10 font-bold text-primary focus:bg-primary/10 focus:text-primary" : ""}`}><span className="min-w-0"><span className="block truncate">{branch.name}</span><span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">{branch.code}</span></span></DropdownMenuItem>) : <p className="px-3 py-4 text-center text-xs text-muted-foreground">{chrome.defaultBranch}</p>}</DropdownMenuContent></DropdownMenu>;

  const NotificationMenu = () => <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={chrome.notifications} className="nawa-header-icon relative"><Bell className="h-5 w-5" />{unreadCount ? <span className="absolute end-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-extrabold text-primary-foreground">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}</Button></DropdownMenuTrigger><DropdownMenuContent align={direction === "rtl" ? "start" : "end"} className="w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl p-0"><div className="flex items-center justify-between border-b border-border/70 px-4 py-3"><p className="text-sm font-black">{chrome.notifications}</p><Button variant="ghost" size="sm" onClick={() => markAllRead.mutate()} disabled={!unreadCount || markAllRead.isPending} className="h-8 gap-1.5 text-xs text-primary"><CheckCheck className="h-4 w-4" />{chrome.markAllRead}</Button></div><div className="max-h-80 overflow-y-auto p-1.5">{notifications.isLoading ? <div className="grid min-h-28 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : notifications.data?.length ? notifications.data.slice(0, 6).map(notification => <button key={notification.id} type="button" onClick={() => notification.isRead === "no" && markRead.mutate({ notificationId: notification.id })} className={`w-full rounded-xl p-3 text-start transition-colors hover:bg-primary/[.06] ${notification.isRead === "no" ? "bg-primary/[.04]" : ""}`}><span className="flex gap-2.5"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.isRead === "no" ? "bg-primary" : "bg-muted-foreground/30"}`} /><span className="min-w-0"><span className="block truncate text-sm font-bold">{notification.title}</span><span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">{notification.content}</span><span className="mt-1.5 block text-[10px] text-muted-foreground">{formatNotificationTime(notification.createdAt, language)}</span></span></span></button>) : <div className="grid min-h-28 place-items-center gap-2 text-center text-sm text-muted-foreground"><Inbox className="h-5 w-5 text-primary" />{chrome.emptyNotifications}</div>}</div></DropdownMenuContent></DropdownMenu>;

  return <div dir={direction} className="nawa-app-shell">
    <header className="nawa-global-header">
      <div className="flex min-w-0 items-center gap-2.5">
        {!isPortalLauncher ? <Button variant="ghost" size="icon" onClick={() => setRailOpenOnMobile(true)} aria-label={chrome.tools} className="nawa-mobile-rail-trigger"><Menu className="h-5 w-5" /></Button> : null}
        <button type="button" onClick={() => navigate("/")} className="nawa-wordmark" aria-label={chrome.portals}><span className="nawa-wordmark-mark">N</span><span className="hidden text-sm font-black tracking-tight sm:inline">Nawa ERP</span></button>
        {!isPortalLauncher && activePortal ? <Tooltip><TooltipTrigger asChild><button type="button" onClick={() => navigate(activePortal.href)} className="nawa-current-portal"><PortalIcon className="h-4 w-4" /><span className="sr-only">{activePortal.name[language]}</span></button></TooltipTrigger><TooltipContent>{activePortal.name[language]}</TooltipContent></Tooltip> : null}
      </div>
      <div className="hidden min-w-0 flex-1 justify-center lg:flex"><OrganizationPicker /></div>
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="icon" onClick={() => navigate("/workspace")} aria-label={chrome.ai} className="nawa-header-icon"><Bot className="h-5 w-5" /></Button>
        <NotificationMenu />
        <Button variant="ghost" size="icon" onClick={() => navigate("/settings")} aria-label={chrome.settings} className="nawa-header-icon hidden sm:inline-flex"><Settings2 className="h-5 w-5" /></Button>
        <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="rounded-xl p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Avatar className="h-9 w-9 border border-primary/20"><AvatarFallback className="bg-primary/10 text-xs font-black text-primary">{user?.name?.charAt(0).toUpperCase() || "N"}</AvatarFallback></Avatar></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52 rounded-2xl p-1.5"><div className="px-2.5 py-2"><p className="truncate text-sm font-bold">{user?.name || "—"}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{user?.email || "—"}</p></div><DropdownMenuItem onClick={logout} className="cursor-pointer rounded-xl py-2.5 text-destructive focus:text-destructive"><LogOut className="me-2 h-4 w-4" />{t("signOut")}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
      </div>
    </header>
    <div className="nawa-shell-body">
      {!isPortalLauncher ? <>
        <aside className={`nawa-navigation-rail ${isRailOpenOnMobile ? "nawa-navigation-rail-open" : ""}`} aria-label={chrome.tools}>
          <div className="nawa-rail-top"><RailButton label={chrome.portals} onClick={() => navigate("/")}><Grid2X2 className="h-5 w-5" /></RailButton><RailButton label={activePortal?.name[language] ?? chrome.executive} active={!activeMenuItem} onClick={() => activePortal ? navigate(activePortal.href) : navigate("/executive")}><Home className="h-5 w-5" /></RailButton></div>
          <div className="nawa-rail-groups">{groups.map(group => { const GroupIcon = getPortalNavigationIcon(group.items[0]?.id ?? "", activePortal?.icon ?? Grid2X2); return <RailButton key={group.key} label={group.label} active={group.items.some(item => item.id === activeMenuItem?.id) || (isPanelOpen && selectedGroup?.key === group.key)} onClick={() => { setActiveGroupKey(group.key); setPanelOpen(true); }}><GroupIcon className="h-5 w-5" /></RailButton>; })}</div>
          <div className="nawa-rail-bottom"><RailButton label={chrome.notifications} badge={unreadCount} onClick={() => toast.info(chrome.notifications)}><Bell className="h-5 w-5" /></RailButton><RailButton label={chrome.settings} active={pathWithoutQuery === "/settings"} onClick={() => navigate("/settings")}><Settings2 className="h-5 w-5" /></RailButton></div>
        </aside>
        {isRailOpenOnMobile ? <button aria-label={chrome.close} className="nawa-rail-backdrop" onClick={() => setRailOpenOnMobile(false)} /> : null}
        {isPanelOpen && selectedGroup ? <aside className="nawa-context-panel" aria-label={chrome.tools}>
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3"><div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-[.12em] text-primary">{activePortal?.name[language]}</p><p className="mt-1 truncate text-base font-black text-foreground">{selectedGroup.label}</p></div><div className="flex items-center gap-1"><Button variant="ghost" size="icon" onClick={() => setPinnedPanel(value => !value)} aria-label={pinnedPanel ? chrome.unpin : chrome.pin} className="h-8 w-8">{pinnedPanel ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}</Button><Button variant="ghost" size="icon" onClick={() => setPanelOpen(false)} aria-label={chrome.close} className="h-8 w-8"><X className="h-4 w-4" /></Button></div></div>
          <div className="border-b border-border/70 p-3"><label className="relative block"><Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input autoFocus value={toolQuery} onChange={event => setToolQuery(event.target.value)} placeholder={chrome.searchTools} className="h-10 w-full rounded-xl border border-border bg-muted/30 ps-3 pe-9 text-sm outline-none transition focus:border-primary/45 focus:ring-2 focus:ring-primary/15" /></label></div>
          <div className="nawa-context-list">{filteredTools.length ? filteredTools.map(item => { const ItemIcon = getPortalNavigationIcon(item.id, activePortal?.icon ?? Grid2X2); const isActive = item.id === activeMenuItem?.id; return <button key={item.id} type="button" onClick={() => navigate(item.href)} className={`nawa-context-tool ${isActive ? "nawa-context-tool-active" : ""}`}><ItemIcon className="h-4 w-4" /><span className="min-w-0 flex-1 truncate">{item.label[language]}</span>{isActive ? <span className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}</button>; }) : <p className="px-4 py-8 text-center text-sm text-muted-foreground">{chrome.searchTools}</p>}</div>
        </aside> : null}
      </> : null}
      <div className="nawa-workspace"><div className="nawa-workspace-inner">{!isPortalLauncher && activeMenuItem ? <div className="nawa-page-context"><span className="text-primary">{activePortal?.name[language]}</span><span className="text-muted-foreground">/</span><span>{activeMenuItem.label[language]}</span></div> : null}{children}</div></div>
    </div>
  </div>;
}
