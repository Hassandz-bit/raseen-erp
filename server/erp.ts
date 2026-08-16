import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { addOrganizationExchangeRate, adjustProductBatchQuantity, approveInventoryCount, approveStockTransfer, createBusinessParty, createInventoryCount, createOperationalNotifications, createOperationalRecord, createOrganizationForUser, createProductBatch, createProductMaster, createPurchaseOrder, createSalesInvoice, createStockTransfer, createWarehouseForOrganization, dispatchStockTransfer, getCommerceReportSummary, getDashboardMetrics, getDefaultTenantContext, getFinancialReportSummary, getOrCreateOrganizationSettings, getOrCreateUserPreferences, getOrganizationRolePermissions, issueSalesInvoiceWithFefo, issueStockByFefo, listInventoryCountsForOrganization, listNotificationsForOrganization, listOperationalRecords, listOrganizationCurrencies, listOrganizationExchangeRates, listProductBatchesForOrganization, listProductsForOrganization, listPurchaseOrdersForOrganization, listSalesInvoicesForOrganization, listStockMovementsForOrganization, listStockTransfersForOrganization, listWarehousesForOrganization, markNotificationRead, previewFefoAllocation, receivePurchaseOrder, receiveStockTransfer, recordSalesInvoicePayment, recordStockMovement, saveOrganizationCurrency, sendPurchaseOrder, startInventoryCount, submitInventoryCount, updateOrganizationSettings, updateProductBatchStatus, updateUserPreferences, type OperationalModule } from "./db";
import { createBranchForOrganization, listBranchesForOrganization, listOrganizationMembersForOrganization } from "./db";
import { currencyCatalog } from "../shared/currencyCatalog";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import { protectedProcedure, router } from "./_core/trpc";
import { buildOwnerAlertReasons, canAccessTenantModule, hasActiveMembership, isOrganizationOwner } from "./tenantPolicy";
import { hasValidExchangeRateDateRange, normalizeExchangeRateFilters } from "./exchangeRateFilters";
import { isValidTextBarcode } from "./barcodePolicy";
import { classifyBranchPersistenceError } from "./branchPolicy";
import { canUseDistributionPermission, isScopedIdAllowed, type DistributionPermission } from "./distributionPolicy";
import { addDistributionRouteExpense, completeDriverStop, createDistributionRoute, createDistributionTerritory, createFleetVehicle, createMaintenanceRecord, createVehicleDocument, createVehicleLoadOrder, getDistributionControlCenter, getDistributionOwnerAlertReasons, getDistributionSettings, getDriverRouteFeed, getDriverRouteInventory, getLatestFleetLocations, listDistributionRoutes, listDistributionTerritories, listFleetVehicles, listVehicleInventory, logFuel, recordDistributionCollection, recordDistributionDelivery, recordDistributionReturn, recordFleetGpsPoint, recordGeofenceEvent, returnVehicleStockToWarehouse, saveDistributionSettings, submitDistributionDeliveryProof, submitRouteClosing, transitionDistributionRoute, transitionRouteClosing, transitionVehicleLoadOrder } from "./distribution";

type ModuleKey = "inventory" | "sales" | "purchases" | "finance" | "hr" | "reports" | "ai_assistant" | "distribution";
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

export async function requireDistributionPermission(userId: number, permission: DistributionPermission) {
  const context = await requireModule(userId, "distribution");
  const permissions = await getOrganizationRolePermissions(context.organization.id, context.membership.roleKey);
  if (!canUseDistributionPermission(context.membership.roleKey, permissions, permission)) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية التوزيع أو الأسطول المطلوبة." });
  return context;
}

