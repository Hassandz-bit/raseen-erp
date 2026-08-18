import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { getPortalForPath } from "@/config/nawaPortals";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useIsMobile } from "@/hooks/useMobile";
import { navigationFeedbackCopy } from "@/i18n/translations";
import { trpc } from "@/lib/trpc";
import { Bell, Bot, CheckCheck, ChevronDown, Grid2X2, Home, Inbox, Loader2, LogOut, PanelLeft, Settings2 } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation, useSearch } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 304;
const MIN_WIDTH = 240;
const MAX_WIDTH = 480;
const ACTIVE_BRANCH_KEY = "nawa:active-branch";
const portalChrome = {
  ar: { portals: "الرئيسية", executive: "الملخص التنفيذي", workspace: "مساحة العمل", navigation: "تنقل البوابة", breadcrumbRoot: "نواة", defaultBranch: "الفرع الافتراضي", notifications: "التنبيهات", markAllRead: "تحديد الكل كمقروء", emptyNotifications: "لا توجد تنبيهات حديثة", settings: "الإعدادات", ai: "Nawa AI", demo: "بيانات Demo" },
  fr: { portals: "Accueil", executive: "Vue exécutive", workspace: "Espace de travail", navigation: "Navigation du portail", breadcrumbRoot: "Nawa", defaultBranch: "Branche par défaut", notifications: "Notifications", markAllRead: "Tout marquer comme lu", emptyNotifications: "Aucune notification récente", settings: "Paramètres", ai: "Nawa AI", demo: "Données Demo" },
  en: { portals: "Home", executive: "Executive overview", workspace: "Workspace", navigation: "Portal navigation", breadcrumbRoot: "Nawa", defaultBranch: "Default branch", notifications: "Notifications", markAllRead: "Mark all as read", emptyNotifications: "No recent notifications", settings: "Settings", ai: "Nawa AI", demo: "Demo data" },
} as const;

