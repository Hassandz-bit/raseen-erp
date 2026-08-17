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
import { Bell, Bot, CheckCheck, Grid2X2, Home, Inbox, Loader2, LogOut, PanelLeft, Settings2 } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 304;
const MIN_WIDTH = 240;
const MAX_WIDTH = 480;
const portalChrome = {
  ar: { portals: "الرئيسية", executive: "الملخص التنفيذي", workspace: "مساحة العمل", navigation: "تنقل البوابة", breadcrumbRoot: "نواة", defaultBranch: "الفرع الافتراضي", notifications: "التنبيهات", markAllRead: "تحديد الكل كمقروء", emptyNotifications: "لا توجد تنبيهات حديثة", settings: "الإعدادات", ai: "Nawa AI" },
  fr: { portals: "Accueil", executive: "Vue exécutive", workspace: "Espace de travail", navigation: "Navigation du portail", breadcrumbRoot: "Nawa", defaultBranch: "Branche par défaut", notifications: "Notifications", markAllRead: "Tout marquer comme lu", emptyNotifications: "Aucune notification récente", settings: "Paramètres", ai: "Nawa AI" },
  en: { portals: "Home", executive: "Executive overview", workspace: "Workspace", navigation: "Portal navigation", breadcrumbRoot: "Nawa", defaultBranch: "Default branch", notifications: "Notifications", markAllRead: "Mark all as read", emptyNotifications: "No recent notifications", settings: "Settings", ai: "Nawa AI" },
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
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const pathWithoutQuery = location.split("?")[0];
  const activePortal = getPortalForPath(pathWithoutQuery);
  const chrome = portalChrome[language];
  const localItems = activePortal?.localNavigation ?? [];
  const activeMenuItem = localItems.find(item => location === item.href || pathWithoutQuery === item.href.split("?")[0]);
  const isMobile = useIsMobile();
  const bootstrap = trpc.erp.bootstrap.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
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
          className={`border-r-0 ${preferences.sidebarMode === "compact" ? "[--sidebar-width:220px]" : ""}`}
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-[72px] justify-center border-b border-white/[.06]">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                  aria-label={t("navigation")}
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? <div className="flex min-w-0 items-center gap-2"><span className="truncate text-[15px] font-bold tracking-tight">{activePortal?.name[language] ?? chrome.portals}</span></div> : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 overflow-y-auto">
            <SidebarMenu className="px-2 py-3">
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => navigateTo("/", chrome.portals)} tooltip={chrome.portals} className="h-11 text-[15px] font-semibold">
                  <Grid2X2 className="h-[18px] w-[18px] text-primary" /><span>{chrome.portals}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => navigateTo("/executive", chrome.executive)} tooltip={chrome.executive} className="h-11 text-[15px] font-medium">
                  <Home className="h-[18px] w-[18px]" /><span>{chrome.executive}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <p className="px-3 pb-1 pt-5 text-[11px] font-bold uppercase tracking-[.12em] text-muted-foreground group-data-[collapsible=icon]:hidden">{chrome.workspace}</p>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={activePortal?.id === "ai"} onClick={() => navigateTo("/workspace", chrome.ai)} tooltip={chrome.ai} className={`group/ai relative h-13 overflow-hidden text-[17px] font-bold text-primary transition-all duration-200 hover:-translate-y-px hover:bg-primary/12 hover:shadow-[0_10px_22px_rgba(212,161,49,.14)] active:scale-[.985] motion-reduce:hover:translate-y-0 ${activePortal?.id === "ai" ? "bg-primary/14 shadow-[inset_3px_0_0_hsl(var(--primary)),0_8px_20px_rgba(212,161,49,.12)]" : ""}`}>
                  <Bot className="h-5 w-5 text-primary transition-transform duration-200 group-hover/ai:scale-110 group-hover/ai:-rotate-3" /><span>{chrome.ai}</span>{activePortal?.id === "ai" ? <span className="absolute end-2 h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary))]" aria-hidden="true" /> : null}
                </SidebarMenuButton>
              </SidebarMenuItem>
              {activePortal ? <p className="px-2 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground group-data-[collapsible=icon]:hidden">{chrome.navigation}</p> : null}
              {localItems.map((item, index) => {
                const isActive = location === item.href || pathWithoutQuery === item.href.split("?")[0];
                const showGroup = index === 0 || item.group[language] !== localItems[index - 1]?.group[language];
                return (
                  <SidebarMenuItem key={item.id}>
                    {showGroup ? <p className="px-2 pb-1 pt-4 text-[11px] font-bold uppercase tracking-[.1em] text-muted-foreground group-data-[collapsible=icon]:hidden">{item.group[language]}</p> : null}
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => navigateTo(item.href, item.label[language])}
                      tooltip={item.label[language]}
                      className="h-12 text-[16px] font-medium transition-all"
                    >
                      {navigatingTo === item.href ? <Loader2 className="h-[18px] w-[18px] animate-spin motion-reduce:animate-none" /> : activePortal ? <activePortal.icon className={`h-[18px] w-[18px] ${isActive ? "text-primary" : ""}`} /> : <Grid2X2 className="h-[18px] w-[18px]" />}
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
        <div className="sticky top-0 z-40 flex h-[68px] items-center justify-between gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
          <div className="flex min-w-0 items-center gap-3"><SidebarTrigger className="h-10 w-10 shrink-0 rounded-xl bg-background" /><div className="min-w-0"><p className="truncate text-[16px] font-bold text-foreground">{activePortal?.name[language] ?? chrome.portals}</p><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{chrome.breadcrumbRoot} / {activePortal?.name[language] ?? chrome.portals}{activeMenuItem ? ` / ${activeMenuItem.label[language]}` : ""}</p></div><div className="hidden min-w-0 border-s ps-3 text-[11px] text-muted-foreground lg:block"><p className="truncate font-bold text-foreground">{bootstrap.data?.organization?.name ?? "—"}</p><p className="truncate">{chrome.defaultBranch}</p></div></div>
          <div className="flex shrink-0 items-center gap-1"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={unreadCount ? `${chrome.notifications}: ${unreadCount}` : chrome.notifications} className="relative h-10 w-10 rounded-xl transition-all duration-200 hover:bg-primary/10 hover:text-primary active:scale-95"><Bell className={`h-4 w-4 transition-transform duration-200 ${notificationPulse ? "motion-safe:animate-[pulse_825ms_cubic-bezier(.23,1,.32,1)_2] text-primary" : ""}`} />{unreadCount > 0 ? <span aria-live="polite" className={`absolute end-0.5 top-0.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-background bg-primary px-1 text-[10px] font-extrabold leading-none text-primary-foreground shadow-[0_0_14px_rgba(212,161,49,.42)] ${notificationPulse ? "motion-safe:animate-[pulse_825ms_cubic-bezier(.23,1,.32,1)_2]" : ""}`}>{unreadCount > 99 ? "99+" : unreadCount}</span> : null}</Button></DropdownMenuTrigger><DropdownMenuContent align={direction === "rtl" ? "start" : "end"} className="w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border-white/10 bg-popover p-0 text-popover-foreground shadow-2xl"><div className="flex items-center justify-between border-b border-white/[.07] px-4 py-3"><p className="text-[15px] font-bold">{chrome.notifications}</p><Button variant="ghost" size="sm" disabled={unreadCount === 0 || markAllNotificationsRead.isPending} onClick={() => markAllNotificationsRead.mutate()} className="h-8 gap-1.5 px-2 text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary"><CheckCheck className="h-4 w-4" />{chrome.markAllRead}</Button></div><div className="max-h-[22rem] overflow-y-auto p-1.5">{notifications.isLoading ? <div className="grid min-h-28 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : notifications.data?.length ? notifications.data.slice(0, 6).map(notification => <button key={notification.id} type="button" onClick={() => notification.isRead === "no" && markNotificationRead.mutate({ notificationId: notification.id })} className={`w-full rounded-xl p-3 text-start transition-colors hover:bg-accent/70 ${notification.isRead === "no" ? "bg-primary/[.055]" : ""}`}><div className="flex items-start gap-2.5"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.isRead === "no" ? "bg-primary shadow-[0_0_10px_hsl(var(--primary))]" : "bg-muted-foreground/35"}`} /><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-bold">{notification.title}</span><span className="mt-1 block line-clamp-2 text-[12px] leading-5 text-muted-foreground">{notification.content}</span><span className="mt-1.5 block text-[10px] text-muted-foreground">{formatNotificationTime(notification.createdAt, language)}</span></span></div></button>) : <div className="grid min-h-32 place-items-center gap-2 px-4 text-center text-sm text-muted-foreground"><Inbox className="h-6 w-6 text-primary/70" />{chrome.emptyNotifications}</div>}</div></DropdownMenuContent></DropdownMenu><Button variant="ghost" size="icon" onClick={() => navigateTo("/settings", chrome.settings)} aria-label={chrome.settings} className="hidden h-10 w-10 rounded-xl sm:inline-flex"><Settings2 className="h-4 w-4" /></Button><Avatar className="hidden h-9 w-9 border border-primary/20 sm:flex"><AvatarFallback className="bg-primary/10 text-[11px] font-bold text-primary">{user?.name?.charAt(0).toUpperCase() || "N"}</AvatarFallback></Avatar></div>
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
