import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { createDocumentPreviewPdf } from "@/lib/documentPreviewExport";
import { trpc } from "@/lib/trpc";
import { CalendarCheck, Clock3, Download, FileText, RefreshCcw, ShieldCheck, UsersRound } from "lucide-react";
import React from "react";
import { toast } from "sonner";

const copy = {
  ar: { title: "مركز الموارد البشرية والرواتب", subtitle: "إدارة الموظفين والحضور والإجازات ضمن نطاق المؤسسة، مع حماية بيانات الأجور في إجراءات مستقلة.", overview: "نظرة عامة", employees: "الموظفون", attendance: "الحضور", leave: "الإجازات", overtime: "الساعات الإضافية", payroll: "الرواتب", payrollRegister: "سجل الرواتب", total: "إجمالي الموظفين", active: "نشطون", present: "حاضرون اليوم", absent: "غائبون اليوم", onLeave: "في إجازة", employee: "الموظف", number: "الرقم", department: "القسم", position: "المنصب", status: "الحالة", date: "التاريخ", type: "النوع", hours: "الساعات", currency: "العملة", gross: "إجمالي الرواتب", net: "صافي الرواتب", advances: "السلف القائمة", payrollAccess: "لا تملك صلاحية صريحة لعرض بيانات الرواتب.", exportExcel: "Excel", exportPdf: "PDF", bankCsv: "كشف البنك CSV", bankExcel: "كشف البنك Excel", empty: "لا توجد بيانات قابلة للعرض حالياً.", confidential: "بيانات الرواتب والرواتب الصافية لا تظهر هنا إلا عبر صلاحيات HR/Payroll الخادمية الصريحة.", loadError: "تعذر تحميل بعض بيانات الموارد البشرية. لا تعتمد القيم الظاهرة قبل إعادة المحاولة.", retry: "إعادة تحميل البيانات", bankExportError: "تعذر إنشاء الملف المطلوب." },
  fr: { title: "Centre RH et paie", subtitle: "Gérez les collaborateurs, présences et congés dans le périmètre de l’organisation; les salaires restent protégés dans des actions séparées.", overview: "Vue d’ensemble", employees: "Employés", attendance: "Présences", leave: "Congés", overtime: "Heures supplémentaires", payroll: "Paie", payrollRegister: "Registre de paie", total: "Employés au total", active: "Actifs", present: "Présents aujourd’hui", absent: "Absents aujourd’hui", onLeave: "En congé", employee: "Employé", number: "Numéro", department: "Département", position: "Poste", status: "Statut", date: "Date", type: "Type", hours: "Heures", currency: "Devise", gross: "Paie brute", net: "Paie nette", advances: "Avances en cours", payrollAccess: "Vous n’avez pas l’autorisation explicite de consulter les données de paie.", exportExcel: "Excel", exportPdf: "PDF", bankCsv: "Banque CSV", bankExcel: "Banque Excel", empty: "Aucune donnée à afficher.", confidential: "Les montants de paie et salaires nets ne sont accessibles que par des autorisations HR/Payroll explicites côté serveur.", loadError: "Certaines données RH n’ont pas pu être chargées. Ne vous fiez pas aux valeurs affichées avant un nouvel essai.", retry: "Recharger les données", bankExportError: "Impossible de créer le fichier demandé." },
  en: { title: "HR & payroll center", subtitle: "Manage employees, attendance, and leave within the organization scope; salary data remains protected in separate actions.", overview: "Overview", employees: "Employees", attendance: "Attendance", leave: "Leave", overtime: "Overtime", payroll: "Payroll", payrollRegister: "Payroll register", total: "Total employees", active: "Active", present: "Present today", absent: "Absent today", onLeave: "On leave", employee: "Employee", number: "Number", department: "Department", position: "Position", status: "Status", date: "Date", type: "Type", hours: "Hours", currency: "Currency", gross: "Gross payroll", net: "Net payroll", advances: "Outstanding advances", payrollAccess: "You do not have explicit permission to view payroll data.", exportExcel: "Excel", exportPdf: "PDF", bankCsv: "Bank CSV", bankExcel: "Bank Excel", empty: "No data available yet.", confidential: "Payroll amounts and net salaries are available only through explicit server-side HR/Payroll permissions.", loadError: "Some HR data could not be loaded. Do not rely on displayed values until you retry.", retry: "Reload data", bankExportError: "The requested file could not be generated." },
} as const;

