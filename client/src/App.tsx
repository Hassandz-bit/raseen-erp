import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import NotFound from "@/pages/NotFound";
import { useEffect } from "react";
import { Redirect, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { PwaStatus } from "./components/PwaStatus";
import { LanguageProvider, useLanguage } from "./contexts/LanguageContext";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import CommerceInventory from "./pages/CommerceInventory";
import CommerceSectionPage from "./pages/CommerceSection";
import Distribution from "./pages/Distribution";
import DistributionSectionPage from "./pages/DistributionSection";
import Driver from "./pages/Driver";
import Retailer from "./pages/Retailer";
import RetailSectionPage from "./pages/RetailSection";
import CommerceRecordDetail from "./pages/CommerceRecordDetail";
import DecisionAlerts from "./pages/DecisionAlerts";
import B2BOrders from "./pages/B2BOrders";
import LogisticsCheck from "./pages/LogisticsCheck";
import ModulesPage from "./pages/Modules";
import SettingsPage from "./pages/Settings";
import Manufacturing from "./pages/Manufacturing";
import ManufacturingSectionPage from "./pages/ManufacturingSection";
import Finance from "./pages/Finance";
import HRPayroll from "./pages/HRPayroll";
import EmployeeSelfService from "./pages/EmployeeSelfService";
import PortalsHome from "./pages/PortalsHome";
import DemoGuide from "./pages/DemoGuide";
import BrandAppearance from "./pages/BrandAppearance";
import AboutApp from "./pages/AboutApp";
import InvoiceVerification from "./pages/InvoiceVerification";

function Router() {
  return <Switch><Route path="/" component={PortalsHome} /><Route path="/verify/invoice" component={InvoiceVerification} /><Route path="/demo-guide" component={DemoGuide} /><Route path="/executive" component={Home} /><Route path="/alerts" component={DecisionAlerts} /><Route path="/workspace"><Redirect to="/executive" /></Route><Route path="/commerce/:section/:id" component={CommerceRecordDetail} /><Route path="/commerce/:section" component={CommerceSectionPage} /><Route path="/commerce" component={CommerceInventory} /><Route path="/manufacturing/:section" component={ManufacturingSectionPage} /><Route path="/manufacturing" component={Manufacturing} /><Route path="/distribution/:section" component={DistributionSectionPage} /><Route path="/distribution" component={Distribution} /><Route path="/finance/:section" component={Finance} /><Route path="/finance" component={Finance} /><Route path="/hr/:section" component={HRPayroll} /><Route path="/hr" component={HRPayroll} /><Route path="/hr-payroll" component={HRPayroll} /><Route path="/self-service" component={EmployeeSelfService} /><Route path="/logistics-check" component={LogisticsCheck} /><Route path="/driver" component={Driver} /><Route path="/retail/:section" component={RetailSectionPage} /><Route path="/retailer" component={Retailer} /><Route path="/b2b-orders" component={B2BOrders} /><Route path="/modules" component={ModulesPage} /><Route path="/appearance" component={BrandAppearance} /><Route path="/about" component={AboutApp} /><Route path="/settings" component={SettingsPage} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>;
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
  return <ErrorBoundary><ThemeProvider defaultTheme="dark"><LanguageProvider><TooltipProvider><Toaster richColors position="top-center" /><PwaStatus /><PreferencesHydrator><Router /></PreferencesHydrator></TooltipProvider></LanguageProvider></ThemeProvider></ErrorBoundary>;
}
