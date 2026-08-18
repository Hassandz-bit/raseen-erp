import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Camera, CheckCircle2, Loader2, ScanLine, Square, Usb, Volume2, VolumeX, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type BarcodeScannerInputProps = {
  value: string;
  onValueChange: (value: string) => void;
  onDetected?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  feedback?: "success" | "error" | null;
};

const AUDIO_PREFERENCE_KEY = "nawa-scanner-audio";

export function BarcodeScannerInput({ value, onValueChange, onDetected, placeholder, disabled = false, id, feedback: externalFeedback = null }: BarcodeScannerInputProps) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"success" | "error" | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(() => typeof window === "undefined" ? true : window.localStorage.getItem(AUDIO_PREFERENCE_KEY) !== "off");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  const copy = language === "ar" ? {
    scan: "مسح الرمز", manualHint: "يدعم قارئ USB والإدخال اليدوي", title: "مسح باركود أو QR", description: "اسمح للمتصفح باستخدام الكاميرا، ثم وجّهها إلى الرمز. قارئ USB يعمل مباشرة داخل الحقل.", start: "تشغيل الكاميرا", stop: "إيقاف الكاميرا", close: "إغلاق", preparing: "يتم تشغيل الكاميرا…", unavailable: "الكاميرا غير متاحة في هذا المتصفح أو لا يوجد اتصال آمن.", denied: "تعذر الوصول إلى الكاميرا. تحقق من إذن الكاميرا ثم أعد المحاولة.", videoLabel: "معاينة كاميرا ماسح الباركود", success: "تمت قراءة الرمز بنجاح", failure: "تعذر معالجة الرمز", soundOn: "إيقاف صوت نتيجة المسح", soundOff: "تشغيل صوت نتيجة المسح",
  } : language === "fr" ? {
    scan: "Scanner", manualHint: "Lecteur USB et saisie manuelle pris en charge", title: "Scanner un code-barres ou QR", description: "Autorisez la caméra puis cadrez le code. Un lecteur USB fonctionne directement dans le champ.", start: "Activer la caméra", stop: "Arrêter la caméra", close: "Fermer", preparing: "Activation de la caméra…", unavailable: "La caméra n'est pas disponible ou la connexion n'est pas sécurisée.", denied: "Impossible d'accéder à la caméra. Vérifiez l'autorisation puis réessayez.", videoLabel: "Aperçu de la caméra du scanner", success: "Code lu avec succès", failure: "Impossible de traiter le code", soundOn: "Désactiver le son du scan", soundOff: "Activer le son du scan",
  } : {
    scan: "Scan code", manualHint: "USB scanner and manual entry are supported", title: "Scan barcode or QR", description: "Allow camera access and frame the code. A USB scanner works directly in the field.", start: "Start camera", stop: "Stop camera", close: "Close", preparing: "Starting camera…", unavailable: "Camera is unavailable in this browser or the connection is not secure.", denied: "Camera access failed. Check camera permission and try again.", videoLabel: "Barcode scanner camera preview", success: "Code scanned successfully", failure: "The code could not be processed", soundOn: "Mute scan sound", soundOff: "Enable scan sound",
  };

  const signalFeedback = useCallback((type: "success" | "error") => {
    setFeedback(type);
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => setFeedback(null), 1800);
    if (!audioEnabled || typeof window === "undefined") return;
    try {
      const AudioContext = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext;
      if (!AudioContext) return;
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type === "success" ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(type === "success" ? 760 : 240, context.currentTime);
      if (type === "success") oscillator.frequency.exponentialRampToValueAtTime(1040, context.currentTime + 0.12);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.09, context.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + (type === "success" ? 0.16 : 0.28));
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + (type === "success" ? 0.18 : 0.3));
      oscillator.addEventListener("ended", () => void context.close());
    } catch { /* Browsers may block audio until a user gesture; visual feedback remains available. */ }
  }, [audioEnabled]);

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setIsScanning(false);
    setIsStarting(false);
  }, []);

  const acceptCode = useCallback((rawValue: string) => {
    const code = rawValue.trim().replace(/\s+/g, "");
    if (!code) return;
    onValueChange(code);
    onDetected?.(code);
    signalFeedback("success");
    stopCamera();
    setOpen(false);
  }, [onDetected, onValueChange, signalFeedback, stopCamera]);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(copy.unavailable);
      return;
    }
    if (!videoRef.current) return;
    stopCamera();
    setCameraError(null);
    setIsStarting(true);
    try {
      const reader = new BrowserMultiFormatReader();
      controlsRef.current = await reader.decodeFromConstraints({ video: { facingMode: { ideal: "environment" } } }, videoRef.current, result => {
        if (result) acceptCode(result.getText());
      });
      setIsScanning(true);
    } catch {
      setCameraError(copy.denied);
      signalFeedback("error");
    } finally {
      setIsStarting(false);
    }
  }, [acceptCode, copy.denied, copy.unavailable, signalFeedback, stopCamera]);

  useEffect(() => {
    if (externalFeedback) signalFeedback(externalFeedback);
  }, [externalFeedback, signalFeedback]);

  useEffect(() => () => {
    stopCamera();
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
  }, [stopCamera]);

  const toggleAudio = () => setAudioEnabled(current => {
    const next = !current;
    window.localStorage.setItem(AUDIO_PREFERENCE_KEY, next ? "on" : "off");
    return next;
  });

  return <div className={`barcode-scanner-input transition-all ${feedback === "success" ? "rounded-xl ring-2 ring-emerald-500/55" : feedback === "error" ? "rounded-xl ring-2 ring-destructive/60" : ""}`}>
    <div className="flex gap-2">
      <Input id={id} dir="ltr" value={value} disabled={disabled} onChange={event => onValueChange(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); acceptCode(value); } }} placeholder={placeholder} className="min-w-0 flex-1" />
      <Button type="button" variant="outline" disabled={disabled} onClick={() => { setCameraError(null); setOpen(true); }} className="shrink-0 gap-2" aria-label={copy.scan}><ScanLine className="h-4 w-4" /><span className="hidden sm:inline">{copy.scan}</span></Button>
      <Button type="button" variant="ghost" size="icon" onClick={toggleAudio} className="shrink-0" aria-label={audioEnabled ? copy.soundOn : copy.soundOff}>{audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</Button>
    </div>
    <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground"><Usb className="h-3.5 w-3.5" />{copy.manualHint}</p>
    <p aria-live="polite" className={`mt-1.5 flex items-center gap-1.5 text-xs font-medium ${feedback === "success" ? "text-emerald-700 dark:text-emerald-300" : feedback === "error" ? "text-destructive" : "sr-only"}`}>{feedback === "success" ? <><CheckCircle2 className="h-4 w-4" />{copy.success}</> : feedback === "error" ? <><XCircle className="h-4 w-4" />{copy.failure}</> : null}</p>
    <Dialog open={open} onOpenChange={nextOpen => { if (!nextOpen) stopCamera(); setOpen(nextOpen); }}>
      <DialogContent className="max-w-lg" dir={language === "ar" ? "rtl" : "ltr"}>
        <DialogHeader><DialogTitle>{copy.title}</DialogTitle><DialogDescription>{copy.description}</DialogDescription></DialogHeader>
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-black/90 aspect-video">
          <video ref={videoRef} aria-label={copy.videoLabel} autoPlay muted playsInline className="h-full w-full object-cover" />
          {!isScanning && !isStarting ? <div className="absolute inset-0 grid place-items-center p-5 text-center text-sm text-white/75"><Camera className="mb-2 h-7 w-7 text-primary" />{cameraError ?? copy.start}</div> : null}
          {isStarting ? <div className="absolute inset-0 grid place-items-center gap-2 bg-black/60 text-sm text-white"><Loader2 className="h-6 w-6 animate-spin text-primary" />{copy.preparing}</div> : null}
        </div>
        {cameraError ? <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">{cameraError}</p> : null}
        <DialogFooter className="gap-2 sm:gap-2"><Button type="button" variant="outline" onClick={() => { stopCamera(); setOpen(false); }}>{copy.close}</Button>{isScanning ? <Button type="button" variant="outline" onClick={stopCamera} className="gap-2"><Square className="h-4 w-4" />{copy.stop}</Button> : <Button type="button" onClick={startCamera} disabled={isStarting} className="gap-2"><Camera className="h-4 w-4" />{copy.start}</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
