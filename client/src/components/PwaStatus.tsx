import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { Download, Laptop, RefreshCw, Smartphone, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export function PwaStatus() {
  const { language } = useLanguage();
  const [isOffline, setIsOffline] = useState(() => typeof navigator === "undefined" ? false : !navigator.onLine);
  const [updateReady, setUpdateReady] = useState<ServiceWorkerRegistration | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installOpen, setInstallOpen] = useState(false);
  const copy = language === "ar" ? { offline: "أنت الآن دون اتصال. تبقى الواجهة متاحة، لكن البيانات الجديدة تتطلب الاتصال.", update: "يتوفر إصدار جديد من رصين. حدّث الصفحة لتفعيل الإصدار الجديد.", refresh: "تحديث الصفحة", install: "تثبيت التطبيق", app: "تطبيق الهاتف", title: "ثبّت رصين كتطبيق", nativeInstall: "تثبيت رصين الآن", phone: "الهاتف", phoneHelp: "افتح قائمة المتصفح ثم اختر «إضافة إلى الشاشة الرئيسية» أو «تثبيت التطبيق».", desktop: "الكمبيوتر", desktopHelp: "افتح رمز التثبيت بجانب شريط العنوان في Chrome أو Edge ثم اتبع الخطوات.", note: "تبقى الواجهة متاحة بعد التثبيت، بينما تحتاج بيانات المؤسسة الحية إلى اتصال آمن للمزامنة." } : language === "fr" ? { offline: "Vous êtes hors connexion. L’interface reste disponible, mais les nouvelles données exigent une connexion.", update: "Une nouvelle version de RASEEN ERP est disponible. Actualisez la page pour l’activer.", refresh: "Actualiser", install: "Installer l’application", app: "Application", title: "Installez RASEEN ERP", nativeInstall: "Installer maintenant", phone: "Téléphone", phoneHelp: "Ouvrez le menu du navigateur et choisissez Ajouter à l’écran d’accueil ou Installer l’application.", desktop: "Ordinateur", desktopHelp: "Utilisez l’icône d’installation à côté de la barre d’adresse dans Chrome ou Edge.", note: "L’interface reste disponible après l’installation, mais les données récentes nécessitent une connexion sécurisée." } : { offline: "You are offline. The app shell remains available, but new data requires a connection.", update: "A new RASEEN ERP version is available. Refresh the page to activate it.", refresh: "Refresh page", install: "Install app", app: "Mobile app", title: "Install RASEEN ERP as an app", nativeInstall: "Install RASEEN ERP now", phone: "Phone", phoneHelp: "Open your browser menu and choose Add to Home Screen or Install app.", desktop: "Desktop", desktopHelp: "Use the install icon beside the address bar in Chrome or Edge.", note: "The interface remains available after install, while live organization data needs a secure connection to sync." };

  useEffect(() => {
    const syncConnectivity = () => setIsOffline(!navigator.onLine);
    const onInstallPrompt = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent); };
    const onOpenInstall = () => setInstallOpen(true);
    window.addEventListener("online", syncConnectivity);
    window.addEventListener("offline", syncConnectivity);
    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    window.addEventListener("nawa-pwa-open-install", onOpenInstall);
    if ("serviceWorker" in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register("/nawa-erp-sw.js").then(registration => {
        if (registration.waiting) setUpdateReady(registration);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => { if (worker.state === "installed" && navigator.serviceWorker.controller) setUpdateReady(registration); });
        });
      }).catch(() => { /* PWA enhancement must never block application usage. */ });
    }
    return () => { window.removeEventListener("online", syncConnectivity); window.removeEventListener("offline", syncConnectivity); window.removeEventListener("beforeinstallprompt", onInstallPrompt); window.removeEventListener("nawa-pwa-open-install", onOpenInstall); };
  }, []);

  const applyUpdate = () => {
    if (!updateReady?.waiting) return window.location.reload();
    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
    updateReady.waiting.postMessage({ type: "SKIP_WAITING" });
  };
  const installApp = async () => { if (!installPrompt) return; await installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null); setInstallOpen(false); };

  if (!isOffline && !updateReady && !installOpen) return null;
  return <><div className="fixed inset-x-3 bottom-3 z-[80] mx-auto flex max-w-xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-background/95 px-4 py-3 shadow-xl backdrop-blur" role="status" aria-live="polite">{isOffline || updateReady ? <><p className="flex min-w-0 items-center gap-2 text-sm text-foreground">{isOffline ? <><WifiOff className="h-4 w-4 shrink-0 text-amber-600" />{copy.offline}</> : <><RefreshCw className="h-4 w-4 shrink-0 text-primary" />{copy.update}</>}</p>{updateReady ? <Button size="sm" onClick={applyUpdate}>{copy.refresh}</Button> : null}</> : null}</div><Dialog open={installOpen} onOpenChange={setInstallOpen}><DialogContent dir={language === "ar" ? "rtl" : "ltr"} className="max-w-[min(34rem,calc(100vw-1.5rem))] rounded-3xl border-border/80 p-0 overflow-hidden"><DialogHeader className="border-b border-border/70 px-6 pb-6 pt-7 text-center"><p className="text-sm font-bold text-primary">{copy.app}</p><DialogTitle className="mt-2 text-3xl font-black tracking-tight">{copy.title}</DialogTitle></DialogHeader><div className="space-y-5 px-6 py-6">{installPrompt ? <Button onClick={installApp} className="h-14 w-full gap-2 rounded-2xl text-base font-black"><Download className="h-5 w-5" />{copy.nativeInstall}</Button> : null}<section className="flex gap-3 border-b border-border/60 pb-5"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Smartphone className="h-5 w-5" /></span><div><h3 className="font-black text-foreground">{copy.phone}</h3><p className="mt-1 text-sm leading-7 text-muted-foreground">{copy.phoneHelp}</p></div></section><section className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Laptop className="h-5 w-5" /></span><div><h3 className="font-black text-foreground">{copy.desktop}</h3><p className="mt-1 text-sm leading-7 text-muted-foreground">{copy.desktopHelp}</p></div></section><p className="border-t border-border/60 pt-5 text-center text-sm leading-7 text-muted-foreground">{copy.note}</p></div></DialogContent></Dialog></>;
}
