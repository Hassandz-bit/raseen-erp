import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { addOrganizationExchangeRate, adjustProductBatchQuantity, approveInventoryCount, approveStockTransfer, createBusinessParty, createInventoryCount, createOperationalNotifications, createOperationalRecord, createOrganizationForUser, createProductBatch, createProductMaster, createPurchaseOrder, createSalesInvoice, createStockTransfer, createWarehouseForOrganization, dispatchStockTransfer, getCommerceReportSummary, getDashboardMetrics, getDefaultTenantContext, getFinancialReportSummary, getOrCreateOrganizationSettings, getOrCreateUserPreferences, issueSalesInvoiceWithFefo, issueStockByFefo, listInventoryCountsForOrganization, listNotificationsForOrganization, listOperationalRecords, listOrganizationCurrencies, listOrganizationExchangeRates, listProductBatchesForOrganization, listProductsForOrganization, listPurchaseOrdersForOrganization, listSalesInvoicesForOrganization, listStockMovementsForOrganization, listStockTransfersForOrganization, listWarehousesForOrganization, markNotificationRead, previewFefoAllocation, receivePurchaseOrder, receiveStockTransfer, recordSalesInvoicePayment, recordStockMovement, saveOrganizationCurrency, sendPurchaseOrder, startInventoryCount, submitInventoryCount, updateOrganizationSettings, updateProductBatchStatus, updateUserPreferences, type OperationalModule } from "./db";
import { createBranchForOrganization, listBranchesForOrganization, listOrganizationMembersForOrganization } from "./db";
import { currencyCatalog } from "../shared/currencyCatalog";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import { protectedProcedure, router } from "./_core/trpc";
import { buildOwnerAlertReasons, canAccessTenantModule, hasActiveMembership, isOrganizationOwner } from "./tenantPolicy";
import { hasValidExchangeRateDateRange, normalizeExchangeRateFilters } from "./exchangeRateFilters";
import { isValidTextBarcode } from "./barcodePolicy";
import { classifyBranchPersistenceError } from "./branchPolicy";

type ModuleKey = "inventory" | "sales" | "purchases" | "finance" | "hr" | "reports" | "ai_assistant";
const operationalModuleKeys = ["inventory", "sales", "purchases", "finance", "hr"] as const;

async function getTenantContext(userId: number) {
  const context = await getDefaultTenantContext(userId);
  if (!context || !hasActiveMembership(context.membership.status)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك عضوية نشطة في أي مؤسسة." });
  }
  return context;
}

