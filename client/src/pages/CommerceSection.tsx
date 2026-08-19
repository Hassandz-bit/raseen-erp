import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ProductLabelDialog } from "@/components/ProductLabelDialog";
import { TableViewControls, useTableViewPreferences, type TableColumn } from "@/components/TableViewControls";
import { useLanguage } from "@/contexts/LanguageContext";
import { downloadSalesInvoiceExport } from "@/lib/salesInvoiceExport";
import { trpc } from "@/lib/trpc";
import { Boxes, ChevronLeft, Download, Eye, Loader2, PackageSearch, ReceiptText, RefreshCw, ShoppingCart, Tags, Warehouse } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

type CommerceSection = "products" | "warehouses" | "batches" | "sales" | "purchases";

const sectionMeta: Record<CommerceSection, { ar: string; fr: string; en: string; description: { ar: string; fr: string; en: string }; icon: typeof Boxes }> = {
  products: { ar: "المنتجات", fr: "Produits", en: "Products", description: { ar: "دليل المنتجات والأسعار وحالة الصنف.", fr: "Catalogue des produits, prix et statuts.", en: "Product catalog, prices, and item status." }, icon: Boxes },
  warehouses: { ar: "المخازن", fr: "Entrepôts", en: "Warehouses", description: { ar: "قائمة مخازن المؤسسة وأكوادها التشغيلية.", fr: "Entrepôts et codes opérationnels de l’organisation.", en: "Organization warehouses and operating codes." }, icon: Warehouse },
  batches: { ar: "الدفعات وFEFO", fr: "Lots et FEFO", en: "Batches & FEFO", description: { ar: "متابعة الدفعات والكميات وتواريخ الصلاحية وحالات الجودة.", fr: "Suivi des lots, quantités, péremption et qualité.", en: "Track lots, quantities, expiry dates, and quality states." }, icon: PackageSearch },
  sales: { ar: "فواتير المبيعات", fr: "Factures de vente", en: "Sales invoices", description: { ar: "متابعة فواتير البيع ومراحل الإصدار والتحصيل.", fr: "Suivi des factures, émission et encaissement.", en: "Track sales invoices, issue flow, and collection." }, icon: ReceiptText },
  purchases: { ar: "أوامر الشراء", fr: "Commandes d’achat", en: "Purchase orders", description: { ar: "متابعة أوامر الشراء وحالات الإرسال والاستلام.", fr: "Suivi des commandes, envoi et réception.", en: "Track purchase orders, sending, and receiving." }, icon: ShoppingCart },
};

const statusClass: Record<string, string> = {
  active: "border-emerald-400/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300",
  issued: "border-sky-400/30 bg-sky-400/10 text-sky-700 dark:text-sky-300",
  paid: "border-emerald-400/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300",
  received: "border-emerald-400/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300",
  draft: "border-slate-400/30 bg-slate-400/10 text-slate-700 dark:text-slate-300",
  blocked: "border-rose-400/30 bg-rose-400/10 text-rose-700 dark:text-rose-300",
  quarantined: "border-amber-400/30 bg-amber-400/10 text-amber-700 dark:text-amber-300",
  expired: "border-rose-400/30 bg-rose-400/10 text-rose-700 dark:text-rose-300",
  partial: "border-amber-400/30 bg-amber-400/10 text-amber-700 dark:text-amber-300",
  sent: "border-sky-400/30 bg-sky-400/10 text-sky-700 dark:text-sky-300",
};

function statusBadge(status: string, label: string) {
  return <Badge variant="outline" className={statusClass[status] ?? ""}>{label}</Badge>;
}

