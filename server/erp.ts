import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { addOrganizationExchangeRate, createOperationalNotifications, createOperationalRecord, createOrganizationForUser, createProductBatch, createProductMaster, getDashboardMetrics, getDefaultTenantContext, getFinancialReportSummary, getOrCreateOrganizationSettings, getOrCreateUserPreferences, issueStockByFefo, listNotificationsForOrganization, listOperationalRecords, listOrganizationCurrencies, listOrganizationExchangeRates, listProductBatchesForOrganization, listProductsForOrganization, listStockMovementsForOrganization, markNotificationRead, previewFefoAllocation, recordStockMovement, saveOrganizationCurrency, updateOrganizationSettings, updateUserPreferences, type OperationalModule } from "./db";
import { currencyCatalog } from "../shared/currencyCatalog";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import { protectedProcedure, router } from "./_core/trpc";
import { buildOwnerAlertReasons, canAccessTenantModule, hasActiveMembership } from "./tenantPolicy";
import { hasValidExchangeRateDateRange, normalizeExchangeRateFilters } from "./exchangeRateFilters";

type ModuleKey = "inventory" | "sales" | "purchases" | "finance" | "hr" | "reports" | "ai_assistant";
const operationalModuleKeys = ["inventory", "sales", "purchases", "finance", "hr"] as const;

async function getTenantContext(userId: number) {
  const context = await getDefaultTenantContext(userId);
  if (!context || !hasActiveMembership(context.membership.status)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك عضوية نشطة في أي مؤسسة." });
  }
  return context;
}

async function requireModule(userId: number, moduleKey: ModuleKey) {
  const context = await getTenantContext(userId);
  const module = context.modules.find(item => item.moduleKey === moduleKey);
  if (!canAccessTenantModule({ membershipStatus: context.membership.status, moduleStatus: module?.status })) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "هذه الوحدة غير مفعلة ضمن اشتراك مؤسستك.",
    });
  }
  return context;
}

async function requireOrganizationOwner(userId: number) {
  const context = await getTenantContext(userId);
  if (context.membership.roleKey !== "owner") {
    throw new TRPCError({ code: "FORBIDDEN", message: "يلزم دور مالك المؤسسة لتعديل هذه الإعدادات." });
  }
  return context;
}

function readReply(response: Awaited<ReturnType<typeof invokeLLM>>) {
  const content = response.choices[0]?.message.content;
  return typeof content === "string" && content.trim()
    ? content.trim()
    : "لم أتمكن من صياغة إجابة الآن. يرجى إعادة المحاولة.";
}

