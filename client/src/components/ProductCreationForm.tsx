import { BarcodeScannerInput } from "@/components/BarcodeScannerInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { FolderPlus, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function ProductCreationForm({ onCreated }: { onCreated: () => void }) {
  const { t, language } = useLanguage();
  const categoryCopy = language === "ar" ? { title: "فئة المنتج", none: "بلا فئة", new: "اسم فئة جديدة", add: "إضافة فئة", created: "تمت إضافة الفئة" } : language === "fr" ? { title: "Catégorie du produit", none: "Sans catégorie", new: "Nom de la nouvelle catégorie", add: "Ajouter une catégorie", created: "Catégorie ajoutée" } : { title: "Product category", none: "No category", new: "New category name", add: "Add category", created: "Category added" };
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [salePrice, setSalePrice] = useState("0");
  const [categoryId, setCategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const categories = trpc.erp.inventory.listProductCategories.useQuery();
  const create = trpc.erp.inventory.createProduct.useMutation({
    onSuccess: () => {
      setName("");
      setSku("");
      setBarcode("");
      setSalePrice("0");
      onCreated();
      toast.success(t("productCreated"));
    },
    onError: error => toast.error(error.message || t("error")),
  });
  const createCategory = trpc.erp.inventory.createProductCategory.useMutation({
    onSuccess: category => { setCategoryId(String(category.id)); setNewCategoryName(""); void categories.refetch(); toast.success(categoryCopy.created); },
    onError: error => toast.error(error.message || t("error")),
  });

  return <form className="space-y-3" onSubmit={event => {
    event.preventDefault();
    create.mutate({
      name,
      sku,
      barcode: barcode.trim() || undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
      salePrice: Number(salePrice),
      productType: "standard",
      baseUnit: "UNIT",
      purchaseUnit: "UNIT",
      salesUnit: "UNIT",
      unitsPerCarton: 1,
      purchasePrice: 0,
      taxRate: 0,
      minimumStock: 0,
      reorderPoint: 0,
    });
  }}>
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4"><Input required value={name} onChange={event => setName(event.target.value)} placeholder={t("productName")} /><Input required value={sku} onChange={event => setSku(event.target.value)} placeholder={t("sku")} /><BarcodeScannerInput value={barcode} onValueChange={setBarcode} placeholder={t("barcode")} /><Input required min="0" step="0.01" type="number" value={salePrice} onChange={event => setSalePrice(event.target.value)} placeholder={t("salePrice")} /></div>
    <div className="grid items-end gap-3 rounded-2xl border border-primary/15 bg-primary/[.035] p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"><label className="block min-w-0 text-xs font-medium text-muted-foreground">{categoryCopy.title}<select value={categoryId} onChange={event => setCategoryId(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground"><option value="">{categoryCopy.none}</option>{categories.data?.filter(category => category.status === "active").map(category => <option key={category.id} value={category.id}>{category.parentId ? "↳ " : ""}{category.name}</option>)}</select></label><label className="block min-w-0 text-xs font-medium text-muted-foreground">{categoryCopy.add}<Input value={newCategoryName} onChange={event => setNewCategoryName(event.target.value)} placeholder={categoryCopy.new} className="mt-1.5" /></label><div className="flex gap-2"><Button type="button" variant="outline" disabled={createCategory.isPending || newCategoryName.trim().length < 2} onClick={() => createCategory.mutate({ name: newCategoryName.trim() })} className="gap-2"><FolderPlus className="h-4 w-4" />{categoryCopy.add}</Button><Button disabled={create.isPending || !name.trim() || !sku.trim()} type="submit" className="gap-2">{create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{t("createProduct")}</Button></div></div>
  </form>;
}
