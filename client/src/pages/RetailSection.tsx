import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatOperationalStatus } from "@/lib/operationalStatus";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ClipboardList, Loader2, RefreshCw, RotateCcw, Store, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

type RetailSection = "accesses" | "users" | "outlets" | "promotions" | "orders" | "returns";

const labels: Record<RetailSection, { ar: string; fr: string; en: string; description: { ar: string; fr: string; en: string }; anchor: string }> = {
  accesses: { ar: "علاقات التجار", fr: "Relations détaillants", en: "Retailer relations", description: { ar: "جدول علاقات الوصول وقوائم الأسعار وسياسات الظهور.", fr: "Relations d’accès, listes de prix et politiques de visibilité.", en: "Access relationships, price lists, and visibility policies." }, anchor: "accesses" },
  users: { ar: "مستخدمو البوابة", fr: "Utilisateurs du portail", en: "Portal users", description: { ar: "جدول مستخدمي التجار وأدوارهم وحالة علاقتهم.", fr: "Utilisateurs des détaillants, rôles et statut de relation.", en: "Merchant users, roles, and relationship status." }, anchor: "users" },
  outlets: { ar: "منافذ التجار", fr: "Points de vente", en: "Retailer outlets", description: { ar: "جدول منافذ التاجر المختار وعناوينها.", fr: "Points de vente et adresses du détaillant sélectionné.", en: "Selected retailer outlets and addresses." }, anchor: "outlets" },
  promotions: { ar: "عروض B2B", fr: "Offres B2B", en: "B2B promotions", description: { ar: "جدول العروض المرتبطة بكتالوج التجار.", fr: "Offres liées au catalogue détaillant.", en: "Promotions linked to the retailer catalog." }, anchor: "promotions" },
  orders: { ar: "طلبات التاجر", fr: "Commandes marchands", en: "Merchant orders", description: { ar: "جدول طلبات التجار وحالات المراجعة والتحويل.", fr: "Commandes détaillants, revue et conversion.", en: "Merchant orders, review, and conversion status." }, anchor: "orders" },
  returns: { ar: "طلبات الإرجاع", fr: "Demandes de retour", en: "Return requests", description: { ar: "جدول طلبات الإرجاع وحالات معالجتها.", fr: "Demandes de retour et statuts de traitement.", en: "Return requests and their processing statuses." }, anchor: "returns" },
};

function Table({ headers, rows, empty }: { headers: string[]; rows: Array<Array<string | React.ReactNode>>; empty: string }) {
  return <div className="nawa-data-table" aria-label="جدول قابل للتمرير أفقياً"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b bg-muted/30 text-start text-xs text-muted-foreground">{headers.map(header => <th key={header} className="whitespace-nowrap p-4 font-medium">{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index} className="border-b border-border/60 hover:bg-muted/20">{row.map((cell, cellIndex) => <td key={cellIndex} className="whitespace-nowrap p-4">{cell}</td>)}</tr>) : <tr><td colSpan={headers.length} className="p-12 text-center text-muted-foreground">{empty}</td></tr>}</tbody></table></div></div>;
}

function OperationalBadge({ status }: { status: string | null | undefined }) {
  const { language } = useLanguage();
  return <Badge variant="outline" className="nawa-status-badge">{formatOperationalStatus(language, status)}</Badge>;
}

