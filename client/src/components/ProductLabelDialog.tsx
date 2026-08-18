import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { buildProductLabelDocument, escapeLabelText, isLinearBarcodeCompatible, type ProductLabelItem, type ProductLabelSize } from "@/lib/productLabelPrint";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { Loader2, Printer, QrCode, Tags } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type ProductLabelDialogProps = { open: boolean; onOpenChange: (open: boolean) => void; products: ProductLabelItem[] };

function barcodeSvg(value: string) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, value, { format: "CODE128", displayValue: false, margin: 0, width: 1.25, height: 34 });
  return new XMLSerializer().serializeToString(svg);
}

export function ProductLabelDialog({ open, onOpenChange, products }: ProductLabelDialogProps) {
  const { language } = useLanguage();
  const [copies, setCopies] = useState("1");
  const [size, setSize] = useState<ProductLabelSize>("small");
  const [isPrinting, setIsPrinting] = useState(false);
  const copy = useMemo(() => language === "ar" ? {
    title: "طباعة ملصقات المنتجات", description: "ينشئ كل ملصق رمز QR ورمزاً خطياً حين تكون قيمة الباركود متوافقة. يمثّل QR نفس رمز المنتج لتستطيع واجهة المبيعات قراءته.", size: "مقاس الملصق", small: "صغير 50×30 مم", medium: "متوسط 70×45 مم", copies: "نسخ لكل منتج", selected: "منتجات مختارة", print: "إنشاء وفتح الطباعة", unavailable: "لا توجد منتجات ذات باركود للطباعة.", browser: "تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.", printTitle: "ملصقات منتجات Nawa", linearNote: "يُطبع QR فقط لأن الرمز غير مناسب للباركود الخطي.", close: "إغلاق",
  } : language === "fr" ? {
    title: "Imprimer les étiquettes produits", description: "Chaque étiquette contient un QR et un code linéaire lorsque le contenu est compatible. Le QR encode le même code produit pour la vente.", size: "Format d'étiquette", small: "Petit 50×30 mm", medium: "Moyen 70×45 mm", copies: "Copies par produit", selected: "produits sélectionnés", print: "Créer et imprimer", unavailable: "Aucun produit avec code à imprimer.", browser: "Impossible d’ouvrir l’impression. Autorisez les fenêtres contextuelles et réessayez.", printTitle: "Étiquettes produits Nawa", linearNote: "QR uniquement : le code n’est pas compatible avec un code-barres linéaire.", close: "Fermer",
  } : {
    title: "Print product labels", description: "Each label includes a QR code and a linear barcode when the value is compatible. The QR encodes the same product code for sales scanning.", size: "Label size", small: "Small 50×30 mm", medium: "Medium 70×45 mm", copies: "Copies per product", selected: "selected products", print: "Create & print", unavailable: "No products with a code are available to print.", browser: "Unable to open the print window. Allow pop-ups and try again.", printTitle: "Nawa product labels", linearNote: "QR only: this code is not compatible with a linear barcode.", close: "Close",
  }, [language]);
  const printableProducts = products.filter(product => product.barcode?.trim());
  const copiesCount = Math.min(100, Math.max(1, Math.floor(Number(copies) || 1)));

  const printLabels = async () => {
    if (!printableProducts.length) return;
    const printWindow = window.open("", "nawa-product-labels");
    if (!printWindow) { toast.error(copy.browser); return; }
    setIsPrinting(true);
    try {
      const markup = (await Promise.all(printableProducts.flatMap(product => Array.from({ length: copiesCount }, async () => {
        const code = product.barcode.trim();
        const qr = await QRCode.toDataURL(code, { errorCorrectionLevel: "M", margin: 0, width: 180, color: { dark: "#16120c", light: "#ffffff" } });
        const linearMarkup = isLinearBarcodeCompatible(code) ? `<div class="barcode">${barcodeSvg(code)}</div>` : `<p class="linear-unavailable">${escapeLabelText(copy.linearNote)}</p>`;
        return `<article class="label"><div class="identity"><div class="brand">NAWA ERP</div><div class="name">${escapeLabelText(product.name)}</div><div class="sku">${escapeLabelText(product.sku)}</div><div class="code">${escapeLabelText(code)}</div>${linearMarkup}</div><div class="qr"><img src="${qr}" alt="QR ${escapeLabelText(code)}" /></div></article>`;
      })))).join("");
      printWindow.document.open();
      printWindow.document.write(buildProductLabelDocument(markup, size, copy.printTitle));
      printWindow.document.close();
      printWindow.focus();
      window.setTimeout(() => printWindow.print(), 250);
    } catch {
      printWindow.close();
      toast.error(copy.browser);
    } finally {
      setIsPrinting(false);
    }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent dir={language === "ar" ? "rtl" : "ltr"} className="max-w-lg"><DialogHeader><DialogTitle className="flex items-center gap-2"><Tags className="h-5 w-5 text-primary" />{copy.title}</DialogTitle><DialogDescription>{copy.description}</DialogDescription></DialogHeader>{printableProducts.length ? <div className="space-y-4"><div className="rounded-2xl border border-primary/20 bg-primary/[.04] p-3 text-sm"><p className="font-semibold text-foreground">{printableProducts.length} {copy.selected}</p><div className="mt-2 max-h-28 space-y-1 overflow-y-auto text-xs text-muted-foreground">{printableProducts.map(product => <p key={product.id}><span className="font-medium text-foreground">{product.name}</span> <span className="latin">· {product.barcode}</span></p>)}</div></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-foreground">{copy.size}<select value={size} onChange={event => setSize(event.target.value as ProductLabelSize)} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"><option value="small">{copy.small}</option><option value="medium">{copy.medium}</option></select></label><label className="text-sm font-medium text-foreground">{copy.copies}<Input className="mt-1.5" min="1" max="100" type="number" value={copies} onChange={event => setCopies(event.target.value)} /></label></div></div> : <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-800 dark:text-amber-200">{copy.unavailable}</div>}<DialogFooter className="gap-2 sm:gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{copy.close}</Button><Button type="button" disabled={!printableProducts.length || isPrinting} onClick={printLabels} className="gap-2">{isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}{copy.print}</Button></DialogFooter></DialogContent></Dialog>;
}