export async function requireModule(userId: number, moduleKey: ModuleKey) {
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

export async function requireOrganizationOwner(userId: number) {
  const context = await getTenantContext(userId);
  if (!isOrganizationOwner(context.membership.roleKey)) {
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
        fontFamily: z.enum(["ibm-plex", "tajawal", "noto-arabic", "inter", "system"]).optional(),
        fontSize: z.enum(["small", "normal", "large"]).optional(),
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
    branches: protectedProcedure.query(async ({ ctx }) => {
      const context = await requireOrganizationOwner(ctx.user.id);
      return listBranchesForOrganization(context.organization.id);
    }),
    members: protectedProcedure.query(async ({ ctx }) => {
      const context = await requireOrganizationOwner(ctx.user.id);
      return listOrganizationMembersForOrganization(context.organization.id);
    }),
    createBranch: protectedProcedure.input(z.object({ code: z.string().trim().min(1).max(48), name: z.string().trim().min(2).max(160) })).mutation(async ({ ctx, input }) => {
      const context = await requireOrganizationOwner(ctx.user.id);
      try {
        return await createBranchForOrganization(context.organization.id, input);
      } catch (error) {
        if (classifyBranchPersistenceError(error) === "conflict") throw new TRPCError({ code: "CONFLICT", message: "BRANCH_CODE_CONFLICT" });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "BRANCH_SAVE_FAILED" });
      }
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
    createProduct: protectedProcedure.input(z.object({ sku: z.string().trim().min(1).max(96), name: z.string().trim().min(2).max(220), nameAr: z.string().trim().max(220).optional(), nameFr: z.string().trim().max(220).optional(), nameEn: z.string().trim().max(220).optional(), barcode: z.string().trim().max(96).refine(isValidTextBarcode, "صيغة الباركود النصي غير صالحة.").optional(), categoryId: z.number().int().positive().optional(), brandId: z.number().int().positive().optional(), productType: z.enum(["standard", "food", "expiring", "manufacturable"]), baseUnit: z.string().trim().min(1).max(32), purchaseUnit: z.string().trim().min(1).max(32), salesUnit: z.string().trim().min(1).max(32), unitsPerCarton: z.number().positive(), purchasePrice: z.number().nonnegative(), salePrice: z.number().nonnegative(), taxRate: z.number().min(0).max(100), minimumStock: z.number().nonnegative(), reorderPoint: z.number().nonnegative(), description: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
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
    updateBatchStatus: protectedProcedure.input(z.object({ batchId: z.number().int().positive(), status: z.enum(["active", "blocked", "quarantined"]) })).mutation(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "inventory");
      return updateProductBatchStatus(context.organization.id, ctx.user.id, input.batchId, input.status);
    }),
    adjustBatchQuantity: protectedProcedure.input(z.object({ batchId: z.number().int().positive(), quantity: z.number().finite().refine(value => value !== 0, "كمية التسوية لا يمكن أن تكون صفراً."), reason: z.string().trim().max(300).optional() })).mutation(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "inventory");
      return adjustProductBatchQuantity(context.organization.id, ctx.user.id, input.batchId, input.quantity, input.reason);
    }),
    listTransfers: protectedProcedure.query(async ({ ctx }) => {
      const context = await requireModule(ctx.user.id, "inventory");
      return listStockTransfersForOrganization(context.organization.id);
    }),
    createTransfer: protectedProcedure.input(z.object({ transferNumber: z.string().trim().min(1).max(64).optional(), sourceWarehouseId: z.number().int().positive(), destinationWarehouseId: z.number().int().positive(), notes: z.string().trim().max(2000).optional(), lines: z.array(z.object({ productId: z.number().int().positive(), batchId: z.number().int().positive(), quantity: z.number().positive() })).min(1) })).mutation(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "inventory");
      return createStockTransfer(context.organization.id, ctx.user.id, input);
    }),
    approveTransfer: protectedProcedure.input(z.object({ transferId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "inventory");
      return approveStockTransfer(context.organization.id, ctx.user.id, input.transferId);
    }),
    dispatchTransfer: protectedProcedure.input(z.object({ transferId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "inventory");
      return dispatchStockTransfer(context.organization.id, ctx.user.id, input.transferId);
    }),
    receiveTransfer: protectedProcedure.input(z.object({ transferId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "inventory");
      return receiveStockTransfer(context.organization.id, ctx.user.id, input.transferId);
    }),
    listCounts: protectedProcedure.query(async ({ ctx }) => {
      const context = await requireModule(ctx.user.id, "inventory");
      return listInventoryCountsForOrganization(context.organization.id);
    }),
    createCount: protectedProcedure.input(z.object({ countNumber: z.string().trim().min(1).max(64).optional(), warehouseId: z.number().int().positive(), scope: z.enum(["full", "partial", "category", "product", "location"]).optional(), movementMode: z.enum(["freeze", "reconcile"]).optional() })).mutation(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "inventory");
      return createInventoryCount(context.organization.id, ctx.user.id, input);
    }),
    startCount: protectedProcedure.input(z.object({ countId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "inventory");
      return startInventoryCount(context.organization.id, ctx.user.id, input.countId);
    }),
    submitCount: protectedProcedure.input(z.object({ countId: z.number().int().positive(), items: z.array(z.object({ productId: z.number().int().positive(), batchId: z.number().int().positive(), actualQuantity: z.number().nonnegative() })).min(1) })).mutation(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "inventory");
      return submitInventoryCount(context.organization.id, ctx.user.id, input.countId, input.items);
    }),
    approveCount: protectedProcedure.input(z.object({ countId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "inventory");
      return approveInventoryCount(context.organization.id, ctx.user.id, input.countId);
    }),
    listWarehouses: protectedProcedure.query(async ({ ctx }) => {
      const context = await requireModule(ctx.user.id, "inventory");
      return listWarehousesForOrganization(context.organization.id);
    }),
    createWarehouse: protectedProcedure.input(z.object({ code: z.string().trim().min(1).max(48), name: z.string().trim().min(2).max(160), isMobile: z.enum(["yes", "no"]).optional() })).mutation(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "inventory");
      return createWarehouseForOrganization(context.organization.id, input);
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

  parties: router({
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(220), types: z.array(z.enum(["customer", "supplier"])).min(1), code: z.string().trim().max(64).optional(), contactName: z.string().trim().max(160).optional(), phone: z.string().trim().max(32).optional(), email: z.string().trim().email().max(320).optional(), paymentTermsDays: z.number().int().min(0).max(365).optional(), creditLimit: z.number().nonnegative().optional(), preferredCurrencyCode: z.string().length(3).optional(), customerSegment: z.string().trim().max(96).optional() })).mutation(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "sales");
      return createBusinessParty(context.organization.id, input);
    }),
  }),

  sales: router({
    listInvoices: protectedProcedure.query(async ({ ctx }) => {
      const context = await requireModule(ctx.user.id, "sales");
      return listSalesInvoicesForOrganization(context.organization.id);
    }),
    createInvoice: protectedProcedure.input(z.object({
      invoiceNumber: z.string().trim().min(1).max(64).optional(),
      customerId: z.number().int().positive().optional(),
      currencyCode: z.string().trim().length(3),
      baseCurrencyCode: z.string().trim().length(3),
      exchangeRateUsed: z.number().positive().max(1_000_000_000).optional(),
      dueDate: z.coerce.date().optional(),
      discountAmount: z.number().nonnegative().max(999_999_999).optional(),
      lines: z.array(z.object({ productId: z.number().int().positive(), warehouseId: z.number().int().positive(), quantity: z.number().positive(), unit: z.string().trim().min(1).max(32).optional(), unitPrice: z.number().nonnegative().max(999_999_999).optional(), taxRate: z.number().min(0).max(100).optional() })).min(1),
    })).mutation(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "sales");
      await requireModule(ctx.user.id, "inventory");
      return createSalesInvoice(context.organization.id, ctx.user.id, input);
    }),
    issueInvoice: protectedProcedure.input(z.object({ invoiceId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "sales");
      await requireModule(ctx.user.id, "inventory");
      return issueSalesInvoiceWithFefo(context.organization.id, ctx.user.id, input.invoiceId);
    }),
    recordPayment: protectedProcedure.input(z.object({ invoiceId: z.number().int().positive(), amount: z.number().positive().max(999_999_999).optional() })).mutation(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "sales");
      return recordSalesInvoicePayment(context.organization.id, ctx.user.id, input.invoiceId, input.amount);
    }),
  }),

  purchases: router({
    listOrders: protectedProcedure.query(async ({ ctx }) => {
      const context = await requireModule(ctx.user.id, "purchases");
      return listPurchaseOrdersForOrganization(context.organization.id);
    }),
    createOrder: protectedProcedure.input(z.object({
      orderNumber: z.string().trim().min(1).max(64).optional(),
      supplierId: z.number().int().positive().optional(),
      currencyCode: z.string().trim().length(3),
      baseCurrencyCode: z.string().trim().length(3),
      exchangeRateUsed: z.number().positive().max(1_000_000_000).optional(),
      expectedAt: z.coerce.date().optional(),
      lines: z.array(z.object({ productId: z.number().int().positive(), warehouseId: z.number().int().positive(), quantity: z.number().positive(), unit: z.string().trim().min(1).max(32).optional(), unitCost: z.number().nonnegative().max(999_999_999) })).min(1),
    })).mutation(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "purchases");
      await requireModule(ctx.user.id, "inventory");
      return createPurchaseOrder(context.organization.id, ctx.user.id, input);
    }),
    sendOrder: protectedProcedure.input(z.object({ purchaseOrderId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "purchases");
      return sendPurchaseOrder(context.organization.id, ctx.user.id, input.purchaseOrderId);
    }),
    receiveOrder: protectedProcedure.input(z.object({
      purchaseOrderId: z.number().int().positive(),
      receipts: z.array(z.object({ purchaseOrderItemId: z.number().int().positive(), quantity: z.number().positive(), lotNumber: z.string().trim().min(1).max(96), cost: z.number().nonnegative().max(999_999_999).optional(), manufacturingDate: z.coerce.date().optional(), expiryDate: z.coerce.date().optional() })).min(1),
    })).mutation(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "purchases");
      await requireModule(ctx.user.id, "inventory");
      return receivePurchaseOrder(context.organization.id, ctx.user.id, input.purchaseOrderId, input.receipts);
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
    commerceSummary: protectedProcedure.query(async ({ ctx }) => {
      const context = await requireModule(ctx.user.id, "reports");
      await requireModule(ctx.user.id, "inventory");
      return getCommerceReportSummary(context.organization.id);
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