export default function RetailSectionPage() {
  const { language, direction, formatNumber } = useLanguage();
  const [location, setLocation] = useLocation();
  const section = (location.split("/").pop() || "accesses") as RetailSection;
  const current = labels[section] ?? labels.accesses;
  const [customerId, setCustomerId] = useState<string>("");
  const accesses = trpc.erp.b2b.management.accesses.useQuery();
  const orders = trpc.erp.b2b.management.orders.useQuery();
  const returns = trpc.erp.b2b.management.returns.useQuery();
  const promotions = trpc.erp.b2b.management.promotions.useQuery();
  const firstCustomerId = customerId || String(accesses.data?.[0]?.customerId ?? "");
  const outlets = trpc.erp.b2b.outlets.list.useQuery({ customerId: Number(firstCustomerId || 0) }, { enabled: section === "outlets" && Boolean(firstCustomerId) });
  const allQueries = [accesses, orders, returns, promotions, outlets];
  const isLoading = allQueries.some(query => query.isLoading);
  const isError = allQueries.some(query => query.isError);
  const copy = language === "ar" ? { manage: "فتح مركز إدارة بوابة التاجر", refresh: "تحديث", retry: "إعادة المحاولة", empty: "لا توجد بيانات قابلة للعرض حالياً.", error: "تعذر تحميل بيانات بوابة التاجر. تحقق من الاتصال ثم أعد المحاولة.", customer: "التاجر", status: "الحالة", role: "الدور", priceList: "قائمة الأسعار", user: "المستخدم", code: "الرمز", name: "الاسم", address: "العنوان", product: "المنتج", type: "النوع", period: "الفترة", order: "الطلب", amount: "القيمة", reason: "السبب", action: "الإجراءات" } : language === "fr" ? { manage: "Ouvrir la gestion du portail marchand", refresh: "Actualiser", retry: "Réessayer", empty: "Aucune donnée à afficher.", error: "Impossible de charger les données du portail marchand. Vérifiez la connexion puis réessayez.", customer: "Marchand", status: "Statut", role: "Rôle", priceList: "Liste de prix", user: "Utilisateur", code: "Code", name: "Nom", address: "Adresse", product: "Produit", type: "Type", period: "Période", order: "Commande", amount: "Montant", reason: "Motif", action: "Actions" } : { manage: "Open Merchant Portal management", refresh: "Refresh", retry: "Try again", empty: "No data available yet.", error: "Merchant portal data could not be loaded. Check the connection and try again.", customer: "Merchant", status: "Status", role: "Role", priceList: "Price list", user: "User", code: "Code", name: "Name", address: "Address", product: "Product", type: "Type", period: "Period", order: "Order", amount: "Amount", reason: "Reason", action: "Actions" };
  const accessRows = useMemo(() => (accesses.data ?? []).map((item: any) => [item.customerName, <OperationalBadge key={`${item.id}-status`} status={item.status} />, item.priceListName ?? "—", item.retailerRole]), [accesses.data]);
  const userRows = useMemo(() => (accesses.data ?? []).map((item: any) => [`#${item.userId}`, item.customerName, item.retailerRole, <OperationalBadge key={`${item.id}-user-status`} status={item.status} />]), [accesses.data]);
  const outletRows = useMemo(() => (outlets.data ?? []).map((item: any) => [item.code, item.name, item.address ?? "—"]), [outlets.data]);
  const promotionRows = useMemo(() => (promotions.data ?? []).map((item: any) => [item.name, item.productNameAr || item.productName || "—", item.type, `${new Date(item.startsAt).toLocaleDateString(language)} – ${new Date(item.endsAt).toLocaleDateString(language)}`]), [language, promotions.data]);
  const orderRows = useMemo(() => (orders.data ?? []).map((item: any) => [item.orderNumber, item.retailerName, `${formatNumber(Number(item.totalAmount))} ${item.currencyCode}`, <OperationalBadge key={`${item.id}-order-status`} status={item.status} />]), [formatNumber, orders.data]);
  const returnRows = useMemo(() => (returns.data ?? []).map((item: any) => [item.orderNumber, item.retailerName, item.request.reason, <OperationalBadge key={`${item.request.id}-return-status`} status={item.request.status} />]), [returns.data]);
  const table = section === "accesses" ? <Table headers={[copy.customer, copy.status, copy.priceList, copy.role]} rows={accessRows} empty={copy.empty} /> : section === "users" ? <Table headers={[copy.user, copy.customer, copy.role, copy.status]} rows={userRows} empty={copy.empty} /> : section === "outlets" ? <Table headers={[copy.code, copy.name, copy.address]} rows={outletRows} empty={copy.empty} /> : section === "promotions" ? <Table headers={[copy.name, copy.product, copy.type, copy.period]} rows={promotionRows} empty={copy.empty} /> : section === "orders" ? <Table headers={[copy.order, copy.customer, copy.amount, copy.status]} rows={orderRows} empty={copy.empty} /> : <Table headers={[copy.order, copy.customer, copy.reason, copy.status]} rows={returnRows} empty={copy.empty} />;
  const retry = () => { void Promise.all(allQueries.map(query => query.refetch())); };
  return <DashboardLayout><main dir={direction} className="mx-auto max-w-7xl space-y-6"><header className="surface flex flex-col gap-5 rounded-3xl border p-6 md:flex-row md:items-end md:justify-between"><div className="flex items-start gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">{section === "orders" ? <ClipboardList className="h-6 w-6" /> : section === "returns" ? <RotateCcw className="h-6 w-6" /> : section === "users" ? <UsersRound className="h-6 w-6" /> : <Store className="h-6 w-6" />}</div><div><p className="text-sm text-primary">{language === "ar" ? "بوابة التاجر" : language === "fr" ? "Portail marchand" : "Merchant Portal"}</p><h1 className="mt-1 text-2xl font-bold text-foreground">{current[language]}</h1><p className="mt-2 text-sm leading-7 text-muted-foreground">{current.description[language]}</p></div></div><Button variant="outline" onClick={() => setLocation(`/b2b-orders#${current.anchor}`)}><ChevronLeft className="me-2 h-4 w-4" />{copy.manage}</Button></header>{section === "outlets" ? <Card><CardContent className="flex flex-wrap items-center gap-3 p-4"><span className="text-sm text-muted-foreground">{copy.customer}</span><Select value={firstCustomerId} onValueChange={setCustomerId}><SelectTrigger className="w-full sm:w-72"><SelectValue /></SelectTrigger><SelectContent>{Array.from(new Map((accesses.data ?? []).map((access: any) => [access.customerId, access])).values()).map((access: any) => <SelectItem key={access.customerId} value={String(access.customerId)}>{access.customerName}</SelectItem>)}</SelectContent></Select></CardContent></Card> : null}<section className="surface overflow-hidden rounded-3xl border"><div className="flex items-center justify-between border-b border-border/70 p-4"><div><p className="font-semibold">{current[language]}</p><p className="mt-1 text-xs text-muted-foreground">{language === "ar" ? "البيانات تُقرأ من عقود بوابة التاجر المعزولة." : language === "fr" ? "Les données proviennent des contrats isolés du portail marchand." : "Data is read from isolated merchant portal contracts."}</p></div><Button variant="outline" size="icon" aria-label={copy.refresh} onClick={retry}><RefreshCw className="h-4 w-4" /></Button></div>{isLoading ? <div className="nawa-loading-canvas" role="status"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : isError ? <div className="grid min-h-72 place-items-center gap-3 p-6 text-center"><p className="max-w-sm text-sm leading-7 text-destructive">{copy.error}</p><Button variant="outline" onClick={retry}>{copy.retry}</Button></div> : table}</section></main></DashboardLayout>;
}
