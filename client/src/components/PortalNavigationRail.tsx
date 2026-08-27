import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getPortalNavigationIcon, type NawaPortal, type PortalNavigationItem, type SupportedLanguage } from "@/config/nawaPortals";
import { Grid2X2, GripVertical, Home, Pin, PinOff, Search, Settings2, X } from "lucide-react";
import { type ReactNode, useRef } from "react";

export type NavigationMode = "auto" | "expanded" | "compact";

type PortalChrome = {
  portals: string;
  executive: string;
  tools: string;
  searchTools: string;
  noResults: string;
  pinNav: string;
  unpinNav: string;
  resizeNav?: string;
  operational: string;
  discovery: string;
};

type NavigationGroup = { key: string; label: string; items: PortalNavigationItem[] };

function RailButton({ label, active = false, onClick, badge, expanded = false, onPointerEnter, children, tooltipSide }: { label: string; active?: boolean; onClick: () => void; badge?: number; expanded?: boolean; onPointerEnter?: () => void; children: ReactNode; tooltipSide: "left" | "right" }) {
  return <Tooltip delayDuration={240}><TooltipTrigger asChild><button type="button" aria-label={label} aria-current={active ? "page" : undefined} onPointerEnter={onPointerEnter} onClick={onClick} className={`nawa-rail-button relative ${active ? "nawa-rail-button-active" : ""} ${expanded ? "nawa-rail-button-expanded" : ""}`}><span className="nawa-rail-button-icon">{children}</span>{expanded ? <span className="nawa-rail-label">{label}</span> : null}{badge ? <span className="absolute -end-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-extrabold text-primary-foreground">{badge > 99 ? "99+" : badge}</span> : null}</button></TooltipTrigger><TooltipContent side={tooltipSide} className="nawa-navigation-tooltip">{label}</TooltipContent></Tooltip>;
}