function assertDistributionScope(context: Awaited<ReturnType<typeof getTenantContext>>, input: { branchId?: number; territoryId?: number; vehicleId?: number; routeId?: number }) {
  const scope = context.membership.dataScope;
  if (!isScopedIdAllowed(scope, "branchIds", input.branchId) || !isScopedIdAllowed(scope, "territoryIds", input.territoryId) || !isScopedIdAllowed(scope, "vehicleIds", input.vehicleId) || !isScopedIdAllowed(scope, "assignedRouteIds", input.routeId)) throw new TRPCError({ code: "FORBIDDEN", message: "العنصر المطلوب خارج نطاق الفرع أو المنطقة أو المركبة المسموح لعضويتك." });
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

  distribution: router({
    controlCenter: protectedProcedure.query(async ({ ctx }) => {
      const context = await requireDistributionPermission(ctx.user.id, "distribution.view");
      return getDistributionControlCenter(context.organization.id);
    }),
    settings: router({
      get: protectedProcedure.query(async ({ ctx }) => {
        const context = await requireDistributionPermission(ctx.user.id, "distribution.view");
        return getDistributionSettings(context.organization.id);
      }),
      save: protectedProcedure.input(z.object({ overloadPolicy: z.enum(["warning", "hard_block", "manager_override"]).optional(), visitRadiusMeters: z.number().int().min(10).max(5000).optional() })).mutation(async ({ ctx, input }) => {
        const context = await requireDistributionPermission(ctx.user.id, "distribution.editRoute");
        return saveDistributionSettings(context.organization.id, input);
      }),
    }),
    vehicles: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        const context = await requireDistributionPermission(ctx.user.id, "fleet.view");
        return listFleetVehicles(context.organization.id);
      }),
      inventory: protectedProcedure.input(z.object({ vehicleId: z.number().int().positive() })).query(async ({ ctx, input }) => {
        const context = await requireDistributionPermission(ctx.user.id, "distribution.view");
        assertDistributionScope(context, { vehicleId: input.vehicleId });
        return listVehicleInventory(context.organization.id, input.vehicleId);
      }),
      create: protectedProcedure.input(z.object({ code: z.string().trim().min(2).max(48), registrationNumber: z.string().trim().min(2).max(96), type: z.string().trim().min(2).max(80), brand: z.string().trim().max(80).optional(), model: z.string().trim().max(80).optional(), modelYear: z.number().int().min(1900).max(2100).optional(), branchId: z.number().int().positive().optional(), ownerPartyId: z.number().int().positive().optional(), ownershipType: z.enum(["owned", "leased", "external"]), driverEmployeeId: z.number().int().positive().optional(), representativeEmployeeId: z.number().int().positive().optional(), maximumPayloadWeight: z.number().nonnegative(), maximumVolume: z.number().nonnegative(), palletCapacity: z.number().int().nonnegative().optional() })).mutation(async ({ ctx, input }) => {
        const context = await requireDistributionPermission(ctx.user.id, "fleet.editVehicle");
        assertDistributionScope(context, { branchId: input.branchId });
        return createFleetVehicle(context.organization.id, ctx.user.id, input);
      }),
      document: protectedProcedure.input(z.object({ vehicleId: z.number().int().positive(), documentType: z.enum(["insurance", "technical_inspection", "registration", "other"]), referenceNumber: z.string().trim().max(96).optional(), expiresAt: z.coerce.date().optional(), attachmentUrl: z.string().url().max(1024).optional() })).mutation(async ({ ctx, input }) => {
        const context = await requireDistributionPermission(ctx.user.id, "fleet.documents");
        return createVehicleDocument(context.organization.id, ctx.user.id, input);
      }),
      fuel: protectedProcedure.input(z.object({ vehicleId: z.number().int().positive(), routeId: z.number().int().positive().optional(), driverEmployeeId: z.number().int().positive().optional(), odometer: z.number().nonnegative(), fuelQuantity: z.number().positive(), fuelType: z.string().trim().min(2).max(48), unitPrice: z.number().nonnegative(), currencyCode: z.string().trim().length(3), vendor: z.string().trim().max(180).optional(), attachmentUrl: z.string().url().max(1024).optional(), occurredAt: z.coerce.date().optional() })).mutation(async ({ ctx, input }) => {
        const context = await requireDistributionPermission(ctx.user.id, "fleet.fuel");
        return logFuel(context.organization.id, ctx.user.id, input);
      }),
      maintenance: protectedProcedure.input(z.object({ vehicleId: z.number().int().positive(), maintenanceType: z.enum(["preventive", "corrective", "oil", "tires", "technical_inspection", "other"]), occurredAt: z.coerce.date(), currencyCode: z.string().trim().length(3), status: z.enum(["planned", "in_progress", "completed", "cancelled"]).optional(), odometer: z.number().nonnegative().optional(), cost: z.number().nonnegative().optional(), supplierPartyId: z.number().int().positive().optional(), description: z.string().trim().max(2000).optional(), nextDueAt: z.coerce.date().optional(), nextDueOdometer: z.number().nonnegative().optional(), attachmentUrl: z.string().url().max(1024).optional() })).mutation(async ({ ctx, input }) => {
        const context = await requireDistributionPermission(ctx.user.id, "fleet.maintenance");
        return createMaintenanceRecord(context.organization.id, ctx.user.id, input);
      }),
    }),
    territories: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        const context = await requireDistributionPermission(ctx.user.id, "distribution.view");
        return listDistributionTerritories(context.organization.id);
      }),
      create: protectedProcedure.input(z.object({ code: z.string().trim().min(2).max(48), name: z.string().trim().min(2).max(160), branchId: z.number().int().positive().optional(), representativeEmployeeId: z.number().int().positive().optional(), defaultVehicleId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
        const context = await requireDistributionPermission(ctx.user.id, "distribution.editRoute");
        assertDistributionScope(context, { branchId: input.branchId, vehicleId: input.defaultVehicleId });
        return createDistributionTerritory(context.organization.id, ctx.user.id, input);
      }),
    }),
    routes: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        const context = await requireDistributionPermission(ctx.user.id, "distribution.view");
        return listDistributionRoutes(context.organization.id);
      }),
      create: protectedProcedure.input(z.object({ routeNumber: z.string().trim().max(64).optional(), routeDate: z.coerce.date(), branchId: z.number().int().positive().optional(), territoryId: z.number().int().positive().optional(), vehicleId: z.number().int().positive().optional(), driverEmployeeId: z.number().int().positive().optional(), representativeEmployeeId: z.number().int().positive().optional(), plannedStartAt: z.coerce.date().optional(), plannedEndAt: z.coerce.date().optional(), stops: z.array(z.object({ customerId: z.number().int().positive(), salesInvoiceId: z.number().int().positive().optional(), salesOrderReference: z.string().trim().max(96).optional(), plannedAt: z.coerce.date().optional(), notes: z.string().trim().max(1000).optional() })).max(100) })).mutation(async ({ ctx, input }) => {
        const context = await requireDistributionPermission(ctx.user.id, "distribution.createRoute");
        assertDistributionScope(context, input);
        return createDistributionRoute(context.organization.id, ctx.user.id, input);
      }),
      transition: protectedProcedure.input(z.object({ routeId: z.number().int().positive(), status: z.enum(["prepared", "loaded", "started", "in_progress", "returning", "closing", "closed", "cancelled"]) })).mutation(async ({ ctx, input }) => {
        const context = await requireDistributionPermission(ctx.user.id, input.status === "closed" ? "distribution.closeRoute" : "distribution.editRoute");
        assertDistributionScope(context, { routeId: input.routeId });
        return transitionDistributionRoute(context.organization.id, ctx.user.id, input.routeId, input.status);
      }),
    }),
    driver: router({
      myRoutes: protectedProcedure.query(async ({ ctx }) => {
        const context = await requireDistributionPermission(ctx.user.id, "distribution.deliver");
        return getDriverRouteFeed(context.organization.id, context.membership.dataScope?.assignedRouteIds ?? []);
      }),
      inventory: protectedProcedure.input(z.object({ routeId: z.number().int().positive() })).query(async ({ ctx, input }) => {
        const context = await requireDistributionPermission(ctx.user.id, "distribution.deliver");
        assertDistributionScope(context, { routeId: input.routeId });
        if (!context.membership.dataScope?.assignedRouteIds?.includes(input.routeId)) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك عرض مخزون جولة غير مسندة إليك." });
        return getDriverRouteInventory(context.organization.id, input.routeId);
      }),
      transition: protectedProcedure.input(z.object({ routeId: z.number().int().positive(), status: z.enum(["in_progress", "returning"]) })).mutation(async ({ ctx, input }) => {
        const context = await requireDistributionPermission(ctx.user.id, "distribution.deliver");
        assertDistributionScope(context, { routeId: input.routeId });
        if (!context.membership.dataScope?.assignedRouteIds?.includes(input.routeId)) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك تغيير حالة جولة غير مسندة إليك." });
        return transitionDistributionRoute(context.organization.id, ctx.user.id, input.routeId, input.status);
      }),
      submitProof: protectedProcedure.input(z.object({ routeId: z.number().int().positive(), stopId: z.number().int().positive(), customerId: z.number().int().positive(), deliveryId: z.number().int().positive().optional(), signerName: z.string().trim().min(2).max(180), signedAt: z.coerce.date(), signatureDataUrl: z.string().min(64).max(8_000_000), photoDataUrl: z.string().min(64).max(8_000_000).optional() })).mutation(async ({ ctx, input }) => {
        const context = await requireDistributionPermission(ctx.user.id, "distribution.deliver");
        assertDistributionScope(context, { routeId: input.routeId });
        if (!context.membership.dataScope?.assignedRouteIds?.includes(input.routeId)) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك إضافة إثبات لتسليم خارج جولتك المسندة." });
        return submitDistributionDeliveryProof(context.organization.id, ctx.user.id, input);
      }),
      completeStop: protectedProcedure.input(z.object({ routeId: z.number().int().positive(), stopId: z.number().int().positive(), status: z.enum(["skipped", "failed"]), reason: z.string().trim().min(3).max(1000) })).mutation(async ({ ctx, input }) => {
        const context = await requireDistributionPermission(ctx.user.id, "distribution.deliver");
        assertDistributionScope(context, { routeId: input.routeId });
        if (!context.membership.dataScope?.assignedRouteIds?.includes(input.routeId)) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك إكمال محطة خارج جولتك المسندة." });
        return completeDriverStop(context.organization.id, ctx.user.id, input);
      }),
    }),
    loads: router({
      previewFefo: protectedProcedure.input(z.object({ sourceWarehouseId: z.number().int().positive(), productId: z.number().int().positive(), quantity: z.number().positive() })).query(async ({ ctx, input }) => {
        const context = await requireDistributionPermission(ctx.user.id, "distribution.createLoad");
        return previewFefoAllocation(context.organization.id, input.sourceWarehouseId, input.productId, input.quantity);
      }),
      create: protectedProcedure.input(z.object({ loadNumber: z.string().trim().max(64).optional(), sourceWarehouseId: z.number().int().positive(), vehicleId: z.number().int().positive(), routeId: z.number().int().positive().optional(), overrideReason: z.string().trim().max(1000).optional(), lines: z.array(z.object({ productId: z.number().int().positive(), batchId: z.number().int().positive(), quantity: z.number().positive(), unit: z.string().trim().min(1).max(32) })).min(1).max(200) })).mutation(async ({ ctx, input }) => {
        const context = await requireDistributionPermission(ctx.user.id, "distribution.createLoad");
        assertDistributionScope(context, { vehicleId: input.vehicleId, routeId: input.routeId });
        return createVehicleLoadOrder(context.organization.id, ctx.user.id, input);
      }),
      transition: protectedProcedure.input(z.object({ loadOrderId: z.number().int().positive(), status: z.enum(["prepared", "approved", "loading", "loaded", "dispatched", "closed", "cancelled"]) })).mutation(async ({ ctx, input }) => {
        const permission = input.status === "approved" ? "distribution.approveLoad" : "distribution.createLoad" as const;
        const context = await requireDistributionPermission(ctx.user.id, permission);
        return transitionVehicleLoadOrder(context.organization.id, ctx.user.id, input.loadOrderId, input.status);
      }),
    }),
    deliveries: router({
      record: protectedProcedure.input(z.object({ routeId: z.number().int().positive(), stopId: z.number().int().positive().optional(), customerId: z.number().int().positive(), salesInvoiceId: z.number().int().positive().optional(), idempotencyKey: z.string().trim().min(8).max(128), notes: z.string().trim().max(2000).optional(), items: z.array(z.object({ productId: z.number().int().positive(), vehicleBatchId: z.number().int().positive(), expectedQuantity: z.number().nonnegative().optional(), deliveredQuantity: z.number().nonnegative(), rejectedQuantity: z.number().nonnegative().optional(), returnedQuantity: z.number().nonnegative().optional(), unit: z.string().trim().min(1).max(32) })).min(1).max(200) })).mutation(async ({ ctx, input }) => {
        const context = await requireDistributionPermission(ctx.user.id, "distribution.deliver");
        assertDistributionScope(context, { routeId: input.routeId });
        return recordDistributionDelivery(context.organization.id, ctx.user.id, input);
      }),
    }),
    collections: router({
      record: protectedProcedure.input(z.object({ routeId: z.number().int().positive(), customerId: z.number().int().positive(), salesInvoiceId: z.number().int().positive().optional(), representativeEmployeeId: z.number().int().positive().optional(), driverEmployeeId: z.number().int().positive().optional(), collectionType: z.enum(["cash_sale", "current_invoice", "previous_debt"]), amount: z.number().positive(), currencyCode: z.string().trim().length(3), exchangeRateUsed: z.number().positive().optional(), paymentMethod: z.enum(["cash", "card", "transfer", "check", "other"]).optional(), idempotencyKey: z.string().trim().min(8).max(128) })).mutation(async ({ ctx, input }) => {
        const context = await requireDistributionPermission(ctx.user.id, "distribution.collect");
        assertDistributionScope(context, { routeId: input.routeId });
        return recordDistributionCollection(context.organization.id, ctx.user.id, input);
      }),
    }),
    returns: router({
      record: protectedProcedure.input(z.object({ routeId: z.number().int().positive(), customerId: z.number().int().positive().optional(), deliveryId: z.number().int().positive().optional(), salesInvoiceId: z.number().int().positive().optional(), productId: z.number().int().positive(), vehicleBatchId: z.number().int().positive(), quantity: z.number().positive(), unit: z.string().trim().min(1).max(32), reason: z.string().trim().max(240).optional(), condition: z.enum(["resalable", "damaged", "quarantined"]), idempotencyKey: z.string().trim().min(8).max(128) })).mutation(async ({ ctx, input }) => {
        const context = await requireDistributionPermission(ctx.user.id, "distribution.deliver");
        assertDistributionScope(context, { routeId: input.routeId });
        return recordDistributionReturn(context.organization.id, ctx.user.id, input);
      }),
      returnToWarehouse: protectedProcedure.input(z.object({ vehicleId: z.number().int().positive(), destinationWarehouseId: z.number().int().positive(), vehicleBatchId: z.number().int().positive(), quantity: z.number().positive(), unit: z.string().trim().min(1).max(32) })).mutation(async ({ ctx, input }) => {
        const context = await requireDistributionPermission(ctx.user.id, "distribution.closeRoute");
        assertDistributionScope(context, { vehicleId: input.vehicleId });
        return returnVehicleStockToWarehouse(context.organization.id, ctx.user.id, input);
      }),
    }),
    expenses: router({
      create: protectedProcedure.input(z.object({ routeId: z.number().int().positive(), vehicleId: z.number().int().positive().optional(), category: z.enum(["fuel", "toll", "parking", "minor"]), amount: z.number().positive(), currencyCode: z.string().trim().length(3), receiptUrl: z.string().url().max(1024).optional(), notes: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
        const context = await requireDistributionPermission(ctx.user.id, "fleet.expenses");
        assertDistributionScope(context, { routeId: input.routeId, vehicleId: input.vehicleId });
        return addDistributionRouteExpense(context.organization.id, ctx.user.id, input);
      }),
    }),
    closings: router({
      submit: protectedProcedure.input(z.object({ routeId: z.number().int().positive(), actualCash: z.number().nonnegative(), stockDifference: z.number().optional() })).mutation(async ({ ctx, input }) => {
        const context = await requireDistributionPermission(ctx.user.id, "distribution.closeRoute");
        assertDistributionScope(context, { routeId: input.routeId });
        return submitRouteClosing(context.organization.id, ctx.user.id, input);
      }),
      transition: protectedProcedure.input(z.object({ closingId: z.number().int().positive(), status: z.enum(["reviewed", "approved", "closed", "reopened"]), reopenReason: z.string().trim().min(3).max(2000).optional() })).mutation(async ({ ctx, input }) => {
        const permission = input.status === "reviewed" ? "distribution.approveClose" : input.status === "approved" || input.status === "closed" ? "distribution.closeRoute" : "distribution.reopenRoute";
        const context = await requireDistributionPermission(ctx.user.id, permission);
        return transitionRouteClosing(context.organization.id, ctx.user.id, input);
      }),
    }),
    tracking: router({
      locations: protectedProcedure.query(async ({ ctx }) => {
        const context = await requireDistributionPermission(ctx.user.id, "distribution.view");
        return getLatestFleetLocations(context.organization.id);
      }),
      location: protectedProcedure.input(z.object({ vehicleId: z.number().int().positive(), routeId: z.number().int().positive().optional(), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), accuracy: z.number().nonnegative().max(100000).optional(), recordedAt: z.coerce.date(), source: z.enum(["driver_app", "vehicle_tracker"]) })).mutation(async ({ ctx, input }) => {
        const context = await requireDistributionPermission(ctx.user.id, "distribution.deliver");
        assertDistributionScope(context, { vehicleId: input.vehicleId, routeId: input.routeId });
        return recordFleetGpsPoint(context.organization.id, ctx.user.id, input);
      }),
      geofence: protectedProcedure.input(z.object({ routeId: z.number().int().positive(), stopId: z.number().int().positive(), vehicleId: z.number().int().positive().optional(), eventType: z.enum(["arrival", "departure"]), distanceMeters: z.number().nonnegative().max(100000).optional(), recordedAt: z.coerce.date() })).mutation(async ({ ctx, input }) => {
        const context = await requireDistributionPermission(ctx.user.id, "distribution.deliver");
        assertDistributionScope(context, { routeId: input.routeId, vehicleId: input.vehicleId });
        return recordGeofenceEvent(context.organization.id, ctx.user.id, input);
      }),
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
      const reasons = [...buildOwnerAlertReasons(metrics), ...await getDistributionOwnerAlertReasons(context.organization.id)];
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
