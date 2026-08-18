import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Loader2, PackagePlus, ReceiptText, Send, ShoppingCart, Warehouse } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const statusTone: Record<string, string> = {
  draft: "border-slate-400/20 bg-slate-400/10 text-slate-300",
  issued: "border-sky-400/20 bg-sky-400/10 text-sky-300",
  partial: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  paid: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  received: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  sent: "border-sky-400/20 bg-sky-400/10 text-sky-300",
  blocked: "border-rose-400/20 bg-rose-400/10 text-rose-300",
  quarantined: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  active: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  expired: "border-rose-400/20 bg-rose-400/10 text-rose-300",
};

export function CommerceOperationsPanel() {
  const { t, formatCurrency, formatDate, formatNumber, formatSettings } = useLanguage();
  const utils = trpc.useUtils();
  const products = trpc.erp.inventory.listProducts.useQuery(undefined, { retry: false });
  const warehouses = trpc.erp.inventory.listWarehouses.useQuery(undefined, { retry: false });
  const batches = trpc.erp.inventory.listBatches.useQuery(undefined, { retry: false });
  const invoices = trpc.erp.sales.listInvoices.useQuery(undefined, { retry: false });
  const orders = trpc.erp.purchases.listOrders.useQuery(undefined, { retry: false });

  const [warehouseName, setWarehouseName] = useState("");
  const [warehouseCode, setWarehouseCode] = useState("");
  const [salesProductId, setSalesProductId] = useState("");
  const [salesWarehouseId, setSalesWarehouseId] = useState("");
  const [salesQuantity, setSalesQuantity] = useState("1");
  const [purchaseProductId, setPurchaseProductId] = useState("");
  const [purchaseWarehouseId, setPurchaseWarehouseId] = useState("");
  const [purchaseQuantity, setPurchaseQuantity] = useState("1");
  const [purchaseUnitCost, setPurchaseUnitCost] = useState("0");
  const [batchAdjustments, setBatchAdjustments] = useState<Record<number, string>>({});

  const selectedSalesProduct = useMemo(() => products.data?.find(product => product.id === Number(salesProductId)), [products.data, salesProductId]);
  const selectedPurchaseProduct = useMemo(() => products.data?.find(product => product.id === Number(purchaseProductId)), [products.data, purchaseProductId]);
  const canCreateDocument = Boolean(selectedSalesProduct && salesWarehouseId);
  const canCreateOrder = Boolean(selectedPurchaseProduct && purchaseWarehouseId);

  useEffect(() => {
    if (!salesProductId && products.data?.[0]) setSalesProductId(String(products.data[0].id));
    if (!purchaseProductId && products.data?.[0]) {
      setPurchaseProductId(String(products.data[0].id));
      setPurchaseUnitCost(String(products.data[0].purchasePrice));
    }
  }, [products.data, purchaseProductId, salesProductId]);

  useEffect(() => {
    if (!salesWarehouseId && warehouses.data?.[0]) setSalesWarehouseId(String(warehouses.data[0].id));
    if (!purchaseWarehouseId && warehouses.data?.[0]) setPurchaseWarehouseId(String(warehouses.data[0].id));
  }, [purchaseWarehouseId, salesWarehouseId, warehouses.data]);

  useEffect(() => {
    if (selectedPurchaseProduct) setPurchaseUnitCost(String(selectedPurchaseProduct.purchasePrice));
  }, [selectedPurchaseProduct]);

  const refreshCommerce = async () => {
    await Promise.all([
      utils.erp.inventory.listBatches.invalidate(),
      utils.erp.inventory.listWarehouses.invalidate(),
      utils.erp.sales.listInvoices.invalidate(),
      utils.erp.purchases.listOrders.invalidate(),
      utils.erp.inventory.listProducts.invalidate(),
    ]);
  };

  const createWarehouse = trpc.erp.inventory.createWarehouse.useMutation({
    onSuccess: async () => {
      setWarehouseCode("");
      setWarehouseName("");
      await refreshCommerce();
      toast.success(t("warehouseCreated"));
    },
    onError: error => toast.error(error.message || t("error")),
  });
  const createInvoice = trpc.erp.sales.createInvoice.useMutation({
    onSuccess: async () => {
      await refreshCommerce();
      toast.success(t("documentCreated"));
    },
    onError: error => toast.error(error.message || t("error")),
  });
  const issueInvoice = trpc.erp.sales.issueInvoice.useMutation({
    onSuccess: async () => {
      await refreshCommerce();
      toast.success(t("documentIssued"));
    },
    onError: error => toast.error(error.message || t("error")),
  });
  const recordPayment = trpc.erp.sales.recordPayment.useMutation({
    onSuccess: async () => {
      await refreshCommerce();
      toast.success(t("paymentRecorded"));
    },
    onError: error => toast.error(error.message || t("error")),
  });
  const createOrder = trpc.erp.purchases.createOrder.useMutation({
    onSuccess: async () => {
      await refreshCommerce();
      toast.success(t("documentCreated"));
    },
    onError: error => toast.error(error.message || t("error")),
  });
  const sendOrder = trpc.erp.purchases.sendOrder.useMutation({
    onSuccess: async () => {
      await refreshCommerce();
      toast.success(t("documentIssued"));
    },
    onError: error => toast.error(error.message || t("error")),
  });
  const updateBatch = trpc.erp.inventory.updateBatchStatus.useMutation({
    onSuccess: async () => {
      await refreshCommerce();
      toast.success(t("batchStatusUpdated"));
    },
    onError: error => toast.error(error.message || t("error")),
  });
  const adjustBatch = trpc.erp.inventory.adjustBatchQuantity.useMutation({
    onSuccess: async () => {
      setBatchAdjustments({});
      await refreshCommerce();
      toast.success(t("quantityAdjusted"));
    },
    onError: error => toast.error(error.message || t("error")),
  });

  return (
    <section className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
        <article id="warehouses" className="surface scroll-mt-24 rounded-3xl border p-5">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary"><Warehouse className="h-5 w-5" /></span><div><h2 className="font-semibold text-foreground">{t("warehouses")}</h2><p className="mt-1 text-xs text-muted-foreground">{formatNumber(warehouses.data?.length ?? 0)}</p></div></div>
          <form className="mt-5 grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]" onSubmit={event => { event.preventDefault(); createWarehouse.mutate({ code: warehouseCode, name: warehouseName }); }}>
            <Input required value={warehouseCode} onChange={event => setWarehouseCode(event.target.value)} placeholder={t("warehouseCode")} />
            <Input required value={warehouseName} onChange={event => setWarehouseName(event.target.value)} placeholder={t("warehouseName")} />
            <Button type="submit" disabled={createWarehouse.isPending || !warehouseCode.trim() || !warehouseName.trim()} className="gap-2"><PackagePlus className="h-4 w-4" />{createWarehouse.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("createWarehouse")}</Button>
          </form>
          {warehouses.data?.length ? <div className="mt-4 flex flex-wrap gap-2">{warehouses.data.map(warehouse => <Badge key={warehouse.id} variant="outline" className="gap-1 border-primary/20 bg-primary/[.04] text-muted-foreground"><span className="latin text-primary">{warehouse.code}</span><span>{warehouse.name}</span></Badge>)}</div> : <p className="mt-4 text-sm text-muted-foreground">{t("createWarehouseFirst")}</p>}
        </article>

        <article id="batches" className="surface scroll-mt-24 rounded-3xl border p-5">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary"><ReceiptText className="h-5 w-5" /></span><div><h2 className="font-semibold text-foreground">{t("batchManagement")}</h2><p className="mt-1 text-xs text-muted-foreground">{t("fefo")}</p></div></div>
          <div className="mt-4 max-h-44 space-y-2 overflow-y-auto pe-1 thin-scrollbar">
            {batches.data?.length ? batches.data.map(batch => <div key={batch.id} className="space-y-2 rounded-xl border border-border/70 bg-background/30 px-3 py-2"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-medium text-foreground">{batch.lotNumber}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{batch.expiryDate ? formatDate(batch.expiryDate) : "—"} · {formatNumber(Number(batch.currentQuantity))}</p></div><select aria-label={t("batchStatus")} disabled={batch.status === "expired" || updateBatch.isPending} className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60" value={batch.status} onChange={event => updateBatch.mutate({ batchId: batch.id, status: event.target.value as "active" | "blocked" | "quarantined" })}><option value="active">{t("active")}</option><option value="blocked">{t("blocked")}</option><option value="quarantined">{t("quarantined")}</option><option value="expired">{t("expired")}</option></select></div><div className="flex items-center gap-2"><Input aria-label={t("adjustQuantity")} disabled={batch.status === "expired" || adjustBatch.isPending} type="number" step="0.001" value={batchAdjustments[batch.id] ?? ""} onChange={event => setBatchAdjustments(current => ({ ...current, [batch.id]: event.target.value }))} placeholder="+ / −" className="h-8 text-xs" /><Button variant="outline" size="sm" disabled={batch.status === "expired" || adjustBatch.isPending || !Number(batchAdjustments[batch.id])} onClick={() => adjustBatch.mutate({ batchId: batch.id, quantity: Number(batchAdjustments[batch.id]) })} className="h-8 shrink-0">{adjustBatch.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("adjustQuantity")}</Button></div></div>) : <p className="py-4 text-center text-sm text-muted-foreground">{t("empty")}</p>}
          </div>
        </article>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <article id="sales" className="surface scroll-mt-24 rounded-3xl border p-5">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-sky-400/10 text-sky-300"><ReceiptText className="h-5 w-5" /></span><div><h2 className="font-semibold text-foreground">{t("salesInvoices")}</h2><p className="mt-1 text-xs text-muted-foreground">{t("fefo")}</p></div></div>
          <form className="mt-5 grid gap-2 md:grid-cols-4" onSubmit={event => { event.preventDefault(); if (!selectedSalesProduct || !salesWarehouseId) return; createInvoice.mutate({ currencyCode: formatSettings.currencyCode, baseCurrencyCode: formatSettings.currencyCode, lines: [{ productId: selectedSalesProduct.id, warehouseId: Number(salesWarehouseId), quantity: Number(salesQuantity), unit: selectedSalesProduct.salesUnit }] }); }}>
            <select aria-label={t("product")} value={salesProductId} onChange={event => setSalesProductId(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40">{products.data?.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select>
            <select aria-label={t("warehouse")} value={salesWarehouseId} onChange={event => setSalesWarehouseId(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40">{warehouses.data?.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select>
            <Input required min="0.001" step="0.001" type="number" value={salesQuantity} onChange={event => setSalesQuantity(event.target.value)} placeholder={t("quantity")} />
            <Button type="submit" disabled={createInvoice.isPending || !canCreateDocument || Number(salesQuantity) <= 0} className="gap-2">{createInvoice.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ReceiptText className="h-4 w-4" />}{t("createInvoice")}</Button>
          </form>
          <div className="mt-5 space-y-2">{invoices.data?.length ? invoices.data.slice(0, 4).map(invoice => <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/30 p-3"><div><p className="latin text-sm font-semibold text-foreground">{invoice.invoiceNumber}</p><p className="mt-1 text-xs text-muted-foreground">{formatCurrency(Number(invoice.grandTotal))}</p></div><div className="flex items-center gap-2"><Badge variant="outline" className={statusTone[invoice.status] ?? ""}>{t(invoice.status)}</Badge>{invoice.status === "draft" ? <Button size="sm" onClick={() => issueInvoice.mutate({ invoiceId: invoice.id })} disabled={issueInvoice.isPending} className="h-8 gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />{t("issue")}</Button> : null}{["issued", "partial", "overdue"].includes(invoice.status) ? <Button size="sm" variant="outline" onClick={() => recordPayment.mutate({ invoiceId: invoice.id })} disabled={recordPayment.isPending} className="h-8">{t("pay")}</Button> : null}</div></div>) : <p className="py-5 text-center text-sm text-muted-foreground">{t("empty")}</p>}</div>
        </article>

        <article id="purchases" className="surface scroll-mt-24 rounded-3xl border p-5">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-400/10 text-violet-300"><ShoppingCart className="h-5 w-5" /></span><div><h2 className="font-semibold text-foreground">{t("purchaseOrders")}</h2><p className="mt-1 text-xs text-muted-foreground">{t("warehouse")}</p></div></div>
          <form className="mt-5 grid gap-2 md:grid-cols-4" onSubmit={event => { event.preventDefault(); if (!selectedPurchaseProduct || !purchaseWarehouseId) return; createOrder.mutate({ currencyCode: formatSettings.currencyCode, baseCurrencyCode: formatSettings.currencyCode, lines: [{ productId: selectedPurchaseProduct.id, warehouseId: Number(purchaseWarehouseId), quantity: Number(purchaseQuantity), unit: selectedPurchaseProduct.purchaseUnit, unitCost: Number(purchaseUnitCost) }] }); }}>
            <select aria-label={t("product")} value={purchaseProductId} onChange={event => setPurchaseProductId(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40">{products.data?.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select>
            <select aria-label={t("warehouse")} value={purchaseWarehouseId} onChange={event => setPurchaseWarehouseId(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40">{warehouses.data?.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select>
            <div className="grid grid-cols-2 gap-2"><Input required min="0.001" step="0.001" type="number" value={purchaseQuantity} onChange={event => setPurchaseQuantity(event.target.value)} placeholder={t("quantity")} /><Input required min="0" step="0.01" type="number" value={purchaseUnitCost} onChange={event => setPurchaseUnitCost(event.target.value)} placeholder={t("unitCost")} /></div>
            <Button type="submit" disabled={createOrder.isPending || !canCreateOrder || Number(purchaseQuantity) <= 0 || Number(purchaseUnitCost) < 0} className="gap-2">{createOrder.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}{t("createOrder")}</Button>
          </form>
          <div className="mt-5 space-y-2">{orders.data?.length ? orders.data.slice(0, 4).map(order => <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/30 p-3"><div><p className="latin text-sm font-semibold text-foreground">{order.orderNumber}</p><p className="mt-1 text-xs text-muted-foreground">{formatCurrency(Number(order.grandTotal))}</p></div><div className="flex items-center gap-2"><Badge variant="outline" className={statusTone[order.status] ?? ""}>{t(order.status)}</Badge>{order.status === "draft" ? <Button size="sm" onClick={() => sendOrder.mutate({ purchaseOrderId: order.id })} disabled={sendOrder.isPending} className="h-8 gap-1.5"><Send className="h-3.5 w-3.5" />{t("sendOrder")}</Button> : null}</div></div>) : <p className="py-5 text-center text-sm text-muted-foreground">{t("empty")}</p>}</div>
        </article>
      </div>
    </section>
  );
}