export function PortalNavigationRail({ activePortal, activeMenuItem, groups, selectedGroup, filteredTools, language, chrome, navigationMode, navigationModeLabel, navigationRendersExpanded, isPortalOverview, isPanelOpen, isRailOpenOnMobile, railWidth, tooltipSide, onNavigate, onOpenGroup, onScheduleGroupOpen, onClosePanelSoon, onClearHoverTimer, onNavigationModeChange, onPanelOpenChange, onRailOpenChange, onRailWidthChange, onToolQueryChange }: { activePortal?: NawaPortal; activeMenuItem?: PortalNavigationItem; groups: NavigationGroup[]; selectedGroup?: NavigationGroup; filteredTools: PortalNavigationItem[]; language: SupportedLanguage; chrome: PortalChrome; navigationMode: NavigationMode; navigationModeLabel: string; navigationRendersExpanded: boolean; isPortalOverview: boolean; isPanelOpen: boolean; isRailOpenOnMobile: boolean; railWidth: number; tooltipSide: "left" | "right"; onNavigate: (href: string) => void; onOpenGroup: (key: string) => void; onScheduleGroupOpen: (key: string) => void; onClosePanelSoon: () => void; onClearHoverTimer: () => void; onNavigationModeChange: (mode: NavigationMode) => void; onPanelOpenChange: (open: boolean) => void; onRailOpenChange: (open: boolean) => void; onRailWidthChange: (width: number) => void; onToolQueryChange: (query: string) => void; }) {
  const fallbackIcon = activePortal?.icon ?? Grid2X2;
  const resizeLabel = chrome.resizeNav ?? (language === "ar" ? "اسحب لتغيير عرض شريط الأدوات" : language === "fr" ? "Faites glisser pour redimensionner la navigation" : "Drag to resize the navigation");
  const dragStart = useRef<{ x: number; width: number } | null>(null);
  const isResizeEnabled = () => window.matchMedia("(min-width: 901px)").matches;
  const onResizePointerMove = (event: PointerEvent) => {
    if (!dragStart.current) return;
    const delta = document.dir === "rtl" ? dragStart.current.x - event.clientX : event.clientX - dragStart.current.x;
    onRailWidthChange(dragStart.current.width + delta);
  };
  const stopResize = () => { dragStart.current = null; window.removeEventListener("pointermove", onResizePointerMove); window.removeEventListener("pointerup", stopResize); };
  const startResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isResizeEnabled()) return;
    event.preventDefault();
    dragStart.current = { x: event.clientX, width: railWidth };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    window.addEventListener("pointermove", onResizePointerMove);
    window.addEventListener("pointerup", stopResize, { once: true });
  };
  const adjustWidth = (difference: number) => onRailWidthChange(railWidth + difference);

  return <>
    <aside onPointerLeave={navigationRendersExpanded ? undefined : onClosePanelSoon} style={{ "--nawa-rail-width": `${railWidth}px` } as React.CSSProperties} className={`nawa-navigation-rail ${navigationRendersExpanded ? "nawa-navigation-rail-expanded" : ""} ${isRailOpenOnMobile ? "nawa-navigation-rail-open" : ""}`} aria-label={chrome.tools}>
      <div className="nawa-rail-top"><RailButton tooltipSide={tooltipSide} label={chrome.portals} expanded={navigationRendersExpanded} onClick={() => onNavigate("/")}><Grid2X2 className="nawa-rail-icon" /></RailButton><RailButton tooltipSide={tooltipSide} label={activePortal?.name[language] ?? chrome.executive} active={!activeMenuItem} expanded={navigationRendersExpanded} onClick={() => onNavigate(activePortal?.href ?? "/executive")}><Home className="nawa-rail-icon" /></RailButton></div>
      {navigationRendersExpanded ? <div className="nawa-expanded-navigation"><div className="nawa-expanded-navigation-head"><span>{isPortalOverview ? chrome.discovery : chrome.operational}</span><Button variant="ghost" size="icon" aria-label={navigationMode === "expanded" ? chrome.unpinNav : chrome.pinNav} onClick={() => onNavigationModeChange(navigationMode === "expanded" ? "auto" : "expanded")} className="nawa-rail-control">{navigationMode === "expanded" ? <PinOff className="nawa-rail-control-icon" /> : <Pin className="nawa-rail-control-icon" />}</Button></div>{groups.map(group => { const GroupIcon = getPortalNavigationIcon(group.items[0]?.id ?? "", fallbackIcon); const groupActive = group.items.some(item => item.id === activeMenuItem?.id); return <section key={group.key} className={`nawa-expanded-group ${groupActive ? "nawa-expanded-group-active" : ""}`}><p className="nawa-expanded-group-label"><GroupIcon className="nawa-expanded-group-icon" />{group.label}</p>{group.items.map(item => { const ItemIcon = getPortalNavigationIcon(item.id, fallbackIcon); const isActive = item.id === activeMenuItem?.id; return <button key={item.id} type="button" aria-current={isActive ? "page" : undefined} onClick={() => onNavigate(item.href)} className={`nawa-expanded-page ${isActive ? "nawa-expanded-page-active" : ""}`}><ItemIcon className="nawa-expanded-page-icon" /><span>{item.label[language]}</span>{isActive ? <span className="nawa-active-dot" /> : null}</button>; })}</section>; })}</div> : <div className="nawa-rail-groups">{groups.map(group => { const GroupIcon = getPortalNavigationIcon(group.items[0]?.id ?? "", fallbackIcon); const isActive = group.items.some(item => item.id === activeMenuItem?.id) || (isPanelOpen && selectedGroup?.key === group.key); return <RailButton key={group.key} tooltipSide={tooltipSide} label={group.label} active={isActive} onPointerEnter={() => onScheduleGroupOpen(group.key)} onClick={() => onOpenGroup(group.key)}><GroupIcon className="nawa-rail-icon" /></RailButton>; })}</div>}
      <div className="nawa-rail-bottom"><RailButton tooltipSide={tooltipSide} label={navigationMode === "expanded" ? chrome.unpinNav : chrome.pinNav} expanded={navigationRendersExpanded} onClick={() => onNavigationModeChange(navigationMode === "expanded" ? "auto" : "expanded")}><Pin className="nawa-rail-icon" /></RailButton><RailButton tooltipSide={tooltipSide} label={navigationModeLabel} expanded={navigationRendersExpanded} onClick={() => onNavigationModeChange(navigationMode === "auto" ? "compact" : navigationMode === "compact" ? "expanded" : "auto")}><Settings2 className="nawa-rail-icon" /></RailButton></div>
      <Tooltip delayDuration={240}><TooltipTrigger asChild><button type="button" className="nawa-rail-resize-handle" aria-label={resizeLabel} title={resizeLabel} onPointerDown={startResize} onKeyDown={event => { if (event.key === "ArrowLeft") { event.preventDefault(); adjustWidth(document.dir === "rtl" ? 24 : -24); } if (event.key === "ArrowRight") { event.preventDefault(); adjustWidth(document.dir === "rtl" ? -24 : 24); } }}><GripVertical aria-hidden="true" /></button></TooltipTrigger><TooltipContent side={tooltipSide} className="nawa-navigation-tooltip">{resizeLabel}</TooltipContent></Tooltip>
    </aside>
    {isRailOpenOnMobile ? <button aria-label={chrome.tools} className="nawa-rail-backdrop" onClick={() => onRailOpenChange(false)} /> : null}
    {!navigationRendersExpanded && isPanelOpen && selectedGroup ? <aside onPointerEnter={onClearHoverTimer} onPointerLeave={onClosePanelSoon} className="nawa-context-panel" aria-label={chrome.tools}><div className="nawa-context-panel-head"><div className="min-w-0"><p className="nawa-context-portal-label">{activePortal?.name[language]}</p><p className="mt-1 truncate text-lg font-black text-foreground">{selectedGroup.label}</p></div><div className="flex items-center gap-1"><Button variant="ghost" size="icon" onClick={() => onNavigationModeChange("expanded")} aria-label={chrome.pinNav} className="nawa-rail-control"><Pin className="nawa-rail-control-icon" /></Button><Button variant="ghost" size="icon" onClick={() => onPanelOpenChange(false)} aria-label={chrome.tools} className="nawa-rail-control"><X className="nawa-rail-control-icon" /></Button></div></div><div className="nawa-context-search"><label className="relative block"><Search className="nawa-context-search-icon pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input autoFocus onChange={event => onToolQueryChange(event.target.value)} placeholder={chrome.searchTools} className="nawa-context-search-input" /></label></div><div className="nawa-context-list">{filteredTools.length ? filteredTools.map(item => { const ItemIcon = getPortalNavigationIcon(item.id, fallbackIcon); const isActive = item.id === activeMenuItem?.id; return <button key={item.id} type="button" aria-current={isActive ? "page" : undefined} onClick={() => onNavigate(item.href)} className={`nawa-context-tool ${isActive ? "nawa-context-tool-active" : ""}`}><ItemIcon className="nawa-context-tool-icon" /><span className="min-w-0 flex-1 truncate">{item.label[language]}</span>{isActive ? <span className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}</button>; }) : <p className="px-4 py-8 text-center text-sm text-muted-foreground">{chrome.noResults}</p>}</div></aside> : null}
  </>;
}