export const erpRouter = router({
  onboarding: router({
    createOrganization: protectedProcedure
      .input(z.object({ name: z.string().trim().min(2, "اكتب اسم المؤسسة.").max(180) }))
      .mutation(async ({ ctx, input }) => {
        const existing = await getDefaultTenantContext(ctx.user.id);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "لديك مؤسسة مفعلة بالفعل." });
        return createOrganizationForUser({ userId: ctx.user.id, name: input.name });
      }),
  }),
  bootstrap: protectedProcedure.query(async ({ ctx }) => {
    const context = await getTenantContext(ctx.user.id);
    return {
      organization: context.organization,
      membership: context.membership,
      modules: context.modules.map(module => ({
        key: module.moduleKey,
        status: module.status,
        effectiveUntil: module.effectiveUntil,
      })),
    };
  }),

  preferences: router({
    user: protectedProcedure.query(({ ctx }) => getOrCreateUserPreferences(ctx.user.id)),
    saveUser: protectedProcedure.input(z.object({
      language: z.enum(["ar", "fr", "en"]).optional(),
      themeMode: z.enum(["light", "dark", "system"]).optional(),
      sidebarMode: z.enum(["expanded", "compact", "collapsed"]).optional(),
      density: z.enum(["comfortable", "compact"]).optional(),
      fontFamily: z.enum(["ibm-plex", "tajawal", "noto-arabic", "inter", "system"]).optional(),
      fontScale: z.enum(["small", "normal", "large", "extra_large"]).optional(),
      numeralStyle: z.enum(["western", "arabic_indic"]).optional(),
      accentColor: z.enum(["gold", "blue", "emerald", "violet"]).optional(),
      radiusPreset: z.enum(["soft", "rounded", "sharp"]).optional(),
      moduleViewMode: z.enum(["classic", "nawa_flow"]).optional(),
    })).mutation(({ ctx, input }) => updateUserPreferences(ctx.user.id, input)),
    organization: protectedProcedure.query(async ({ ctx }) => {
      const context = await getTenantContext(ctx.user.id);
      return getOrCreateOrganizationSettings(context.organization.id);
    }),
    saveOrganization: protectedProcedure.input(z.object({
      currencyCode: z.enum(["DZD", "EUR", "USD", "SAR"]).optional(),
      currencySymbolPosition: z.enum(["before", "after"]).optional(),
      decimalPlaces: z.number().int().min(0).max(4).optional(),
      dateFormat: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional(),
      timeFormat: z.enum(["12h", "24h"]).optional(),
      timeZone: z.string().min(1).max(64).optional(),
      firstDayOfWeek: z.enum(["monday", "sunday", "saturday"]).optional(),
      decimalSeparator: z.enum(["dot", "comma"]).optional(),
      thousandsSeparator: z.enum(["comma", "dot", "space"]).optional(),
      documentSettings: z.object({
        paperSize: z.enum(["A4", "A5", "thermal"]),
        logoUrl: z.string().url().optional(),
        address: z.string().max(300).optional(),
        phone: z.string().max(64).optional(),
        legalInfo: z.string().max(500).optional(),
        headerText: z.string().max(180).optional(),
        footerText: z.string().max(300).optional(),
        showSignature: z.boolean().optional(),
      }).optional(),
    })).mutation(async ({ ctx, input }) => {
      const context = await requireOrganizationOwner(ctx.user.id);
      return updateOrganizationSettings(context.organization.id, input);
    }),
    currencyCatalog: protectedProcedure.query(() => currencyCatalog),
    currencies: protectedProcedure.query(async ({ ctx }) => {
      const context = await getTenantContext(ctx.user.id);
      return listOrganizationCurrencies(context.organization.id);
    }),
    saveCurrency: protectedProcedure.input(z.object({
      currencyCode: z.string().length(3),
      symbol: z.string().min(1).max(16),
      decimalPlaces: z.number().int().min(0).max(4),
      displayStyle: z.enum(["symbol", "code", "symbol_and_code"]),
      status: z.enum(["active", "inactive"]),
      isBase: z.enum(["yes", "no"]).optional(),
    })).mutation(async ({ ctx, input }) => {
      const context = await requireOrganizationOwner(ctx.user.id);
      return saveOrganizationCurrency(context.organization.id, input);
    }),
    exchangeRates: protectedProcedure.input(z.object({ currencyCode: z.string().length(3).optional(), startDate: z.coerce.date().optional(), endDate: z.coerce.date().optional() }).optional()).query(async ({ ctx, input }) => {
      const context = await getTenantContext(ctx.user.id);
      const filters = normalizeExchangeRateFilters(input);
      if (!hasValidExchangeRateDateRange(filters)) throw new TRPCError({ code: "BAD_REQUEST", message: "يجب أن يسبق تاريخ البداية تاريخ النهاية." });
      return listOrganizationExchangeRates(context.organization.id, filters);
    }),
    addExchangeRate: protectedProcedure.input(z.object({
      baseCurrencyCode: z.string().length(3),
      quoteCurrencyCode: z.string().length(3),
      rate: z.number().positive().max(1_000_000_000),
      effectiveAt: z.coerce.date(),
      source: z.string().trim().max(64).optional(),
    })).mutation(async ({ ctx, input }) => {
      const context = await requireOrganizationOwner(ctx.user.id);
      return addOrganizationExchangeRate(context.organization.id, ctx.user.id, input);
    }),
  }),

  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const context = await getTenantContext(ctx.user.id);
    return getDashboardMetrics(context.organization.id);
  }),

  inventory: router({
    listProducts: protectedProcedure.query(async ({ ctx }) => {
      const context = await requireModule(ctx.user.id, "inventory");
      return listProductsForOrganization(context.organization.id);
    }),
    createProduct: protectedProcedure.input(z.object({ sku: z.string().trim().min(1).max(96), name: z.string().trim().min(2).max(220), nameAr: z.string().trim().max(220).optional(), nameFr: z.string().trim().max(220).optional(), nameEn: z.string().trim().max(220).optional(), barcode: z.string().trim().max(96).optional(), categoryId: z.number().int().positive().optional(), brandId: z.number().int().positive().optional(), productType: z.enum(["standard", "food", "expiring", "manufacturable"]), baseUnit: z.string().trim().min(1).max(32), purchaseUnit: z.string().trim().min(1).max(32), salesUnit: z.string().trim().min(1).max(32), unitsPerCarton: z.number().positive(), purchasePrice: z.number().nonnegative(), salePrice: z.number().nonnegative(), taxRate: z.number().min(0).max(100), minimumStock: z.number().nonnegative(), reorderPoint: z.number().nonnegative(), description: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "inventory");
      return createProductMaster(context.organization.id, input);
    }),
    recordMovement: protectedProcedure.input(z.object({
      warehouseId: z.number().int().positive(),
      productId: z.number().int().positive(),
      batchId: z.number().int().positive().optional(),
      movementType: z.enum(["purchase_receipt", "sales_issue", "sales_return", "supplier_return", "transfer_out", "transfer_in", "adjustment", "opening_balance", "count_adjustment"]),
      quantity: z.number().finite().refine(value => value !== 0, "الكمية لا يمكن أن تكون صفراً."),
      unit: z.string().trim().min(1).max(32),
      sourceDocumentType: z.string().trim().max(64).optional(),
      sourceDocumentId: z.number().int().positive().optional(),
    })).mutation(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "inventory");
      return recordStockMovement({ organizationId: context.organization.id, actorUserId: ctx.user.id, ...input });
    }),
    previewFefo: protectedProcedure.input(z.object({ warehouseId: z.number().int().positive(), productId: z.number().int().positive(), quantity: z.number().positive() })).query(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "inventory");
      return previewFefoAllocation(context.organization.id, input.warehouseId, input.productId, input.quantity);
    }),
    listBatches: protectedProcedure.input(z.object({ productId: z.number().int().positive().optional(), warehouseId: z.number().int().positive().optional(), status: z.enum(["active", "blocked", "quarantined", "expired"]).optional() }).optional()).query(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "inventory");
      return listProductBatchesForOrganization(context.organization.id, input);
    }),
    createBatch: protectedProcedure.input(z.object({ productId: z.number().int().positive(), warehouseId: z.number().int().positive(), lotNumber: z.string().trim().min(1).max(96), receivedQuantity: z.number().positive(), cost: z.number().nonnegative(), sourcePartyId: z.number().int().positive().optional(), manufacturingDate: z.coerce.date().optional(), expiryDate: z.coerce.date().optional() })).mutation(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "inventory");
      return createProductBatch(context.organization.id, input);
    }),
    listMovements: protectedProcedure.input(z.object({ productId: z.number().int().positive().optional(), warehouseId: z.number().int().positive().optional(), movementType: z.enum(["purchase_receipt", "sales_issue", "sales_return", "supplier_return", "transfer_out", "transfer_in", "adjustment", "opening_balance", "count_adjustment"]).optional() }).optional()).query(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "inventory");
      return listStockMovementsForOrganization(context.organization.id, input);
    }),
    issueFefo: protectedProcedure.input(z.object({ warehouseId: z.number().int().positive(), productId: z.number().int().positive(), quantity: z.number().positive(), unit: z.string().trim().min(1).max(32), sourceDocumentType: z.string().trim().max(64).optional(), sourceDocumentId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "inventory");
      return issueStockByFefo({ organizationId: context.organization.id, actorUserId: ctx.user.id, ...input });
    }),
  }),

  operations: router({
    list: protectedProcedure.input(z.object({ module: z.enum(operationalModuleKeys) })).query(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, input.module);
      return listOperationalRecords(context.organization.id, input.module as OperationalModule);
    }),
    create: protectedProcedure
      .input(z.object({
        module: z.enum(operationalModuleKeys),
        title: z.string().trim().min(2).max(220),
        reference: z.string().trim().max(96).optional(),
        amount: z.number().nonnegative().max(999999999).optional(),
        category: z.string().trim().max(120).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const context = await requireModule(ctx.user.id, input.module);
        return createOperationalRecord({ ...input, organizationId: context.organization.id, module: input.module as OperationalModule });
      }),
  }),

  reports: router({
    summary: protectedProcedure.query(async ({ ctx }) => {
      const context = await requireModule(ctx.user.id, "reports");
      return getFinancialReportSummary(context.organization.id);
    }),
  }),

  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const context = await getTenantContext(ctx.user.id);
      return listNotificationsForOrganization(context.organization.id);
    }),
    markRead: protectedProcedure.input(z.object({ notificationId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const context = await getTenantContext(ctx.user.id);
      await markNotificationRead(context.organization.id, input.notificationId);
      return { success: true } as const;
    }),
  }),

  ai: router({
    ask: protectedProcedure
      .input(z.object({ prompt: z.string().trim().min(3).max(1200) }))
      .mutation(async ({ ctx, input }) => {
        const context = await requireModule(ctx.user.id, "ai_assistant");
        const metrics = await getDashboardMetrics(context.organization.id);
        const model = "gpt-5-mini";
        const response = await invokeLLM({
          model,
          maxTokens: 700,
          messages: [
            {
              role: "system",
              content:
                "أنت مساعد Nawa ERP. أجب بالعربية بوضوح وباختصار. استخدم فقط ملخص المؤسسة المقدم لك. لا تخترع أرقاماً أو سجلات، ولا تطلب أو تكشف بيانات مؤسسة أخرى. قدّم توصية عملية عند وجود إشارة تشغيلية واضحة.",
            },
            {
              role: "user",
              content: `سؤال المستخدم: ${input.prompt}\n\nسياق المؤسسة المصرح به: ${JSON.stringify({
                name: context.organization.name,
                currency: context.organization.baseCurrency,
                metrics,
              })}`,
            },
          ],
        });
        return { reply: readReply(response), model };
      }),
  }),

  alerts: router({
    evaluate: protectedProcedure.mutation(async ({ ctx }) => {
      const context = await getTenantContext(ctx.user.id);
      const metrics = await getDashboardMetrics(context.organization.id);
      const reasons = buildOwnerAlertReasons(metrics);
      await createOperationalNotifications(context.organization.id, reasons);

      const notified = reasons.length
        ? await notifyOwner({
            title: `تنبيه تشغيلي: ${context.organization.name}`,
            content: reasons.join(" "),
          })
        : false;

      return { reasons, notified };
    }),
  }),
});
