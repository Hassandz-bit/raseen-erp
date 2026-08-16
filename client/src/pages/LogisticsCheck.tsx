import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Boxes, Calculator, Truck } from "lucide-react";
import React, { useMemo, useState } from "react";

const copy = {
  ar: { eyebrow: "فحص اللوجستيك", title: "احسب الحمولة قبل التحميل", description: "تُحتسب الكتلة والحجم والبالتات من مستوى تغليف فعلي، ثم تُرتّب المركبات المتاحة وفق السعة.", product: "معرّف المنتج", packaging: "معرّف مستوى التغليف", quantity: "الكمية بوحدة التغليف", calculate: "حساب واقتراح مركبات", weight: "الوزن الإجمالي كغ", volume: "الحجم الإجمالي م³", pallets: "البالتات", vehicles: "المركبات المقترحة", suitable: "ملائمة", unsuitable: "غير ملائمة", noVehicles: "لا توجد مركبات نشطة للاقتراح.", empty: "أدخل منتجاً ومستوى تغليف وكمية لبدء الحساب.", failed: "تعذر حساب الحمولة. تحقق من أن مستوى التغليف ينتمي إلى المنتج والمؤسسة." },
  fr: { eyebrow: "Contrôle logistique", title: "Calculez la charge avant le chargement", description: "Le poids, le volume et les palettes sont calculés à partir d’un niveau de conditionnement réel, puis les véhicules sont classés par capacité.", product: "Identifiant produit", packaging: "Identifiant niveau de conditionnement", quantity: "Quantité dans l’unité de conditionnement", calculate: "Calculer et proposer des véhicules", weight: "Poids total kg", volume: "Volume total m³", pallets: "Palettes", vehicles: "Véhicules proposés", suitable: "Compatible", unsuitable: "Non compatible", noVehicles: "Aucun véhicule actif à proposer.", empty: "Saisissez un produit, un niveau de conditionnement et une quantité.", failed: "Impossible de calculer la charge. Vérifiez que le conditionnement appartient au produit et à l’organisation." },
  en: { eyebrow: "Logistics check", title: "Calculate load before dispatch", description: "Weight, volume and pallets are calculated from an actual packaging level, then active vehicles are ranked by capacity.", product: "Product ID", packaging: "Packaging level ID", quantity: "Packaging quantity", calculate: "Calculate and suggest vehicles", weight: "Total weight kg", volume: "Total volume m³", pallets: "Pallets", vehicles: "Suggested vehicles", suitable: "Suitable", unsuitable: "Not suitable", noVehicles: "No active vehicle is available for suggestion.", empty: "Enter a product, packaging level and quantity to calculate.", failed: "Load calculation failed. Confirm that the packaging level belongs to the product and organisation." },
} as const;

function Metric({ label, value }: { label: string; value: string }) {
  return <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold tabular-nums">{value}</p></CardContent></Card>;
}

export default function LogisticsCheck() {
  const { language, direction, formatNumber } = useLanguage();
  const text = copy[language];
  const [productId, setProductId] = useState("");
  const [packagingLevelId, setPackagingLevelId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const input = useMemo(() => ({ lines: [{ productId: Number(productId || 0), packagingLevelId: Number(packagingLevelId || 0), quantity }] }), [productId, packagingLevelId, quantity]);
  const logistics = trpc.erp.uom.logistics.useQuery(input, { enabled: false, retry: false });
  const result = logistics.data;
  const canCalculate = Number(productId) > 0 && Number(packagingLevelId) > 0 && Number(quantity) > 0;
  return <DashboardLayout><main dir={direction} className="mx-auto w-full max-w-5xl space-y-6 px-4 py-7 sm:px-6 lg:px-8">
    <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold tracking-[0.15em] text-primary">{text.eyebrow}</p><h1 className="mt-2 text-3xl font-bold">{text.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{text.description}</p></div><Boxes className="h-10 w-10 text-primary" /></div></section>
    <Card><CardHeader><CardTitle>{text.calculate}</CardTitle><CardDescription>{text.empty}</CardDescription></CardHeader><CardContent><form className="grid gap-4 md:grid-cols-3" onSubmit={event => { event.preventDefault(); if (canCalculate) void logistics.refetch(); }}><Label>{text.product}<Input value={productId} onChange={event => setProductId(event.target.value)} inputMode="numeric" required /></Label><Label>{text.packaging}<Input value={packagingLevelId} onChange={event => setPackagingLevelId(event.target.value)} inputMode="numeric" required /></Label><Label>{text.quantity}<Input value={quantity} onChange={event => setQuantity(event.target.value)} inputMode="decimal" min="0.000001" required /></Label><div className="md:col-span-3"><Button type="submit" disabled={!canCalculate || logistics.isFetching} className="gap-2"><Calculator className="h-4 w-4" />{text.calculate}</Button></div></form>{logistics.isError ? <p className="mt-4 text-sm text-destructive">{text.failed}</p> : null}</CardContent></Card>
    {result ? <><section className="grid gap-4 sm:grid-cols-3"><Metric label={text.weight} value={formatNumber(Number(result.summary.totalGrossWeightKg))} /><Metric label={text.volume} value={formatNumber(Number(result.summary.totalVolumeM3))} /><Metric label={text.pallets} value={formatNumber(Number(result.summary.totalPallets))} /></section><Card><CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5 text-primary" />{text.vehicles}</CardTitle></CardHeader><CardContent className="space-y-3">{result.vehicles.length ? result.vehicles.map((item: any) => <div key={item.vehicle.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"><div><p className="font-semibold">{item.vehicle.code} · {item.vehicle.registrationNumber}</p><p className="mt-1 text-xs text-muted-foreground">{formatNumber(Number(item.vehicle.maximumPayloadWeight))} kg · {formatNumber(Number(item.vehicle.maximumVolume))} m³</p></div><Badge variant={item.assessment.suitable ? "default" : "destructive"}>{item.assessment.suitable ? text.suitable : text.unsuitable}</Badge></div>) : <p className="text-sm text-muted-foreground">{text.noVehicles}</p>}</CardContent></Card></> : null}
  </main></DashboardLayout>;
}
