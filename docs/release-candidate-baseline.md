# Release Candidate Baseline

## نقطة الأساس

نقطة الأساس المعتمدة هي `72d5c56c`، بعد إغلاق عمولات التسليم الجزئي. الترحيلات موجودة بالتسلسل حتى `0034_melodic_wallow.sql`، ولا يوجد ترحيل مولد جديد أو مكرر عند baseline.

| فحص baseline | النتيجة |
|---|---|
| `pnpm check` | ناجح |
| `pnpm lint` | ناجح |
| `pnpm test` | ناجح |
| `pnpm build` | ناجح؛ تحذير حجم الحزمة أكبر من 500KB غير مانع |

## مصفوفة أولية

| الوحدة | الحالة عند الأساس |
|---|---|
| Core وCommerce وInventory | DONE |
| Distribution وDriver وB2B | DONE |
| Manufacturing | DONE |
| Finance وHR/Payroll | DONE |
| Nawa AI | MISSING — توجد بنية مساعد قديمة، لكن لا توجد طبقة entitlement أو provider abstraction أو سياق أمني واستخدام مدقق وفق متطلبات RC. |
| Backup/Restore runbook | PARTIAL — تحتاج وثيقة تشغيل محدثة واختبار مناسب للبيئة. |
| Reliability وUI/Print RC audit | PARTIAL — يلزم تدقيق نهائي وتحسين آمن لحجم الحزمة. |
