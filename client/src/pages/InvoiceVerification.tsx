import { Card } from "@/components/ui/card";
import { Loader2, ShieldCheck, ShieldX } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function InvoiceVerification() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const verification = trpc.erp.invoiceVerification.verify.useQuery({ token }, { enabled: token.length >= 16, retry: false });
  const result = verification.data;
  return <main dir="rtl" className="min-h-screen bg-background p-5 text-foreground"><div className="mx-auto flex min-h-[75vh] max-w-xl items-center"><Card className="w-full border-border/70 bg-card p-8 text-center shadow-xl"><p className="text-sm font-semibold text-primary">RASEEN ERP</p><h1 className="mt-2 text-3xl font-bold">التحقق من الفاتورة</h1>{verification.isLoading ? <div className="mt-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : result?.valid ? <div className="mt-7"><ShieldCheck className="mx-auto h-14 w-14 text-emerald-500" /><p className="mt-4 text-xl font-bold">الفاتورة صحيحة وموقّعة من النظام</p><dl className="mt-6 grid gap-3 rounded-2xl bg-muted/40 p-5 text-right"><div className="flex justify-between gap-4"><dt>الجهة المصدرة</dt><dd className="font-semibold">{result.invoice.organizationName}</dd></div><div className="flex justify-between gap-4"><dt>رقم الفاتورة</dt><dd className="font-semibold">{result.invoice.invoiceNumber}</dd></div><div className="flex justify-between gap-4"><dt>الحالة</dt><dd className="font-semibold">{result.invoice.status}</dd></div></dl><p className="mt-5 text-xs text-muted-foreground">لا تعرض صفحة التحقق بيانات العميل أو تفاصيل البنود.</p></div> : <div className="mt-7"><ShieldX className="mx-auto h-14 w-14 text-rose-500" /><p className="mt-4 text-xl font-bold">تعذر التحقق من الفاتورة</p><p className="mt-2 text-sm text-muted-foreground">تحقق من الرمز أو تواصل مع الجهة المصدرة.</p></div>}</Card></div></main>;
}