function formatNotificationTime(value: Date | string | number, language: "ar" | "fr" | "en") {
  const locale = language === "ar" ? "ar" : language === "fr" ? "fr-FR" : "en-US";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    const parsed = saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
    return Number.isFinite(parsed) ? Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, parsed)) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const { direction, t } = useLanguage();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center" dir={direction}>
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              {t("signInToContinue")}
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {t("workspaceAccountRequired")}
            </p>
          </div>
          <Button
            onClick={() => startLogin()}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            {t("signIn")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const { direction, language, t } = useLanguage();
  const { preferences } = useTheme();
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const previousPortalId = useRef<string | undefined>(undefined);
  const pathWithoutQuery = location.split("?")[0];
  const activePortal = getPortalForPath(pathWithoutQuery);
  const chrome = portalChrome[language];
  const localItems = activePortal?.localNavigation ?? [];
  const activeMenuItem = localItems.find(item => location === item.href || pathWithoutQuery === item.href.split("?")[0]);
  const isMobile = useIsMobile();
  const bootstrap = trpc.erp.bootstrap.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const branchQuery = trpc.erp.preferences.availableBranches.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(() => {
    const saved = localStorage.getItem(ACTIVE_BRANCH_KEY);
    const parsed = saved ? Number(saved) : NaN;
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  });
  const availableBranches = branchQuery.data ?? [];
  const selectedBranch = availableBranches.find(branch => branch.id === selectedBranchId) ?? availableBranches[0];
  const isDemoOrganization = bootstrap.data?.organization?.isDemo === "yes";
  const notifications = trpc.erp.notifications.list.useQuery(undefined, { retry: false, refetchInterval: 30_000, refetchOnWindowFocus: true });
  const unreadCount = (notifications.data ?? []).filter(notification => notification.isRead === "no").length;
  const notificationUtils = trpc.useUtils();
  const markNotificationRead = trpc.erp.notifications.markRead.useMutation({ onSuccess: () => notificationUtils.erp.notifications.list.invalidate() });
  const markAllNotificationsRead = trpc.erp.notifications.markAllRead.useMutation({ onSuccess: () => notificationUtils.erp.notifications.list.invalidate() });
  const [notificationPulse, setNotificationPulse] = useState(false);
  const previousUnreadCount = useRef<number | null>(null);

  useEffect(() => {
    if (previousUnreadCount.current !== null && unreadCount > previousUnreadCount.current) {
      setNotificationPulse(true);
      const timer = window.setTimeout(() => setNotificationPulse(false), 1_650);
      previousUnreadCount.current = unreadCount;
      return () => window.clearTimeout(timer);
    }
    previousUnreadCount.current = unreadCount;
  }, [unreadCount]);

  useEffect(() => {
    if (activePortal) localStorage.setItem("nawa:last-portal", activePortal.id);
  }, [activePortal]);

  useEffect(() => {
    const portalChanged = Boolean(activePortal?.id && activePortal.id !== previousPortalId.current);
    if (portalChanged && !isMobile && isCollapsed) toggleSidebar();
    previousPortalId.current = activePortal?.id;
  }, [activePortal?.id, isCollapsed, isMobile, toggleSidebar]);

  useEffect(() => {
    if (selectedBranch) localStorage.setItem(ACTIVE_BRANCH_KEY, String(selectedBranch.id));
  }, [selectedBranch]);

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const shouldCollapse = preferences.sidebarMode === "collapsed";
    if (shouldCollapse !== isCollapsed) toggleSidebar();
  }, [preferences.sidebarMode, isCollapsed, toggleSidebar]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const bounds = sidebarRef.current?.getBoundingClientRect();
      const newWidth = direction === "rtl"
        ? (bounds?.right ?? window.innerWidth) - e.clientX
        : e.clientX - (bounds?.left ?? 0);
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [direction, isResizing, setSidebarWidth]);

  const navigateTo = (path: string, label: string) => {
    if (path === location || navigatingTo) return;
    setNavigatingTo(path);
    window.setTimeout(() => {
      setLocation(path);
      setNavigatingTo(null);
      toast.success(navigationFeedbackCopy[language].opened(label));
    }, path === "/workspace" ? 220 : 180);
  };

  return (
    <div dir={direction} className="flex min-h-svh w-full min-w-0 overflow-x-hidden">
      <div className="relative shrink-0" ref={sidebarRef}>
        <Sidebar
          side={direction === "rtl" ? "right" : "left"}
          collapsible="icon"
          className={`nawa-portal-sidebar border-r-0 ${preferences.sidebarMode === "compact" ? "[--sidebar-width:220px]" : ""}`}
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-[78px] justify-center border-b border-white/[.06] md:h-[88px]">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                  aria-label={t("navigation")}
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? <div className="flex min-w-0 items-center gap-2"><span className="truncate text-[19px] font-bold tracking-tight md:text-[22px]">{activePortal?.name[language] ?? chrome.portals}</span></div> : null}
            </div>
          </SidebarHeader>

          <div className="border-b border-white/[.06] px-3 py-3 lg:hidden group-data-[collapsible=icon]:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex w-full items-center justify-between rounded-xl border border-border/70 bg-background/70 px-3 py-2.5 text-start transition-colors hover:border-primary/35 hover:bg-primary/[.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
                  <span className="min-w-0"><span className="block text-[11px] font-semibold text-muted-foreground">{bootstrap.data?.organization?.name ?? "—"}</span><span className="mt-0.5 flex items-center gap-1 truncate text-[15px] font-bold text-foreground">{selectedBranch?.name ?? chrome.defaultBranch}<ChevronDown className="h-4 w-4 shrink-0 text-primary" /></span></span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={direction === "rtl" ? "start" : "end"} className="w-[min(20rem,calc(100vw-2rem))] rounded-2xl p-1.5">
                {branchQuery.isLoading ? <div className="grid min-h-20 place-items-center"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div> : availableBranches.length ? availableBranches.map(branch => <DropdownMenuItem key={branch.id} onClick={() => { setSelectedBranchId(branch.id); toast.success(branch.name); }} className={`mt-1 cursor-pointer rounded-xl py-2.5 ${selectedBranch?.id === branch.id ? "bg-primary/10 font-bold text-primary focus:bg-primary/10 focus:text-primary" : ""}`}><span className="min-w-0"><span className="block truncate">{branch.name}</span><span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">{branch.code}</span></span></DropdownMenuItem>) : <div className="px-3 py-4 text-center text-xs text-muted-foreground">{chrome.defaultBranch}</div>}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <SidebarContent className="gap-0 overflow-y-auto">
            <SidebarMenu className="px-2 py-3">
              {activePortal ? <><SidebarMenuItem><SidebarMenuButton onClick={() => navigateTo("/", chrome.portals)} tooltip={chrome.portals} className="h-11 text-[16px] font-semibold text-muted-foreground hover:text-foreground"><Grid2X2 className="h-[18px] w-[18px]" /><span>{chrome.portals}</span></SidebarMenuButton></SidebarMenuItem><div className="mx-2 mt-3 rounded-xl border border-primary/15 bg-primary/[.06] px-3 py-3 group-data-[collapsible=icon]:hidden"><p className="text-[11px] font-bold uppercase tracking-[.12em] text-primary">{chrome.navigation}</p><p className="mt-1 text-[18px] font-bold text-foreground">{activePortal.name[language]}</p></div></> : <><SidebarMenuItem><SidebarMenuButton onClick={() => navigateTo("/", chrome.portals)} tooltip={chrome.portals} className="h-12 text-[16px] font-semibold"><Grid2X2 className="h-[19px] w-[19px] text-primary" /><span>{chrome.portals}</span></SidebarMenuButton></SidebarMenuItem><SidebarMenuItem><SidebarMenuButton onClick={() => navigateTo("/executive", chrome.executive)} tooltip={chrome.executive} className="h-12 text-[16px] font-medium"><Home className="h-[19px] w-[19px]" /><span>{chrome.executive}</span></SidebarMenuButton></SidebarMenuItem><SidebarMenuItem><SidebarMenuButton onClick={() => navigateTo("/workspace", chrome.ai)} tooltip={chrome.ai} className="h-12 text-[16px] font-bold text-primary"><Bot className="h-[19px] w-[19px] text-primary" /><span>{chrome.ai}</span><span className="sr-only">{chrome.workspace}</span></SidebarMenuButton></SidebarMenuItem></>}
              {activePortal ? <p className="px-2 pb-2 pt-5 text-[12px] font-semibold uppercase tracking-[.14em] text-muted-foreground group-data-[collapsible=icon]:hidden">{chrome.navigation}</p> : null}
              {localItems.map((item, index) => {
                const isActive = item.href.includes("?") ? `${pathWithoutQuery}${search}` === item.href : pathWithoutQuery === item.href;
                const showGroup = index === 0 || item.group[language] !== localItems[index - 1]?.group[language];
                return (
                  <SidebarMenuItem key={item.id}>
                    {showGroup ? <p className="px-2 pb-1.5 pt-5 text-[13px] font-bold uppercase tracking-[.1em] text-muted-foreground group-data-[collapsible=icon]:hidden">{item.group[language]}</p> : null}
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => navigateTo(item.href, item.label[language])}
                      tooltip={item.label[language]}
                      className={`group/portal h-14 text-[18px] font-semibold transition-all ${isActive ? "bg-primary/12 text-primary ring-1 ring-primary/30 shadow-[inset_4px_0_0_hsl(var(--primary)),0_8px_20px_rgba(212,161,49,.12)]" : ""} ${activePortal?.id === "ai" ? `group/ai hover:-translate-y-px hover:bg-primary/12 hover:shadow-[0_10px_22px_rgba(212,161,49,.14)] ${isActive ? "shadow-[inset_3px_0_0_hsl(var(--primary))]" : ""}` : ""}`}
                    >
                      {navigatingTo === item.href ? <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" /> : activePortal ? <activePortal.icon className={`h-5 w-5 ${isActive ? "text-primary" : ""} ${activePortal.id === "ai" ? "group-hover/ai:scale-110 group-hover/ai:-rotate-3" : ""}`} /> : <Grid2X2 className="h-5 w-5" />}
                      <span>{item.label[language]}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
            </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t("signOut")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`group absolute top-0 ${direction === "rtl" ? "right-0" : "left-0"} h-full w-1 cursor-col-resize rounded-full bg-transparent outline-none transition-[width,background-color] duration-150 hover:w-2 hover:bg-primary/40 focus-visible:w-2 focus-visible:bg-primary/50 focus-visible:ring-2 focus-visible:ring-primary/50 ${isResizing ? "w-2 bg-primary/50" : ""} ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          role="separator"
          aria-orientation="vertical"
          aria-label={direction === "rtl" ? "تغيير عرض الشريط الجانبي" : "Resize sidebar"}
          title={direction === "rtl" ? "اسحب لتغيير العرض" : "Drag to resize"}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="min-w-0 flex-1">
        <div className="sticky top-0 z-40 flex h-[78px] items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur md:h-[88px] md:gap-5 md:px-6">
          <div className="flex min-w-0 items-center gap-3 md:gap-4"><SidebarTrigger className="h-11 w-11 shrink-0 rounded-xl bg-background md:h-12 md:w-12" /><div className="min-w-0"><p className="truncate text-[21px] font-extrabold leading-tight text-foreground md:text-[26px]">{activePortal?.name[language] ?? chrome.portals}</p><p className="mt-1 truncate text-[13px] font-medium text-muted-foreground md:text-[15px]">{chrome.breadcrumbRoot} / {activePortal?.name[language] ?? chrome.portals}{activeMenuItem ? ` / ${activeMenuItem.label[language]}` : ""}</p></div><DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="hidden min-w-0 items-center gap-2 border-s ps-4 text-start text-[13px] text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 lg:flex md:text-[14px]"><span className="min-w-0"><span className="flex items-center gap-2 truncate text-[16px] font-bold text-foreground md:text-[18px]">{bootstrap.data?.organization?.name ?? "—"}{isDemoOrganization ? <Badge className="border-primary/30 bg-primary/10 text-[10px] text-primary hover:bg-primary/10">{chrome.demo}</Badge> : null}</span><span className="mt-1 flex items-center gap-1 truncate font-medium">{selectedBranch?.name ?? chrome.defaultBranch}<ChevronDown className="h-3.5 w-3.5 shrink-0" /></span></span></button></DropdownMenuTrigger><DropdownMenuContent align={direction === "rtl" ? "start" : "end"} className="w-64 rounded-2xl p-1.5"><div className="border-b border-border/70 px-3 py-2"><p className="flex items-center gap-2 text-sm font-bold text-foreground">{bootstrap.data?.organization?.name ?? "—"}{isDemoOrganization ? <Badge className="border-primary/30 bg-primary/10 text-[10px] text-primary hover:bg-primary/10">{chrome.demo}</Badge> : null}</p><p className="mt-0.5 text-xs text-muted-foreground">{chrome.defaultBranch}</p></div>{branchQuery.isLoading ? <div className="grid min-h-20 place-items-center"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div> : availableBranches.length ? availableBranches.map(branch => <DropdownMenuItem key={branch.id} onClick={() => { setSelectedBranchId(branch.id); toast.success(branch.name); }} className={`mt-1 cursor-pointer rounded-xl py-2.5 ${selectedBranch?.id === branch.id ? "bg-primary/10 font-bold text-primary focus:bg-primary/10 focus:text-primary" : ""}`}><span className="min-w-0"><span className="block truncate">{branch.name}</span><span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">{branch.code}</span></span></DropdownMenuItem>) : <div className="px-3 py-4 text-center text-xs text-muted-foreground">{chrome.defaultBranch}</div>}</DropdownMenuContent></DropdownMenu></div>
          <div className="flex shrink-0 items-center gap-1.5"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={unreadCount ? `${chrome.notifications}: ${unreadCount}` : chrome.notifications} className="relative h-11 w-11 rounded-xl transition-all duration-200 hover:bg-primary/10 hover:text-primary active:scale-95 md:h-12 md:w-12"><Bell className={`h-5 w-5 transition-transform duration-200 ${notificationPulse ? "motion-safe:animate-[pulse_825ms_cubic-bezier(.23,1,.32,1)_2] text-primary" : ""}`} />{unreadCount > 0 ? <span aria-live="polite" className={`absolute end-0.5 top-0.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-background bg-primary px-1 text-[10px] font-extrabold leading-none text-primary-foreground shadow-[0_0_14px_rgba(212,161,49,.42)] ${notificationPulse ? "motion-safe:animate-[pulse_825ms_cubic-bezier(.23,1,.32,1)_2]" : ""}`}>{unreadCount > 99 ? "99+" : unreadCount}</span> : null}</Button></DropdownMenuTrigger><DropdownMenuContent align={direction === "rtl" ? "start" : "end"} className="w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border-white/10 bg-popover p-0 text-popover-foreground shadow-2xl"><div className="flex items-center justify-between border-b border-white/[.07] px-4 py-3"><p className="text-[15px] font-bold">{chrome.notifications}</p><Button variant="ghost" size="sm" disabled={unreadCount === 0 || markAllNotificationsRead.isPending} onClick={() => markAllNotificationsRead.mutate()} className="h-8 gap-1.5 px-2 text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary"><CheckCheck className="h-4 w-4" />{chrome.markAllRead}</Button></div><div className="max-h-[22rem] overflow-y-auto p-1.5">{notifications.isLoading ? <div className="grid min-h-28 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : notifications.data?.length ? notifications.data.slice(0, 6).map(notification => <button key={notification.id} type="button" onClick={() => notification.isRead === "no" && markNotificationRead.mutate({ notificationId: notification.id })} className={`w-full rounded-xl p-3 text-start transition-colors hover:bg-accent/70 ${notification.isRead === "no" ? "bg-primary/[.055]" : ""}`}><div className="flex items-start gap-2.5"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.isRead === "no" ? "bg-primary shadow-[0_0_10px_hsl(var(--primary))]" : "bg-muted-foreground/35"}`} /><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-bold">{notification.title}</span><span className="mt-1 block line-clamp-2 text-[12px] leading-5 text-muted-foreground">{notification.content}</span><span className="mt-1.5 block text-[10px] text-muted-foreground">{formatNotificationTime(notification.createdAt, language)}</span></span></div></button>) : <div className="grid min-h-32 place-items-center gap-2 px-4 text-center text-sm text-muted-foreground"><Inbox className="h-6 w-6 text-primary/70" />{chrome.emptyNotifications}</div>}</div></DropdownMenuContent></DropdownMenu><Button variant="ghost" size="icon" onClick={() => navigateTo("/settings", chrome.settings)} aria-label={chrome.settings} className="hidden h-11 w-11 rounded-xl sm:inline-flex md:h-12 md:w-12"><Settings2 className="h-5 w-5" /></Button><Avatar className="hidden h-10 w-10 border border-primary/20 sm:flex md:h-11 md:w-11"><AvatarFallback className="bg-primary/10 text-[13px] font-bold text-primary">{user?.name?.charAt(0).toUpperCase() || "N"}</AvatarFallback></Avatar></div>
        </div>
        {isMobile && (
          <div className="hidden border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label[language] ?? t("navigation")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="min-w-0 flex-1 overflow-x-clip p-4" aria-busy={Boolean(navigatingTo)}><div className="mx-auto w-full min-w-0 max-w-[1600px]">{navigatingTo && <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground" role="status"><Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />{navigationFeedbackCopy[language].moving}</div>}{children}</div></main>
      </SidebarInset>
    </div>
  );
}
