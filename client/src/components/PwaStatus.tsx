import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { Download, RefreshCw, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export function PwaStatus() {
  const { language } = useLanguage();
  const [isOffline, setIsOffline] = useState(() => typeof navigator === "undefined" ? false : !navigator.onLine);
  const [updateReady, setUpdateReady] = useState<ServiceWorkerRegistration | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const copy = language === "ar" ? { offline: "أنت الآن دون اتصال. تبقى الواجهة متاحة، لكن البيانات الجديدة تتطلب الاتصال.", update: "يتوفر تحديث جديد لـNawa ERP.", refresh: "تحديث الآن", install: "تثبيت التطبيق" } : language === "fr" ? { offline: "Vous êtes hors connexion. L’interface reste disponible, mais les nouvelles données exigent une connexion.", update: "Une mise à jour de Nawa ERP est disponible.", refresh: "Mettre à jour", install: "Installer l’application" } : { offline: "You are offline. The app shell remains available, but new data requires a connection.", update: "A Nawa ERP update is available.", refresh: "Update now", install: "Install app" };

  useEffect(() => {
    const syncConnectivity = () => setIsOffline(!navigator.onLine);
    const onInstallPrompt = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent); };
    window.addEventListener("online", syncConnectivity);
    window.addEventListener("offline", syncConnectivity);
    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    if ("serviceWorker" in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register("/nawa-erp-sw.js").then(registration => {
        if (registration.waiting) setUpdateReady(registration);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => { if (worker.state === "installed" && navigator.serviceWorker.controller) setUpdateReady(registration); });
        });
      }).catch(() => { /* PWA enhancement must never block application usage. */ });
    }
    return () => { window.removeEventListener("online", syncConnectivity); window.removeEventListener("offline", syncConnectivity); window.removeEventListener("beforeinstallprompt", onInstallPrompt); };
  }, []);

  const applyUpdate = () => { updateReady?.waiting?.postMessage({ type: "SKIP_WAITING" }); window.location.reload(); };
  const installApp = async () => { if (!installPrompt) return; await installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null); };

  if (!isOffline && !updateReady && !installPrompt) return null;
  return <div className="fixed inset-x-3 bottom-3 z-[80] mx-auto flex max-w-xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-background/95 px-4 py-3 shadow-xl backdrop-blur" role="status" aria-live="polite"><p className="flex min-w-0 items-center gap-2 text-sm text-foreground">{isOffline ? <><WifiOff className="h-4 w-4 shrink-0 text-amber-600" />{copy.offline}</> : updateReady ? <><RefreshCw className="h-4 w-4 shrink-0 text-primary" />{copy.update}</> : <><Download className="h-4 w-4 shrink-0 text-primary" />{copy.install}</>}</p>{updateReady ? <Button size="sm" onClick={applyUpdate}>{copy.refresh}</Button> : installPrompt ? <Button size="sm" onClick={installApp}>{copy.install}</Button> : null}</div>;
}