function download(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function Table({ headers, rows, empty }: { headers: string[]; rows: string[][]; empty: string }) {
  return <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/40 text-muted-foreground"><tr>{headers.map(header => <th key={header} className="whitespace-nowrap px-4 py-3 text-start font-medium">{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={`${row[0]}-${index}`} className="border-t border-border/60">{row.map((cell, cellIndex) => <td key={cellIndex} className="whitespace-nowrap px-4 py-3">{cellIndex === row.length - 1 ? <Badge variant="outline">{cell}</Badge> : cell}</td>)}</tr>) : <tr><td colSpan={headers.length} className="px-4 py-10 text-center text-muted-foreground">{empty}</td></tr>}</tbody></table></div></CardContent></Card>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)}</p></CardContent></Card>;
}

export default function HRPayroll() {
  const { language, direction } = useLanguage();
  const text = copy[language];
  const dashboard = trpc.erp.hr.dashboard.useQuery();
  const directory = trpc.erp.hr.directory.useQuery();
  const operations = trpc.erp.hr.operations.useQuery();
  const payrollDashboard = trpc.erp.hr.payrollDashboard.useQuery(undefined, { retry: false });
  const reports = trpc.erp.hr.reports.useQuery(undefined, { retry: false });
  const paidPeriodId = payrollDashboard.data?.periods.find(period => period.status === "paid")?.id;
  const bankInput = React.useMemo(() => ({ payrollPeriodId: paidPeriodId ?? 1, delimiter: "," as const }), [paidPeriodId]);
  const bankExport = trpc.erp.hr.exportBankFile.useQuery(bankInput, { enabled: false, retry: false });
  const queries = [dashboard, directory, operations, payrollDashboard, reports];
  const isLoading = queries.some(query => query.isLoading);
  const hasLoadError = queries.some(query => query.isError);
  const refresh = () => { void Promise.all(queries.map(query => query.refetch())); };
  const metrics = [{ label: text.total, value: dashboard.data?.totalEmployees ?? 0, Icon: UsersRound }, { label: text.active, value: dashboard.data?.activeEmployees ?? 0, Icon: ShieldCheck }, { label: text.present, value: dashboard.data?.presentToday ?? 0, Icon: CalendarCheck }, { label: text.absent, value: dashboard.data?.absentToday ?? 0, Icon: Clock3 }];

  const exportDirectoryExcel = () => {
    const rows = (directory.data ?? []).map(row => [row.employeeNumber, row.fullNameAr || row.fullName, row.department || "", row.jobTitle || "", row.profileStatus || row.status]);
    const body = rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("");
    download("nawa-hr-directory.xls", `<table><tr><th>${text.number}</th><th>${text.employee}</th><th>${text.department}</th><th>${text.position}</th><th>${text.status}</th></tr>${body}</table>`, "application/vnd.ms-excel;charset=utf-8");
  };
  const exportPayrollExcel = () => {
    const rows = (reports.data?.payrollRegister ?? []).map(row => [row.periodName, row.employeeNumber, Number(row.grossPay).toFixed(2), Number(row.netPay).toFixed(2), row.currencyCode, row.status]);
    const body = rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("");
    download("nawa-payroll-register.xls", `<table><tr><th>${text.type}</th><th>${text.number}</th><th>${text.gross}</th><th>${text.net}</th><th>${text.currency}</th><th>${text.status}</th></tr>${body}</table>`, "application/vnd.ms-excel;charset=utf-8");
  };
  const exportPdf = async (filename: string, documentLabel: string, amount: string, rows: Array<{ label: string; value: string }>) => {
    try {
      const result = await createDocumentPreviewPdf({ direction, title: text.title, date: new Date().toLocaleString(language === "ar" ? "ar-SA" : language === "fr" ? "fr-FR" : "en-US"), documentLabel, amount, rows, footer: text.confidential, fontFamily: language === "ar" ? "noto-arabic" : "inter", paperSize: "A4" }, filename);
      download(result.filename, result.blob, "application/pdf");
    } catch { toast.error(text.bankExportError); }
  };
  const exportDirectoryPdf = () => void exportPdf(`nawa-hr-directory-${new Date().toISOString().slice(0, 10)}.pdf`, text.employees, String(directory.data?.length ?? 0), (directory.data ?? []).map(row => ({ label: row.employeeNumber, value: `${row.fullNameAr || row.fullName} · ${row.department || "—"}` })));
  const exportPayrollPdf = () => void exportPdf(`nawa-payroll-register-${new Date().toISOString().slice(0, 10)}.pdf`, text.payrollRegister, `${text.net}: ${Number(payrollDashboard.data?.totals.net ?? 0).toFixed(2)}`, (reports.data?.payrollRegister ?? []).map(row => ({ label: `${row.periodName} · ${row.employeeNumber}`, value: `${Number(row.netPay).toFixed(2)} ${row.currencyCode}` })));
  const downloadBankFile = async (format: "csv" | "excel") => {
    const result = await bankExport.refetch();
    if (!result.data) { toast.error(result.error?.message || text.bankExportError); return; }
    if (format === "csv") return download(result.data.filename, `\ufeff${result.data.content}`, "text/csv;charset=utf-8");
    const rows = result.data.rows.map(row => `<tr><td>${row.beneficiaryName}</td><td>${row.bankAccountReference}</td><td>${row.amount}</td><td>${row.currencyCode}</td><td>${row.reference}</td></tr>`).join("");
    download(result.data.filename.replace(/\.csv$/i, ".xls"), `<table><tr><th>beneficiary_name</th><th>bank_account_reference</th><th>amount</th><th>currency</th><th>reference</th></tr>${rows}</table>`, "application/vnd.ms-excel;charset=utf-8");
  };

  const employeeRows = (directory.data ?? []).map(row => [row.employeeNumber, row.fullNameAr || row.fullName, row.department || "—", row.jobTitle || "—", row.profileStatus || row.status]);
  const payrollRows = (reports.data?.payrollRegister ?? []).map(row => [row.periodName, row.employeeNumber, `${Number(row.grossPay).toFixed(2)} ${row.currencyCode}`, `${Number(row.netPay).toFixed(2)} ${row.currencyCode}`, row.status]);

  return <DashboardLayout><main dir={direction} className="mx-auto w-full max-w-[1500px] space-y-6 p-4 md:p-7">
    <section className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card p-6 shadow-2xl"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-primary"><UsersRound className="h-5 w-5" /><span className="text-sm font-semibold">Nawa ERP</span></div><h1 className="text-3xl font-bold tracking-tight">{text.title}</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">{text.subtitle}</p></div><div className="flex items-center gap-2"><Button variant="outline" onClick={refresh} disabled={isLoading}><RefreshCcw className={`me-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />{text.retry}</Button><Badge className="bg-primary/15 text-primary hover:bg-primary/15">{text.confidential}</Badge></div></div></section>
    {hasLoadError ? <Card className="border-destructive/30 bg-destructive/[.03]"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><p className="text-sm text-destructive">{text.loadError}</p><Button variant="outline" size="sm" onClick={refresh}>{text.retry}</Button></CardContent></Card> : null}
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{metrics.map(({ label, value, Icon }) => <Card key={label} className="border-white/10 bg-card/80"><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div><Icon className="h-8 w-8 text-primary" /></CardContent></Card>)}</section>
    <Tabs defaultValue="overview" className="space-y-5"><TabsList className="h-auto flex-wrap justify-start gap-1 bg-card p-1">{[["overview", text.overview], ["employees", text.employees], ["attendance", text.attendance], ["leave", text.leave], ["overtime", text.overtime], ["payroll", text.payroll]].map(([value, label]) => <TabsTrigger key={value} value={value}>{label}</TabsTrigger>)}</TabsList>
      <TabsContent value="overview"><Card><CardHeader><CardTitle>{text.overview}</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><Metric label={text.onLeave} value={dashboard.data?.onLeave ?? 0} /><Metric label={text.present} value={dashboard.data?.presentToday ?? 0} /></CardContent></Card></TabsContent>
      <TabsContent value="employees"><div className="space-y-4"><div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={exportDirectoryExcel}><Download className="me-2 h-4 w-4" />{text.exportExcel}</Button><Button variant="outline" onClick={exportDirectoryPdf}><FileText className="me-2 h-4 w-4" />{text.exportPdf}</Button></div><Table headers={[text.number, text.employee, text.department, text.position, text.status]} rows={employeeRows} empty={text.empty} /></div></TabsContent>
      <TabsContent value="attendance"><section className="grid gap-4 md:grid-cols-3"><Metric label={text.present} value={dashboard.data?.presentToday ?? 0} /><Metric label={text.absent} value={dashboard.data?.absentToday ?? 0} /><Metric label={text.onLeave} value={dashboard.data?.onLeave ?? 0} /></section></TabsContent>
      <TabsContent value="leave"><Table headers={[text.employee, text.date, text.type, text.status]} rows={(operations.data?.leaves ?? []).map(row => [String(row.employeeId), new Date(row.startsAt).toLocaleDateString(), String(row.leaveTypeId), row.status])} empty={text.empty} /></TabsContent>
      <TabsContent value="overtime"><Table headers={[text.employee, text.date, text.hours, text.status]} rows={(operations.data?.overtime ?? []).map(row => [String(row.employeeId), new Date(row.occurredAt).toLocaleDateString(), String(row.hours), row.status])} empty={text.empty} /></TabsContent>
      <TabsContent value="payroll">{payrollDashboard.error ? <Card><CardContent className="p-6 text-sm text-muted-foreground">{text.payrollAccess}</CardContent></Card> : <div className="space-y-5"><div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={exportPayrollExcel} disabled={reports.isLoading || Boolean(reports.error)}><Download className="me-2 h-4 w-4" />{text.payrollRegister} {text.exportExcel}</Button><Button variant="outline" onClick={exportPayrollPdf} disabled={reports.isLoading || Boolean(reports.error)}><FileText className="me-2 h-4 w-4" />{text.payrollRegister} {text.exportPdf}</Button><Button variant="outline" disabled={!paidPeriodId || bankExport.isFetching} onClick={() => void downloadBankFile("csv")}><Download className="me-2 h-4 w-4" />{text.bankCsv}</Button><Button variant="outline" disabled={!paidPeriodId || bankExport.isFetching} onClick={() => void downloadBankFile("excel")}><Download className="me-2 h-4 w-4" />{text.bankExcel}</Button></div><section className="grid gap-4 md:grid-cols-3"><Metric label={text.gross} value={payrollDashboard.data?.totals.gross ?? 0} /><Metric label={text.net} value={payrollDashboard.data?.totals.net ?? 0} /><Metric label={text.advances} value={payrollDashboard.data?.totals.outstandingAdvances ?? 0} /></section><Table headers={[text.type, text.date, text.status]} rows={(payrollDashboard.data?.periods ?? []).map(row => [row.name, new Date(row.startsAt).toLocaleDateString(), row.status])} empty={text.empty} /><Card><CardHeader><CardTitle>{text.payrollRegister}</CardTitle></CardHeader><CardContent><Table headers={[text.type, text.number, text.gross, text.net, text.status]} rows={payrollRows} empty={text.empty} /></CardContent></Card></div>}</TabsContent>
    </Tabs>
  </main></DashboardLayout>;
}