export default function CommerceSectionPage() {
  const { language, direction, formatCurrency, formatDate, formatNumber, t } = useLanguage();
  const [location, setLocation] = useLocation();
  const section = (location.split("/").pop() || "products") as CommerceSection;
  const meta = sectionMeta[section] ?? sectionMeta.products;
  const Icon = meta.icon;
  const [search, setSearch] = useState("");
  const [selectedBatchIds, setSelectedBatchIds] = useState<number[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [labelProductIds, setLabelProductIds] = useState<number[]>([]);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const products = trpc.erp.inventory.listProducts.useQuery(undefined, { retry: false });
  const warehouses = trpc.erp.inventory.listWarehouses.useQuery(undefined, { retry: false });
  const batches = trpc.erp.inventory.listBatches.useQuery(undefined, { retry: false });
  const invoices = trpc.erp.sales.listInvoices.useQuery(undefined, { retry: false });
  const orders = trpc.erp.purchases.listOrders.useQuery(undefined, { retry: false });
  const batchCapabilities = trpc.erp.inventory.batchBulkCapabilities.useQuery(undefined, { enabled: section === "batches", retry: false });
  const bulkBatchStatus = trpc.erp.inventory.bulkUpdateBatchStatus.useMutation({ onSuccess: () => { setSelectedBatchIds([]); void batches.refetch(); } });
  const selectedQuery = section === "products" ? products : section === "warehouses" ? warehouses : section === "batches" ? batches : section === "sales" ? invoices : orders;
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const displayedRows = useMemo(() => {
    const rows = selectedQuery.data ?? [];
    if (!normalizedSearch) return rows;
    return rows.filter((row: any) => Object.values(row).some(value => String(value ?? "").toLocaleLowerCase().includes(normalizedSearch)));
  }, [normalizedSearch, selectedQuery.data]);
  const labels = language === "ar" ? { search: "ابحث في الجدول", refresh: "تحديث البيانات", openCenter: "فتح مركز العمليات", count: "سجل", empty: "لا توجد بيانات مطابقة.", scrollHint: "اسحب أفقياً لرؤية جميع الأعمدة", name: "الاسم", code: "الرمز", price: "السعر", status: "الحالة", quantity: "الكمية", expiry: "الصلاحية", document: "المستند", netAmount: "الصافي", taxAmount: "الضريبة", priceMode: "وضع السعر", currency: "العملة", total: "الإجمالي", details: "التفاصيل", exportCsv: "تصدير CSV", inclusive: "شامل", exclusive: "غير شامل", selected: "دفعات محددة", activate: "تفعيل", block: "حظر", quarantine: "حجر" } : language === "fr" ? { search: "Rechercher dans le tableau", refresh: "Actualiser", openCenter: "Ouvrir le centre opérationnel", count: "lignes", empty: "Aucune donnée correspondante.", scrollHint: "Faites glisser pour voir toutes les colonnes", name: "Nom", code: "Code", price: "Prix", status: "Statut", quantity: "Quantité", expiry: "Expiration", document: "Document", netAmount: "Net", taxAmount: "TVA", priceMode: "Mode de prix", currency: "Devise", total: "Total", details: "Détails", exportCsv: "Exporter CSV", inclusive: "TTC", exclusive: "HT", selected: "lots sélectionnés", activate: "Activer", block: "Bloquer", quarantine: "Quarantaine" } : { search: "Search this table", refresh: "Refresh data", openCenter: "Open operations center", count: "rows", empty: "No matching data.", scrollHint: "Swipe to view all columns", name: "Name", code: "Code", price: "Price", status: "Status", quantity: "Quantity", expiry: "Expiry", document: "Document", netAmount: "Net", taxAmount: "Tax", priceMode: "Price mode", currency: "Currency", total: "Total", details: "Details", exportCsv: "Export CSV", inclusive: "Tax inclusive", exclusive: "Tax exclusive", selected: "selected batches", activate: "Activate", block: "Block", quarantine: "Quarantine" };
  const refetch = () => void selectedQuery.refetch();
  const openDetail = (id: number) => setLocation(`/commerce/${section}/${id}`);
  const detailButton = (id: number) => <Button variant="ghost" size="sm" className="gap-1" onClick={() => openDetail(id)}><Eye className="h-4 w-4" />{labels.details}</Button>;
  const toggleBatch = (batchId: number, checked: boolean) => setSelectedBatchIds(current => checked ? (current.includes(batchId) ? current : current.concat(batchId)) : current.filter(id => id !== batchId));
  const toggleProduct = (productId: number, checked: boolean) => setSelectedProductIds(current => checked ? (current.includes(productId) ? current : current.concat(productId)) : current.filter(id => id !== productId));
  const openLabelsForProducts = (productIds: number[]) => { setLabelProductIds(productIds); setLabelsOpen(true); };
  const labelProducts = useMemo(() => (products.data ?? []).filter(product => labelProductIds.includes(product.id)).map(product => ({ id: product.id, name: product.name, sku: product.sku, barcode: product.barcode ?? "" })), [labelProductIds, products.data]);
  const labelsText = language === "ar" ? "طباعة ملصقات" : language === "fr" ? "Imprimer les étiquettes" : "Print labels";
  const commerceColumns: TableColumn[] = section === "products" ? [{ id: "select", label: labelsText, locked: true }, { id: "name", label: labels.name }, { id: "sku", label: "SKU" }, { id: "price", label: labels.price }, { id: "status", label: labels.status }, { id: "details", label: labels.details }, { id: "labels", label: labelsText }] : section === "warehouses" ? [{ id: "code", label: labels.code }, { id: "name", label: labels.name }, { id: "status", label: labels.status }, { id: "details", label: labels.details }] : section === "batches" ? [{ id: "select", label: labels.selected, locked: true }, { id: "code", label: labels.code }, { id: "quantity", label: labels.quantity }, { id: "expiry", label: labels.expiry }, { id: "status", label: labels.status }, { id: "details", label: labels.details }] : section === "sales" ? [{ id: "document", label: labels.document }, { id: "net", label: labels.netAmount }, { id: "tax", label: labels.taxAmount }, { id: "total", label: labels.total }, { id: "priceMode", label: labels.priceMode }, { id: "status", label: labels.status }, { id: "details", label: labels.details }] : [{ id: "document", label: labels.document }, { id: "total", label: labels.total }, { id: "status", label: labels.status }, { id: "details", label: labels.details }];
  const commerceTableView = useTableViewPreferences(`commerce.${section}`, commerceColumns);
  const visibleCommerceColumns = commerceTableView.columnOrder.filter(id => !commerceTableView.hiddenColumnIds.includes(id));
  const configuredTable = (rows: any[], cell: (row: any, id: string) => React.ReactNode, header?: (id: string) => React.ReactNode) => <table className={`raseen-data-table table-density-${commerceTableView.density} text-sm`}><thead><tr className="border-b bg-muted/30 text-start text-xs text-muted-foreground">{visibleCommerceColumns.map(id => <th key={id} className="p-4">{header?.(id) ?? commerceColumns.find(column => column.id === id)?.label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-b border-border/60 hover:bg-muted/20">{visibleCommerceColumns.map(id => <td key={id} className="p-4">{cell(row, id)}</td>)}</tr>)}</tbody></table>;

  const table = () => {
    if (selectedQuery.isLoading) return <div className="grid min-h-72 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
    if (selectedQuery.isError) return <div className="grid min-h-72 place-items-center gap-3 p-8 text-center"><p className="text-sm text-destructive">{t("error")}</p><Button variant="outline" onClick={refetch}><RefreshCw className="me-2 h-4 w-4" />{labels.refresh}</Button></div>;
    if (!displayedRows.length) return <div className="grid min-h-72 place-items-center text-sm text-muted-foreground">{labels.empty}</div>;
    if (section === "products") return configuredTable(displayedRows, (product, id) => id === "select" ? <Checkbox aria-label={product.name} checked={selectedProductIds.includes(product.id)} onCheckedChange={checked => toggleProduct(product.id, checked === true)} /> : id === "name" ? <span className="font-medium">{product.name}</span> : id === "sku" ? <span className="font-mono text-xs">{product.sku}</span> : id === "price" ? formatCurrency(Number(product.salePrice)) : id === "status" ? statusBadge(product.status, t(product.status)) : id === "details" ? detailButton(product.id) : <Button variant="outline" size="sm" disabled={!product.barcode} onClick={() => openLabelsForProducts([product.id])} className="gap-1.5"><Tags className="h-3.5 w-3.5" />{labelsText}</Button>, id => id === "select" ? <Checkbox aria-label={labelsText} checked={displayedRows.length > 0 && displayedRows.every((product: any) => selectedProductIds.includes(product.id))} onCheckedChange={checked => setSelectedProductIds(checked ? displayedRows.map((product: any) => product.id) : [])} /> : undefined);
    if (section === "warehouses") return configuredTable(displayedRows, (warehouse, id) => id === "code" ? <span className="font-mono text-xs">{warehouse.code}</span> : id === "name" ? <span className="font-medium">{warehouse.name}</span> : id === "status" ? statusBadge(warehouse.status ?? "active", t(warehouse.status ?? "active")) : detailButton(warehouse.id));
    if (section === "batches") return configuredTable(displayedRows, (batch, id) => id === "select" ? <Checkbox aria-label={batch.lotNumber} checked={selectedBatchIds.includes(batch.id)} onCheckedChange={checked => toggleBatch(batch.id, checked === true)} /> : id === "code" ? <span className="font-mono text-xs">{batch.lotNumber}</span> : id === "quantity" ? formatNumber(Number(batch.currentQuantity)) : id === "expiry" ? batch.expiryDate ? formatDate(batch.expiryDate) : "—" : id === "status" ? statusBadge(batch.status, t(batch.status)) : detailButton(batch.id), id => id === "select" ? <Checkbox aria-label={labels.selected} checked={displayedRows.length > 0 && displayedRows.every((batch: any) => selectedBatchIds.includes(batch.id))} onCheckedChange={checked => setSelectedBatchIds(checked ? displayedRows.map((batch: any) => batch.id) : [])} /> : undefined);
    if (section === "sales") return configuredTable(displayedRows, (invoice, id) => id === "document" ? <span className="font-mono text-xs">{invoice.invoiceNumber}</span> : id === "net" ? formatCurrency(Number(invoice.netAmount)) : id === "tax" ? formatCurrency(Number(invoice.taxAmount)) : id === "total" ? <span className="font-semibold">{formatCurrency(Number(invoice.grandTotal))}</span> : id === "priceMode" ? invoice.taxMode === "inclusive" ? labels.inclusive : labels.exclusive : id === "status" ? statusBadge(invoice.status, t(invoice.status)) : detailButton(invoice.id));
    return configuredTable(displayedRows as any[], (document, id) => id === "document" ? <span className="font-mono text-xs">{document.invoiceNumber ?? document.orderNumber}</span> : id === "total" ? formatCurrency(Number(document.grandTotal)) : id === "status" ? statusBadge(document.status, t(document.status)) : detailButton(document.id));
  };

  const exportSalesInvoices = () => downloadSalesInvoiceExport((displayedRows as any[]).map(invoice => ({ invoiceNumber: invoice.invoiceNumber, status: t(invoice.status), taxMode: invoice.taxMode ?? "exclusive", currencyCode: invoice.currencyCode, netAmount: invoice.netAmount, taxAmount: invoice.taxAmount, grandTotal: invoice.grandTotal })), { invoice: labels.document, status: labels.status, priceMode: labels.priceMode, netAmount: labels.netAmount, taxAmount: labels.taxAmount, grandTotal: labels.total, currency: labels.currency });
  return <DashboardLayout><main dir={direction} className="mx-auto max-w-7xl space-y-6"><header className="surface flex flex-col gap-5 rounded-3xl border p-6 md:flex-row md:items-end md:justify-between"><div className="flex items-start gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-6 w-6" /></div><div><p className="text-sm text-primary">{language === "ar" ? "التجارة والمخزون" : language === "fr" ? "Commerce et stock" : "Commerce & inventory"}</p><h1 className="mt-1 text-2xl font-bold text-foreground">{meta[language]}</h1><p className="mt-2 text-sm leading-7 text-muted-foreground">{meta.description[language]}</p></div></div><Button variant="outline" onClick={() => setLocation(`/commerce#${section}`)}><ChevronLeft className="me-2 h-4 w-4" />{labels.openCenter}</Button></header>{section === "batches" && batchCapabilities.data?.canManageBatchStatus && selectedBatchIds.length > 0 ? <div className="surface flex flex-wrap items-center gap-2 rounded-2xl border border-primary/25 bg-primary/5 p-3"><span className="me-2 text-sm font-semibold">{selectedBatchIds.length} {labels.selected}</span><Button size="sm" variant="outline" disabled={bulkBatchStatus.isPending} onClick={() => bulkBatchStatus.mutate({ batchIds: selectedBatchIds, status: "active" })}>{labels.activate}</Button><Button size="sm" variant="outline" disabled={bulkBatchStatus.isPending} onClick={() => bulkBatchStatus.mutate({ batchIds: selectedBatchIds, status: "blocked" })}>{labels.block}</Button><Button size="sm" variant="outline" disabled={bulkBatchStatus.isPending} onClick={() => bulkBatchStatus.mutate({ batchIds: selectedBatchIds, status: "quarantined" })}>{labels.quarantine}</Button></div> : null}{section === "products" && selectedProductIds.length > 0 ? <div className="surface flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-3"><span className="text-sm font-semibold text-foreground">{selectedProductIds.length} {labels.count}</span><Button size="sm" onClick={() => openLabelsForProducts(selectedProductIds)} className="gap-2"><Tags className="h-4 w-4" />{labelsText}</Button></div> : null}<section className="surface overflow-hidden rounded-3xl border"><div className="flex flex-col gap-3 border-b border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-foreground">{meta[language]}</p><p className="mt-1 text-xs text-muted-foreground">{displayedRows.length} {labels.count}</p></div><div className="flex flex-wrap gap-2"><Input value={search} onChange={event => setSearch(event.target.value)} placeholder={labels.search} className="h-10 w-full sm:w-64" /><Button variant="outline" size="icon" aria-label={labels.refresh} onClick={refetch}><RefreshCw className="h-4 w-4" /></Button><TableViewControls view={commerceTableView} />{section === "sales" ? <Button variant="outline" onClick={exportSalesInvoices} disabled={!displayedRows.length} className="shrink-0 gap-2"><Download className="h-4 w-4" />{labels.exportCsv}</Button> : null}</div></div><p className="border-b border-border/70 bg-muted/20 px-4 py-2 text-center text-xs text-muted-foreground sm:hidden">{labels.scrollHint}</p><div className="overflow-x-auto">{table()}</div></section></main><ProductLabelDialog open={labelsOpen} onOpenChange={setLabelsOpen} products={labelProducts} /></DashboardLayout>;
}
