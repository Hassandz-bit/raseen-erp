import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function ProductCreationForm({ onCreated }: { onCreated: () => void }) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [salePrice, setSalePrice] = useState("0");
  const create = trpc.erp.inventory.createProduct.useMutation({ onSuccess: () => { setName(""); setSku(""); setSalePrice("0"); onCreated(); toast.success(t("productCreated")); }, onError: error => toast.error(error.message || t("error")) });
  return <form className="grid gap-2 sm:grid-cols-[1.5fr_1fr_1fr_auto]" onSubmit={event => { event.preventDefault(); create.mutate({ name, sku, salePrice: Number(salePrice), productType: "standard", baseUnit: "unit", purchaseUnit: "unit", salesUnit: "unit", unitsPerCarton: 1, purchasePrice: 0, taxRate: 0, minimumStock: 0, reorderPoint: 0 }); }}><Input required value={name} onChange={event => setName(event.target.value)} placeholder={t("productName")} /><Input required value={sku} onChange={event => setSku(event.target.value)} placeholder={t("sku")} /><Input required min="0" step="0.01" type="number" value={salePrice} onChange={event => setSalePrice(event.target.value)} placeholder={t("salePrice")} /><Button disabled={create.isPending || !name.trim() || !sku.trim()} type="submit" className="gap-2">{create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{t("createProduct")}</Button></form>;
}
