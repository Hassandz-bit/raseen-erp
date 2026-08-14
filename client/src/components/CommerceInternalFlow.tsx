import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft, ArrowRight, Package, ReceiptText, ShoppingCart } from "lucide-react";

export default function CommerceInternalFlow({ onBack }: { onBack: () => void }) {
  const { direction, t } = useLanguage();
  const isRtl = direction === "rtl";
  const Arrow = isRtl ? ArrowLeft : ArrowRight;
  const nodes = [{ key: "purchases" as const, icon: ShoppingCart }, { key: "inventory" as const, icon: Package }, { key: "sales" as const, icon: ReceiptText }];
  return <section className="space-y-5" dir={direction}><header className="surface flex flex-col gap-4 rounded-3xl border p-6 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-semibold text-primary">{t("nawaFlow")}</p><h1 className="mt-1 text-2xl font-bold text-white">{t("internalFlow")}</h1><p className="mt-2 text-sm leading-7 text-muted-foreground">{t("commerceInventory")}</p></div><Button variant="outline" onClick={onBack} className="gap-2 rounded-xl border-white/10 bg-white/[.03] text-slate-200"><Arrow className="h-4 w-4" />{t("backToFlow")}</Button></header><div className="surface rounded-3xl border p-5 md:p-8"><div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-center">{nodes.map((node, index) => { const Icon = node.icon; return <div key={node.key} className="contents"><article className="min-w-[180px] rounded-2xl border border-primary/25 bg-primary/[.06] p-5 text-center"><div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-primary/12 text-primary"><Icon className="h-5 w-5" /></div><p className="mt-3 text-sm font-bold text-white">{t(node.key)}</p><p className="mt-1 text-[11px] text-muted-foreground">{t("available")}</p></article>{index < nodes.length - 1 && <div className="flex h-7 items-center justify-center md:h-auto md:w-10"><Arrow className="h-4 w-4 rotate-90 text-primary md:rotate-0" /></div>}</div>; })}</div></div></section>;
}
