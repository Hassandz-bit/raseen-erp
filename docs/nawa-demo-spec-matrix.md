# مصفوفة مواصفات Nawa Demo

## قرار التصميم

ستُنشأ شركة عرض واحدة معزولة باسم **شركة نواة للتوزيع والصناعات** وبمعرف ثابت `nawa-demo`، مع وسم خادمي صريح `isDemo`. لا تُدرج بيانات عرض في أي مؤسسة قائمة، ولا تُنشأ حسابات مصادقة أو كلمات مرور تجريبية. تمثل الأدوار بملفات موظفين وعضويات/سياقات عرض آمنة فقط إلى أن يربط مسؤول المنصة مستخدمين فعليين.

## ضمانات غير قابلة للتنازل

| الضمان | آلية التنفيذ المخططة |
|---|---|
| عزل Demo | كل سجل يحمل `organizationId` لشركة العرض، مع وسم `isDemo` على المؤسسة. |
| منع الأثر على الإنتاج | Seed/Reset/Delete تفشل إذا لم تكن المؤسسة موسومة Demo، وتتحقق من دور مدير المنصة. |
| إعادة التشغيل | معرفات رمزية ثابتة وupsert للبيانات الأساسية، مع Reset صريح للمعاملات ثم إعادة seed. |
| عدم استخدام بيانات حقيقية | أسماء وأرقام اتصال وحسابات وفواتير ومراجع اصطناعية بوضوح. |
| منطق حقيقي | تمر المستندات والتحويلات والحركة عبر خدمات Nawa الموجودة، لا صفحات Mock منفصلة. |
| تواريخ حية | تُحسب بمرجع وقت تشغيل Seed: اليوم، آخر 7 أيام، الشهر الجاري والسابق، وصلاحية نسبية. |

## تغطية المتطلبات

| المجال | الحد الأدنى في العرض | حالة الأساس الحالي | معالجة Seed |
|---|---|---|---|
| الهوية والبيئة | DZD، الجزائر، 3 فروع، 4 مخازن | متاح | Core seed. |
| الأدوار | 14 دوراً وظيفياً دون كلمات مرور | متاح جزئياً | Employee/profile fixtures مع توثيق ربط auth. |
| الكتالوج | 25–40 منتجاً و8 تصنيفات وتغليف وباركود وأبعاد | متاح | Catalog seed. |
| التسعير والعروض | Retail/Wholesale/Distributor/VIP و8 حالات عروض | متاح | Pricing/promotion seed. |
| الدفعات والمخزون | safe/monitor/near-expiry/critical/expired وFEFO | متاح | Inventory seed عبر خدمات الحركة. |
| العملاء والموردون | 15–20 عميلاً و8–10 موردين | متاح | Commerce core seed. |
| البيع والشراء | أوامر وفواتير وحالات كاملة ومتأخرة وجزئية | متاح | Commerce scenario seed. |
| التصنيع والجودة | BOM وأوامر متعددة وحالات جودة وتتبع | متاح جزئياً | Manufacturing seed وفق الخدمات المتاحة. |
| التوزيع | 4 مركبات وجولات وحمولات وتسليم جزئي وتحصل | متاح | Distribution scenario seed. |
| Nawa Retail | تاجر ومخرجان وموردان وكاتالوجان وسلال مستقلة | متاح | Retail seed مع الوصول والعروض والوثائق. |
| المالية | AR/AP/Cash/Bank/GL/Trial Balance/P&L/BS وميزانية | متاح جزئياً | Finance seed من الأحداث مع فحوص اتزان. |
| HR والرواتب | 15–20 موظفاً وحضور وإجازات وسلف ورواتب | متاح | HR seed وPayroll states. |
| AI واللوحات | أسئلة مقترحة من بيانات حقيقية وKPI وتنبيهات | متاح | Readiness seed؛ لا إجابات وهمية. |
| تجربة العرض | Demo Guide وBadge ومستندات وروابط سجل حقيقي | يحتاج توسعة | Demo UI منفصل ومحكوم بـisDemo. |

## بنية Seed المقترحة

```text
server/demo/
  constants.ts                 # هوية Demo ومراجع رمزية ثابتة
  dates.ts                     # تواريخ نسبية
  guard.ts                     # isDemo + مدير المنصة
  core.ts                      # organization/branches/warehouses/modules/settings
  catalog.ts                   # categories/products/UOM/packaging/prices/batches
  commerce.ts                  # customers/suppliers/PO/SO/invoices/movements
  manufacturing.ts             # BOM/production/quality/traceability
  distribution.ts              # fleet/load/routes/deliveries/collections
  retail.ts                    # access/outlets/orders/promotions/documents
  finance.ts                   # charts/fiscal periods/transactions/reports
  hr.ts                        # employees/attendance/leave/advances/payroll
  seed.ts                      # seedAll/reset/rebuild/delete orchestration
```

## معايير قبول الاختبار

تغطي الاختبارات: إنشاء Demo، عدم تكرار تشغيل Seed، Reset معزول، وجود منتجات وتغليف ودفعات، ترابط بيع وشراء وتصنيع وتوزيع وRetail ومالية ورواتب، ظهور التنبيهات، صحة روابط Demo Guide، منع الوصول بين المؤسسات، وعدم تأثر مؤسسة إنتاجية. كما ستراجع البوابات والصفحات الرئيسية بصرياً بالعربية والفرنسية والإنجليزية.

## حدود أولية يجب التحقق منها أثناء التنفيذ

لا توجد آلية Seed عامة حالياً سوى seed محاسبي محدود، ولا ينبغي اعتماد إدخالات SQL خامة للمستندات التي تحتاج حركة أو قيداً أو سجل تدقيق. بعض عناصر المواصفات (ربط كل تقرير مالي، Budget، وسندات التسليم التفصيلية) ستصنف PASS أو PARTIAL وفق الخدمات الموجودة فعلياً، لا وفق بيانات محاكية.
