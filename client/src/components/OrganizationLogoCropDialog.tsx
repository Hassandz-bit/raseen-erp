import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Crop, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = { file?: File; language: "ar" | "fr" | "en"; onOpenChange: (open: boolean) => void; onConfirm: (dataUrl: string) => void; isUploading?: boolean };

const copy = {
  ar: { title: "قص الشعار للطباعة", description: "اضبط التكبير والموضع قبل حفظ نسخة محسّنة للمستندات الرسمية.", ratio: "نسبة الشعار", wide: "عريض 4:1", square: "مربع 1:1", zoom: "التكبير", horizontal: "إزاحة أفقية", vertical: "إزاحة عمودية", cancel: "إلغاء", apply: "استخدام النسخة المقصوصة" },
  fr: { title: "Recadrer le logo", description: "Ajustez le cadrage avant de créer une version optimisée pour les documents officiels.", ratio: "Format", wide: "Large 4:1", square: "Carré 1:1", zoom: "Zoom", horizontal: "Décalage horizontal", vertical: "Décalage vertical", cancel: "Annuler", apply: "Utiliser le recadrage" },
  en: { title: "Crop logo for print", description: "Adjust framing before creating an optimized version for official documents.", ratio: "Logo ratio", wide: "Wide 4:1", square: "Square 1:1", zoom: "Zoom", horizontal: "Horizontal offset", vertical: "Vertical offset", cancel: "Cancel", apply: "Use cropped version" },
} as const;

export function OrganizationLogoCropDialog({ file, language, onOpenChange, onConfirm, isUploading }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [ratio, setRatio] = useState<"wide" | "square">("wide");
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const text = copy[language];

  const draw = () => {
    const canvas = canvasRef.current; const image = imageRef.current;
    if (!canvas || !image) return;
    canvas.width = ratio === "wide" ? 1000 : 640; canvas.height = 250;
    const context = canvas.getContext("2d"); if (!context) return;
    context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.max(canvas.width / image.width, canvas.height / image.height) * zoom;
    const width = image.width * scale; const height = image.height * scale;
    const x = (canvas.width - width) / 2 + (offsetX / 100) * canvas.width * 0.35;
    const y = (canvas.height - height) / 2 + (offsetY / 100) * canvas.height * 0.35;
    context.drawImage(image, x, y, width, height);
  };

  useEffect(() => {
    if (!file) return;
    setLoaded(false); setRatio("wide"); setZoom(1); setOffsetX(0); setOffsetY(0);
    const objectUrl = URL.createObjectURL(file); const image = new Image();
    image.onload = () => { imageRef.current = image; setLoaded(true); URL.revokeObjectURL(objectUrl); };
    image.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  useEffect(() => { if (loaded) draw(); }, [loaded, ratio, zoom, offsetX, offsetY]);

  const apply = () => { const dataUrl = canvasRef.current?.toDataURL("image/jpeg", 0.9); if (dataUrl) onConfirm(dataUrl); };
  return <Dialog open={Boolean(file)} onOpenChange={onOpenChange}><DialogContent className="max-w-2xl" dir={language === "ar" ? "rtl" : "ltr"}><DialogHeader><DialogTitle>{text.title}</DialogTitle><DialogDescription>{text.description}</DialogDescription></DialogHeader><div className="space-y-5"><div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950 p-3"><canvas ref={canvasRef} className="mx-auto block max-h-64 w-full rounded-lg bg-white object-contain" /></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm text-foreground">{text.ratio}<select value={ratio} onChange={event => setRatio(event.target.value as "wide" | "square")} className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-white/[.04] px-3"><option value="wide">{text.wide}</option><option value="square">{text.square}</option></select></label><label className="text-sm text-foreground">{text.zoom}<input aria-label={text.zoom} className="mt-3 w-full accent-primary" min="1" max="3" step="0.05" type="range" value={zoom} onChange={event => setZoom(Number(event.target.value))} /></label><label className="text-sm text-foreground">{text.horizontal}<input aria-label={text.horizontal} className="mt-3 w-full accent-primary" min="-100" max="100" type="range" value={offsetX} onChange={event => setOffsetX(Number(event.target.value))} /></label><label className="text-sm text-foreground">{text.vertical}<input aria-label={text.vertical} className="mt-3 w-full accent-primary" min="-100" max="100" type="range" value={offsetY} onChange={event => setOffsetY(Number(event.target.value))} /></label></div></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>{text.cancel}</Button><Button disabled={!loaded || isUploading} onClick={apply}><Crop className="me-2 h-4 w-4" />{isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : text.apply}</Button></DialogFooter></DialogContent></Dialog>;
}
