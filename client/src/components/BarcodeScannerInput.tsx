import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Camera, Loader2, ScanLine, Square, Usb } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type BarcodeScannerInputProps = {
  value: string;
  onValueChange: (value: string) => void;
  onDetected?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
};

export function BarcodeScannerInput({ value, onValueChange, onDetected, placeholder, disabled = false, id }: BarcodeScannerInputProps) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  const copy = language === "ar" ? {
    scan: "مسح الرمز", manualHint: "يدعم قارئ USB والإدخال اليدوي", title: "مسح باركود أو QR", description: "اسمح للمتصفح باستخدام الكاميرا، ثم وجّهها إلى الرمز. قارئ USB يعمل مباشرة داخل الحقل.", start: "تشغيل الكاميرا", stop: "إيقاف الكاميرا", close: "إغلاق", preparing: "يتم تشغيل الكاميرا…", unavailable: "الكاميرا غير متاحة في هذا المتصفح أو لا يوجد اتصال آمن.", denied: "تعذر الوصول إلى الكاميرا. تحقق من إذن الكاميرا ثم أعد المحاولة.", videoLabel: "معاينة كاميرا ماسح الباركود",
  } : language === "fr" ? {
    scan: "Scanner", manualHint: "Lecteur USB et saisie manuelle pris en charge", title: "Scanner un code-barres ou QR", description: "Autorisez la caméra puis cadrez le code. Un lecteur USB fonctionne directement dans le champ.", start: "Activer la caméra", stop: "Arrêter la caméra", close: "Fermer", preparing: "Activation de la caméra…", unavailable: "La caméra n'est pas disponible ou la connexion n'est pas sécurisée.", denied: "Impossible d'accéder à la caméra. Vérifiez l'autorisation puis réessayez.", videoLabel: "Aperçu de la caméra du scanner",
  } : {
    scan: "Scan code", manualHint: "USB scanner and manual entry are supported", title: "Scan barcode or QR", description: "Allow camera access and frame the code. A USB scanner works directly in the field.", start: "Start camera", stop: "Stop camera", close: "Close", preparing: "Starting camera…", unavailable: "Camera is unavailable in this browser or the connection is not secure.", denied: "Camera access failed. Check camera permission and try again.", videoLabel: "Barcode scanner camera preview",
  };

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
    stopCamera();
    setOpen(false);
  }, [onDetected, onValueChange, stopCamera]);

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
    } finally {
      setIsStarting(false);
    }
  }, [acceptCode, copy.denied, copy.unavailable, stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  return <div className="barcode-scanner-input">
    <div className="flex gap-2">
      <Input id={id} dir="ltr" value={value} disabled={disabled} onChange={event => onValueChange(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); acceptCode(value); } }} placeholder={placeholder} className="min-w-0 flex-1" />
      <Button type="button" variant="outline" disabled={disabled} onClick={() => { setCameraError(null); setOpen(true); }} className="shrink-0 gap-2" aria-label={copy.scan}><ScanLine className="h-4 w-4" /><span className="hidden sm:inline">{copy.scan}</span></Button>
    </div>
    <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground"><Usb className="h-3.5 w-3.5" />{copy.manualHint}</p>
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
