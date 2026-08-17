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
import { getPortalForPath, nawaPortals } from "@/config/nawaPortals";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useIsMobile } from "@/hooks/useMobile";
import { navigationFeedbackCopy } from "@/i18n/translations";
import { trpc } from "@/lib/trpc";
import { Bell, Bot, Grid2X2, Home, Loader2, LogOut, PanelLeft, Search, Settings2 } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;
const portalChrome = {
  ar: { portals: "كل البوابات", executive: "الملخص التنفيذي", navigation: "تنقل البوابة", breadcrumbRoot: "نواة", search: "ابحث داخل البوابة…", defaultBranch: "الفرع الافتراضي", notifications: "التنبيهات", settings: "الإعدادات" },
  fr: { portals: "Tous les portails", executive: "Vue exécutive", navigation: "Navigation du portail", breadcrumbRoot: "Nawa", search: "Rechercher dans le portail…", defaultBranch: "Branche par défaut", notifications: "Notifications", settings: "Paramètres" },
  en: { portals: "All portals", executive: "Executive overview", navigation: "Portal navigation", breadcrumbRoot: "Nawa", search: "Search this portal…", defaultBranch: "Default branch", notifications: "Notifications", settings: "Settings" },
} as const;

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
    }, 180);
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
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                  aria-label={t("navigation")}
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? <div className="flex items-center gap-2 min-w-0"><span className="font-semibold tracking-tight truncate">{activePortal?.name[language] ?? chrome.portals}</span></div> : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => navigateTo("/", chrome.portals)} tooltip={chrome.portals} className="h-10 font-medium">
                  <Grid2X2 className="h-4 w-4 text-primary" /><span>{chrome.portals}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => navigateTo("/executive", chrome.executive)} tooltip={chrome.executive} className="h-10 font-normal">
                  <Home className="h-4 w-4" /><span>{chrome.executive}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {activePortal ? <p className="px-2 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground group-data-[collapsible=icon]:hidden">{chrome.navigation}</p> : null}
              {localItems.map((item, index) => {
                const isActive = location === item.href || pathWithoutQuery === item.href.split("?")[0];
                const showGroup = index === 0 || item.group[language] !== localItems[index - 1]?.group[language];
                return (
                  <SidebarMenuItem key={item.id}>
                    {showGroup ? <p className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground group-data-[collapsible=icon]:hidden">{item.group[language]}</p> : null}
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => navigateTo(item.href, item.label[language])}
                      tooltip={item.label[language]}
                      className={`h-10 transition-all font-normal`}
                    >
                      {navigatingTo === item.href ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : activePortal ? <activePortal.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} /> : <Grid2X2 className="h-4 w-4" />}
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
        <div className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
          <div className="flex min-w-0 items-center gap-2"><SidebarTrigger className="h-9 w-9 shrink-0 rounded-lg bg-background" /><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{activePortal?.name[language] ?? chrome.portals}</p><p className="truncate text-[10px] text-muted-foreground">{chrome.breadcrumbRoot} / {activePortal?.name[language] ?? chrome.portals}{activeMenuItem ? ` / ${activeMenuItem.label[language]}` : ""}</p></div><div className="hidden min-w-0 border-s ps-3 text-[10px] text-muted-foreground lg:block"><p className="truncate font-semibold text-foreground">{bootstrap.data?.organization?.name ?? "—"}</p><p className="truncate">{chrome.defaultBranch}</p></div></div>
          <div className="flex shrink-0 items-center gap-1"><label className="hidden h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[.03] px-3 text-muted-foreground md:flex"><Search className="h-3.5 w-3.5" /><input disabled aria-label={chrome.search} placeholder={chrome.search} className="w-36 bg-transparent text-xs outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed xl:w-52" /></label><Button variant="ghost" size="icon" onClick={() => navigateTo("/workspace", "Nawa AI")} aria-label="Nawa AI" className="h-9 w-9 rounded-xl text-primary"><Bot className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => toast.info(chrome.notifications)} aria-label={chrome.notifications} className="relative h-9 w-9 rounded-xl"><Bell className="h-4 w-4" /><span className="absolute end-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" /></Button><Button variant="ghost" size="icon" onClick={() => navigateTo("/settings", chrome.settings)} aria-label={chrome.settings} className="hidden h-9 w-9 rounded-xl sm:inline-flex"><Settings2 className="h-4 w-4" /></Button><Avatar className="hidden h-8 w-8 border border-primary/20 sm:flex"><AvatarFallback className="bg-primary/10 text-[10px] text-primary">{user?.name?.charAt(0).toUpperCase() || "N"}</AvatarFallback></Avatar><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-9 gap-2 rounded-xl border-white/10 bg-white/[.03] text-xs text-slate-200"><Grid2X2 className="h-4 w-4 text-primary" /><span className="hidden sm:inline">{chrome.portals}</span></Button></DropdownMenuTrigger><DropdownMenuContent align={direction === "rtl" ? "start" : "end"} className="max-h-[70vh] w-64 overflow-y-auto">{nawaPortals.map(portal => <DropdownMenuItem key={portal.id} onClick={() => navigateTo(portal.href, portal.name[language])} className="cursor-pointer gap-2 py-2.5"><portal.icon className="h-4 w-4 text-primary" /><div><p className="text-sm font-medium">{portal.name[language]}</p><p className="text-[10px] text-muted-foreground">{portal.description[language]}</p></div></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></div>
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
