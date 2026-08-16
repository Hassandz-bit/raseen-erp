import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import NotFound from "@/pages/NotFound";
import { useEffect } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { LanguageProvider, useLanguage } from "./contexts/LanguageContext";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import CommerceInventory from "./pages/CommerceInventory";
import Distribution from "./pages/Distribution";
import Driver from "./pages/Driver";
import Retailer from "./pages/Retailer";
import B2BOrders from "./pages/B2BOrders";
import LogisticsCheck from "./pages/LogisticsCheck";
import ModulesPage from "./pages/Modules";
import SettingsPage from "./pages/Settings";
import Workspace from "./pages/Workspace";
import Manufacturing from "./pages/Manufacturing";

function Router() {
  return <Switch><Route path="/" component={Home} /><Route path="/workspace" component={Workspace} /><Route path="/commerce" component={CommerceInventory} /><Route path="/manufacturing" component={Manufacturing} /><Route path="/distribution" component={Distribution} /><Route path="/logistics-check" component={LogisticsCheck} /><Route path="/driver" component={Driver} /><Route path="/retailer" component={Retailer} /><Route path="/b2b-orders" component={B2BOrders} /><Route path="/modules" component={ModulesPage} /><Route path="/settings" component={SettingsPage} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>;
}

function PreferencesHydrator({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { setLanguage } = useLanguage();
  const { updatePreferences } = useTheme();
  const isPreviewLanguage = ["ar", "fr", "en"].includes(new URLSearchParams(window.location.search).get("lang") ?? "");
  const preferences = trpc.erp.preferences.user.useQuery(undefined, { enabled: isAuthenticated && !isPreviewLanguage, retry: false });
  useEffect(() => {
    if (!preferences.data) return;
    setLanguage(preferences.data.language);
    updatePreferences({
      themeMode: preferences.data.themeMode,
      sidebarMode: preferences.data.sidebarMode,
      density: preferences.data.density,
      fontFamily: preferences.data.fontFamily as "ibm-plex" | "tajawal" | "noto-arabic" | "inter" | "system",
      fontScale: preferences.data.fontScale as "small" | "normal" | "large" | "extra_large",
      numeralStyle: preferences.data.numeralStyle,
      accentColor: preferences.data.accentColor as "gold" | "blue" | "emerald" | "violet",
      radiusPreset: preferences.data.radiusPreset,
      moduleViewMode: preferences.data.moduleViewMode,
    });
  }, [preferences.data, setLanguage, updatePreferences]);
  return <>{children}</>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="dark"><LanguageProvider><TooltipProvider><Toaster richColors position="top-center" /><PreferencesHydrator><Router /></PreferencesHydrator></TooltipProvider></LanguageProvider></ThemeProvider></ErrorBoundary>;
}
