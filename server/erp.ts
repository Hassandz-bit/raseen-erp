import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { addOrganizationExchangeRate, adjustProductBatchQuantity, approveInventoryCount, approveStockTransfer, createBranchForOrganization, createBusinessParty, createInventoryCount, createOperationalNotifications, createOperationalRecord, createOrganizationForUser, createProductBatch, createProductCategoryForOrganization, createProductMaster, createPurchaseOrder, createSalesInvoice, createStockTransfer, createWarehouseForOrganization, dispatchStockTransfer, findProductByBarcodeForOrganization, getCommerceReportSummary, getDashboardMetrics, getDefaultTenantContext, getFinancialReportSummary, getOrCreateOrganizationSettings, getOrCreateUserPreferences, getOrganizationRolePermissions, getPublicSalesInvoiceVerification, getSalesInvoicePrintDataForOrganization, issueSalesInvoiceWithFefo, issueStockByFefo, listActiveCustomersForOrganization, listBranchesForOrganization, listInventoryCountsForOrganization, listNotificationsForOrganization, listOperationalRecords, listOrganizationCurrencies, listOrganizationExchangeRates, listOrganizationMembersForOrganization, listProductBatchesForOrganization, listProductCategoriesForOrganization, listProductsForOrganization, listPurchaseOrdersForOrganization, listSalesInvoiceShareEventsForOrganization, listSalesInvoicesForOrganization, listStockMovementsForOrganization, listStockTransfersForOrganization, listWarehousesForOrganization, markAllNotificationsRead, markNotificationRead, previewFefoAllocation, receivePurchaseOrder, receiveStockTransfer, recordSalesInvoicePayment, recordSalesInvoiceShareEventForOrganization, recordStockMovement, saveOrganizationCurrency, searchCommandEntitiesForOrganization, sendPurchaseOrder, startInventoryCount, submitInventoryCount, updateOrganizationSettings, updateProductBatchStatus, updateUserPreferences, type OperationalModule } from "./db";
import { currencyCatalog } from "../shared/currencyCatalog";
import { askNawaAI } from "./nawaAI";
import { notifyOwner } from "./_core/notification";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";
import { signInvoiceVerification, verifyInvoiceVerification } from "./invoiceVerification";
import { buildOwnerAlertReasons, canAccessTenantModule, hasActiveMembership, isOrganizationOwner } from "./tenantPolicy";
import { canUseRetailPermission, type RetailPermission } from "./retailPermissionPolicy";
import { hasValidExchangeRateDateRange, normalizeExchangeRateFilters } from "./exchangeRateFilters";
import { isValidTextBarcode } from "./barcodePolicy";
import { classifyBranchPersistenceError } from "./branchPolicy";
import { parseOrganizationLogoDataUrl, isTrustedOrganizationLogoUrl } from "./organizationLogo";
import { storagePut } from "./storage";
import { canUseDistributionPermission, isScopedIdAllowed, type DistributionPermission } from "./distributionPolicy";
import { addDistributionRouteExpense, completeDriverStop, createDistributionRoute, createDistributionTerritory, createDriverVanSale, createFleetVehicle, createMaintenanceRecord, createVehicleDocument, createVehicleLoadOrder, getDistributionControlCenter, getDistributionOwnerAlertReasons, getDistributionSettings, getDriverRouteFeed, getDriverRouteInventory, getLatestFleetLocations, listDistributionRoutes, listDistributionTerritories, listFleetVehicleDocumentAlerts, listFleetVehicles, listVehicleInventory, logFuel, recordDistributionCollection, recordDistributionDelivery, recordDistributionReturn, recordFleetGpsPoint, recordGeofenceEvent, returnVehicleStockToWarehouse, saveDistributionSettings, submitDistributionDeliveryProof, submitRouteClosing, transitionDistributionRoute, transitionRouteClosing, transitionVehicleLoadOrder } from "./distribution";
import { cancelRetailerOrder, createB2bPromotion, createRetailerOrder, createRetailerOutlet, createRetailerReturnRequest, createSavedRetailerOrderList, getRetailerCatalog, getRetailerFrequentProducts, getRetailerMonthlyReport, getRetailerSummary, grantRetailerAccess, inviteRetailerAccess, listManagedRetailerAccesses, listOrganizationB2bOrders, listOrganizationRetailerPromotions, listOrganizationRetailerReturnRequests, listRetailerAccesses, listRetailerDocuments, listRetailerFavorites, listRetailerNotifications, listRetailerOrders, listRetailerOutlets, listRetailerOutletsForAccess, listRetailerPromotions, listRetailerReturnRequests, listSavedRetailerOrderLists, lookupRetailerUserByEmail, markRetailerNotificationRead, reorderRetailerOrder, resendRetailerAccessInvite, reviewAndConvertRetailerOrder, reviewRetailerReturnRequest, submitSavedRetailerOrderList, toggleRetailerFavorite, updateRetailerAccessStatus, updateRetailerVisibilityPolicy } from "./b2b";
import { calculatePackagingLogistics, findSuitableVehicles, listProductPackaging, listUomCatalog } from "./uomPackaging";
import { closeProductionOrder, createManufacturingBom, createProductionOrder, getManufacturingOperationalOptions, getManufacturingOverview, getProductionBatchGenealogy, getProductionOrderOperationalDetails, getProductionOrderScope, getProductionTraceability, issueMaterialsForProduction, listProductionOrders, recordProductionExpense, recordProductionOutput, recordProductionQualityCheck, recordProductionWaste, reserveProductionMaterials, returnMaterialsFromProduction, saveManufacturingProductProfile, transitionProductionOrderStatus, updateProductionStage } from "./manufacturing";
import { canAccessManufacturingOrderScope, canUseManufacturingPermission, isManufacturingScopeAllowed, type ManufacturingPermission } from "./manufacturingPermissionPolicy";
import { changeFiscalPeriodStatus, createFiscalPeriod, createFiscalYear, getAccountBalance, listChartOfAccounts, listFinanceSetup, listJournalEntries, postJournalEntry, reverseJournalEntry, seedDefaultChartOfAccounts } from "./finance";
import { getBalanceSheetReport, getCashFlowReport, getGeneralLedgerReport, getProfitAndLossReport, getTrialBalanceReport } from "./financialReports";
import { postCollection, postDistributionCollection, postDistributionRouteExpense, postInventoryAdjustment, postProductionMaterialIssue, postProductionOutput, postPurchaseOrder, postSalesInvoice } from "./accountingPostingRules";
import { createBankAccount, createCashbox, getPayableAging, getReceivableAging, listTreasury, recordPayablePayment, transferTreasuryFunds } from "./treasury";
import { addBankReconciliationLine, changeBankReconciliationStatus, createBankReconciliation, createCashReconciliation, listReconciliations } from "./reconciliations";
import { approveBudget, createBudget, createCostCenter, getBudgetVsActual, listBudgets, listCostCenters, upsertBudgetLine } from "./financePlanning";
import { approveOvertimeEntry, createDepartment, createEmployee, createEmployeeContract, createEmployeeProfile, createLeaveType, createOvertimeEntry, createPosition, createWorkSchedule, decideLeaveRequest, getHrDashboard, listHrDirectory, listHrOperations, recordAttendance, submitLeaveRequest } from "./hr";
import { approvePayroll, assignAllowance, calculatePayroll, createAllowanceType, createCollectionCommissionFromDistributionReceipt, createCommissionEntry, createCommissionRule, createDeliveryCommissionFromCompletedDelivery, createEmployeeAdvance, createPayrollAdjustment, createPayrollPeriod, createSalesCommissionFromIssuedInvoice, getPayrollDashboard, reopenPayroll, reverseDeliveryCommissionFromReturn } from "./payroll";
import { payPayrollPeriod, postEmployeeAdvance, postPayrollPeriod } from "./payrollPostingRules";
import { exportPaidPayrollBankFile } from "./payrollBankExport";
import { getHrOperationalReports } from "./hrReports";
import { canUseHrPermission, type HrPermission } from "./hrPermissionPolicy";
import { assertHrEmployeeInScope, hasRestrictedHrScope, resolveHrEmployeeScope } from "./hrDataScope";
import { decideTeamAdvanceRequest, decideTeamLeaveRequest, getEmployeeSelfService, submitSelfAdvanceRequest, submitSelfLeaveRequest } from "./hrSelfService";
import { activateDemoOrganizationForUser, deleteDemoOrganization, ensureDemoOrganization, getDemoOrganizationForUser, getDemoShowcaseMetricsForUser, resetDemoOrganization, seedDemoCatalog, seedDemoCommerceScenarios, seedDemoCommercialMaster, seedDemoFoundation, seedDemoOperationsScenarios, seedDemoPromotions, seedDemoRetailHrPayrollScenarios } from "./demo";

type ModuleKey = "inventory" | "sales" | "purchases" | "finance" | "hr" | "reports" | "ai_assistant" | "distribution" | "manufacturing" | "nawa_retail";
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

export async function requireFinanceOwner(userId: number) {
  const context = await requireModule(userId, "finance");
  if (!isOrganizationOwner(context.membership.roleKey)) throw new TRPCError({ code: "FORBIDDEN", message: "يلزم دور مالك المؤسسة لإدارة إعدادات وقيود المالية." });
  return context;
}

export async function requireHrOwner(userId: number) {
  const context = await requireModule(userId, "hr");
  if (!isOrganizationOwner(context.membership.roleKey)) throw new TRPCError({ code: "FORBIDDEN", message: "يلزم دور مالك المؤسسة لإدارة الموارد البشرية والرواتب." });
  return context;
}

export async function requireHrPermission(userId: number, permission: HrPermission) {
  const context = await requireModule(userId, "hr");
  const permissions = await getOrganizationRolePermissions(context.organization.id, context.membership.roleKey);
  if (!canUseHrPermission(context.membership.roleKey, permissions, permission)) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية الموارد البشرية المطلوبة لهذه العملية." });
  return context;
}
export async function requireRetailPermission(userId: number, permission: RetailPermission) {
  const context = await requireModule(userId, "nawa_retail");
  const permissions = await getOrganizationRolePermissions(context.organization.id, context.membership.roleKey);
  if (!canUseRetailPermission(context.membership.roleKey, permissions, permission)) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية إدارة Nawa Retail المطلوبة." });
  return context;
}
export async function requireHrScopedPermission(userId: number, permission: HrPermission) {
  const context = await requireHrPermission(userId, permission);
  const scope = await resolveHrEmployeeScope({ organizationId: context.organization.id, userId, roleKey: context.membership.roleKey, dataScope: context.membership.dataScope });
  return { context, scope };
}

async function postWhenFinanceEnabled(context: Awaited<ReturnType<typeof getTenantContext>>, post: () => Promise<unknown>) {
  const financeModule = context.modules.find(module => module.moduleKey === "finance");
  if (canAccessTenantModule({ membershipStatus: context.membership.status, moduleStatus: financeModule?.status })) await post();
}

export async function requireManufacturingOwner(userId: number) {
  const context = await requireModule(userId, "manufacturing");
  if (!isOrganizationOwner(context.membership.roleKey)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "يلزم دور مالك المؤسسة وإتاحة وحدة التصنيع للوصول إلى عمليات الإنتاج." });
  }
  return context;
}

export async function requireManufacturingPermission(userId: number, permission: ManufacturingPermission) {
  const context = await requireModule(userId, "manufacturing");
  const permissions = await getOrganizationRolePermissions(context.organization.id, context.membership.roleKey);
  if (!canUseManufacturingPermission(context.membership.roleKey, permissions, permission)) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية التصنيع المطلوبة لهذه العملية." });
  return context;
}

function assertManufacturingScope(context: Awaited<ReturnType<typeof getTenantContext>>, input: { branchId?: number; productionLineId?: number; rawMaterialWarehouseId?: number; finishedGoodsWarehouseId?: number }) {
  const scope = context.membership.dataScope;
  if (!isManufacturingScopeAllowed(scope, "branchIds", input.branchId) || !isManufacturingScopeAllowed(scope, "productionLineIds", input.productionLineId) || !isManufacturingScopeAllowed(scope, "warehouseIds", input.rawMaterialWarehouseId) || !isManufacturingScopeAllowed(scope, "warehouseIds", input.finishedGoodsWarehouseId) || !isManufacturingScopeAllowed(scope, "rawMaterialWarehouseIds", input.rawMaterialWarehouseId) || !isManufacturingScopeAllowed(scope, "finishedGoodsWarehouseIds", input.finishedGoodsWarehouseId)) throw new TRPCError({ code: "FORBIDDEN", message: "أمر الإنتاج خارج نطاق الفرع أو الخط أو المخازن المسموح لعضويتك." });
}

async function requireManufacturingOrderPermission(userId: number, permission: ManufacturingPermission, productionOrderId: number) {
  const context = await requireManufacturingPermission(userId, permission);
  const order = await getProductionOrderScope(context.organization.id, productionOrderId);
  if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "أمر الإنتاج غير موجود ضمن المؤسسة الحالية." });
  if (!canAccessManufacturingOrderScope(context.membership.dataScope, order)) throw new TRPCError({ code: "FORBIDDEN", message: "أمر الإنتاج خارج نطاق بيانات عضويتك." });
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


export const erpRouter = router({
  invoiceVerification: router({
    verify: publicProcedure.input(z.object({ token: z.string().min(16).max(1000) })).query(async ({ input }) => {
      const payload = verifyInvoiceVerification(input.token, ENV.cookieSecret);
      if (!payload) return { valid: false as const };
      const invoice = await getPublicSalesInvoiceVerification(payload.organizationId, payload.invoiceId);
      if (!invoice || invoice.invoiceNumber !== payload.invoiceNumber) return { valid: false as const };
      return { valid: true as const, invoice };
    }),
  }),
  catalog: router({
    findProductByBarcode: protectedProcedure.input(z.object({ barcode: z.string().trim().min(2).max(96) })).query(async ({ ctx, input }) => {
      const context = await getTenantContext(ctx.user.id);
      const inventoryStatus = context.modules.find(module => module.moduleKey === "inventory")?.status;
      const salesStatus = context.modules.find(module => module.moduleKey === "sales")?.status;
      const canUseCatalog = canAccessTenantModule({ membershipStatus: context.membership.status, moduleStatus: inventoryStatus }) || canAccessTenantModule({ membershipStatus: context.membership.status, moduleStatus: salesStatus });
      if (!canUseCatalog) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية الوصول إلى كتالوج المنتجات." });
      return findProductByBarcodeForOrganization(context.organization.id, input.barcode);
    }),
  }),
  navigation: router({
    commandSearch: protectedProcedure.input(z.object({ query: z.string().trim().min(2).max(96) })).query(async ({ ctx, input }) => {
      const context = await getTenantContext(ctx.user.id);
      const moduleStatus = (moduleKey: ModuleKey) => context.modules.find(module => module.moduleKey === moduleKey)?.status;
      return searchCommandEntitiesForOrganization(context.organization.id, {
        query: input.query,
        includeInventory: canAccessTenantModule({ membershipStatus: context.membership.status, moduleStatus: moduleStatus("inventory") }),
        includeSales: canAccessTenantModule({ membershipStatus: context.membership.status, moduleStatus: moduleStatus("sales") }),
      });
    }),
  }),
  demo: router({
    status: protectedProcedure.query(async ({ ctx }) => getDemoOrganizationForUser(ctx.user.id)),
    metrics: protectedProcedure.query(async ({ ctx }) => getDemoShowcaseMetricsForUser(ctx.user.id)),
    ensure: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "يلزم مدير المنصة لإنشاء شركة العرض." });
      return ensureDemoOrganization(ctx.user.id);
    }),
    seedFoundation: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "يلزم مدير المنصة لتهيئة شركة العرض." });
      return seedDemoFoundation(ctx.user.id);
    }),
    seedCatalog: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "يلزم مدير المنصة لتهيئة كتالوج شركة العرض." });
      return seedDemoCatalog(ctx.user.id);
    }),
    seedCommercialMaster: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "يلزم مدير المنصة لتهيئة تجارة شركة العرض." });
      return seedDemoCommercialMaster(ctx.user.id);
    }),
    seedPromotions: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "يلزم مدير المنصة لتهيئة عروض شركة العرض." });
      return seedDemoPromotions(ctx.user.id);
    }),
    seedCommerceScenarios: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "يلزم مدير المنصة لتهيئة سيناريوهات تجارة شركة العرض." });
      return seedDemoCommerceScenarios(ctx.user.id);
    }),
    seedOperationsScenarios: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "يلزم مدير المنصة لتهيئة التصنيع والتوزيع لشركة العرض." });
      return seedDemoOperationsScenarios(ctx.user.id);
    }),
    seedRetailHrPayrollScenarios: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "يلزم مدير المنصة لتهيئة Retail والموارد البشرية والرواتب لشركة العرض." });
      return seedDemoRetailHrPayrollScenarios(ctx.user.id);
    }),
    reset: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "يلزم مدير المنصة لإعادة تهيئة شركة العرض." });
      return resetDemoOrganization(ctx.user.id);
    }),
    delete: protectedProcedure.input(z.object({ confirmation: z.literal("DELETE NAWA DEMO") })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "يلزم مدير المنصة لحذف شركة العرض." });
      return deleteDemoOrganization(ctx.user.id, input.confirmation);
    }),
    activate: protectedProcedure.mutation(async ({ ctx }) => activateDemoOrganizationForUser(ctx.user.id)),
  }),
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
      tablePreferences: z.record(z.string(), z.object({ density: z.enum(["compact", "normal", "comfortable"]).optional(), hiddenColumnIds: z.array(z.string().trim().min(1).max(64)).max(24).optional(), columnOrder: z.array(z.string().trim().min(1).max(64)).max(24).optional() })).optional(),
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
        logoUrl: z.string().max(1024).refine(isTrustedOrganizationLogoUrl, "يجب أن يكون رابط الشعار آمناً.").optional(),
        address: z.string().max(300).optional(),
        phone: z.string().max(64).optional(),
        taxNumber: z.string().max(96).optional(),
        legalInfo: z.string().max(500).optional(),
        headerText: z.string().max(180).optional(),
        footerText: z.string().max(300).optional(),
        showSignature: z.boolean().optional(),
        useLogoWatermark: z.boolean().optional(),
        headerTemplate: z.enum(["classic", "split", "minimal"]).optional(),
        showElectronicSeal: z.boolean().optional(),
        electronicSealLabel: z.string().trim().max(120).optional(),
        shareTemplates: z.object({ whatsapp: z.object({ ar: z.string().max(2000).optional(), fr: z.string().max(2000).optional(), en: z.string().max(2000).optional() }).optional(), emailSubject: z.object({ ar: z.string().max(300).optional(), fr: z.string().max(300).optional(), en: z.string().max(300).optional() }).optional(), emailBody: z.object({ ar: z.string().max(2000).optional(), fr: z.string().max(2000).optional(), en: z.string().max(2000).optional() }).optional() }).optional(),
        fontFamily: z.enum(["ibm-plex", "tajawal", "noto-arabic", "inter", "system"]).optional(),
        fontSize: z.enum(["small", "normal", "large"]).optional(),
        vat: z.object({ defaultRate: z.number().min(0).max(100), priceMode: z.enum(["exclusive", "inclusive"]) }).optional(),
      }).optional(),
    })).mutation(async ({ ctx, input }) => {
      const context = await requireOrganizationOwner(ctx.user.id);
      return updateOrganizationSettings(context.organization.id, input);
    }),
    uploadOrganizationLogo: protectedProcedure.input(z.object({ dataUrl: z.string().min(24).max(1_500_000) })).mutation(async ({ ctx, input }) => {
      const context = await requireOrganizationOwner(ctx.user.id);
      const logo = parseOrganizationLogoDataUrl(input.dataUrl);
      const stored = await storagePut(`organizations/${context.organization.id}/branding/document-logo.${logo.extension}`, logo.bytes, logo.mimeType);
      const settings = await getOrCreateOrganizationSettings(context.organization.id);
      await updateOrganizationSettings(context.organization.id, { documentSettings: { ...settings.documentSettings, logoUrl: stored.url } });
      return { url: stored.url };
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
    availableBranches: protectedProcedure.query(async ({ ctx }) => {
      const context = await getTenantContext(ctx.user.id);
      const allowedBranchIds = context.membership.dataScope?.branchIds ?? [];
      const organizationBranches = await listBranchesForOrganization(context.organization.id);
      return organizationBranches
        .filter(branch => branch.status === "active" && (!allowedBranchIds.length || allowedBranchIds.includes(branch.id)))
        .map(branch => ({ id: branch.id, code: branch.code, name: branch.name }));
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
    listProductCategories: protectedProcedure.query(async ({ ctx }) => {
      const context = await requireModule(ctx.user.id, "inventory");
      return listProductCategoriesForOrganization(context.organization.id);
    }),
    createProductCategory: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(160), parentId: z.number().int().positive().optional(), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "لون الفئة غير صالح.").optional() })).mutation(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "inventory");
      return createProductCategoryForOrganization(context.organization.id, input);
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
    batchBulkCapabilities: protectedProcedure.query(async ({ ctx }) => {
      const context = await requireModule(ctx.user.id, "inventory");
      return { canManageBatchStatus: isOrganizationOwner(context.membership.roleKey) };
    }),
    bulkUpdateBatchStatus: protectedProcedure.input(z.object({ batchIds: z.array(z.number().int().positive()).min(1).max(100), status: z.enum(["active", "blocked", "quarantined"]) })).mutation(async ({ ctx, input }) => {
      const context = await requireOrganizationOwner(ctx.user.id);
      await requireModule(ctx.user.id, "inventory");
      const uniqueBatchIds = input.batchIds.filter((batchId, index, values) => values.indexOf(batchId) === index);
      await Promise.all(uniqueBatchIds.map(batchId => updateProductBatchStatus(context.organization.id, ctx.user.id, batchId, input.status)));
      return { updatedCount: uniqueBatchIds.length, status: input.status };
    }),
    adjustBatchQuantity: protectedProcedure.input(z.object({ batchId: z.number().int().positive(), quantity: z.number().finite().refine(value => value !== 0, "كمية التسوية لا يمكن أن تكون صفراً."), reason: z.string().trim().max(300).optional() })).mutation(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "inventory");
      const adjustment = await adjustProductBatchQuantity(context.organization.id, ctx.user.id, input.batchId, input.quantity, input.reason);
      await postWhenFinanceEnabled(context, () => postInventoryAdjustment(context.organization.id, ctx.user.id, adjustment.stockMovementId));
      return adjustment;
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
    invoicePrintData: protectedProcedure.input(z.object({ invoiceId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "sales");
      const data = await getSalesInvoicePrintDataForOrganization(context.organization.id, input.invoiceId);
      return { ...data, verificationToken: signInvoiceVerification({ v: 1, organizationId: context.organization.id, invoiceId: input.invoiceId, invoiceNumber: data.invoice.invoiceNumber, issuedAt: new Date(data.invoice.createdAt).getTime() }, ENV.cookieSecret) };
    }),
    invoiceShareEvents: protectedProcedure.input(z.object({ invoiceId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "sales");
      return listSalesInvoiceShareEventsForOrganization(context.organization.id, input.invoiceId);
    }),
    trackInvoiceShare: protectedProcedure.input(z.object({ invoiceId: z.number().int().positive(), channel: z.enum(["whatsapp", "email"]), status: z.enum(["opened", "confirmed_sent", "cancelled"]) })).mutation(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "sales");
      return recordSalesInvoiceShareEventForOrganization(context.organization.id, ctx.user.id, input);
    }),
    createInvoice: protectedProcedure.input(z.object({
      invoiceNumber: z.string().trim().min(1).max(64).optional(),
      customerId: z.number().int().positive().optional(),
      currencyCode: z.string().trim().length(3),
      baseCurrencyCode: z.string().trim().length(3),
      exchangeRateUsed: z.number().positive().max(1_000_000_000).optional(),
      dueDate: z.coerce.date().optional(),
      discountAmount: z.number().nonnegative().max(999_999_999).optional(),
      taxMode: z.enum(["exclusive", "inclusive"]).optional(),
      taxRate: z.number().min(0).max(100).optional(),
      lines: z.array(z.object({ productId: z.number().int().positive(), warehouseId: z.number().int().positive(), quantity: z.number().positive(), unit: z.string().trim().min(1).max(32).optional(), unitPrice: z.number().nonnegative().max(999_999_999).optional(), taxRate: z.number().min(0).max(100).optional() })).min(1),
    })).mutation(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "sales");
      await requireModule(ctx.user.id, "inventory");
      return createSalesInvoice(context.organization.id, ctx.user.id, input);
    }),
    issueInvoice: protectedProcedure.input(z.object({ invoiceId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "sales");
      await requireModule(ctx.user.id, "inventory");
      const issued = await issueSalesInvoiceWithFefo(context.organization.id, ctx.user.id, input.invoiceId);
      await createSalesCommissionFromIssuedInvoice(context.organization.id, ctx.user.id, input.invoiceId);
      await postWhenFinanceEnabled(context, () => postSalesInvoice(context.organization.id, ctx.user.id, input.invoiceId));
      return issued;
    }),
    recordPayment: protectedProcedure.input(z.object({ invoiceId: z.number().int().positive(), amount: z.number().positive().max(999_999_999).optional() })).mutation(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "sales");
      const payment = await recordSalesInvoicePayment(context.organization.id, ctx.user.id, input.invoiceId, input.amount);
      await postWhenFinanceEnabled(context, () => postCollection(context.organization.id, ctx.user.id, payment.financialTransactionId));
      return payment;
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
      const receipt = await receivePurchaseOrder(context.organization.id, ctx.user.id, input.purchaseOrderId, input.receipts);
      if (receipt.status === "received") await postWhenFinanceEnabled(context, () => postPurchaseOrder(context.organization.id, ctx.user.id, input.purchaseOrderId));
      return receipt;
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

  hr: router({
    self: router({
      profile: protectedProcedure.query(async ({ ctx }) => { const context = await requireHrPermission(ctx.user.id, "hr.self.view"); return getEmployeeSelfService(context.organization.id, ctx.user.id); }),
      submitLeave: protectedProcedure.input(z.object({ leaveTypeId: z.number().int().positive(), startsAt: z.coerce.date(), endsAt: z.coerce.date(), days: z.number().positive(), reason: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => { const context = await requireHrPermission(ctx.user.id, "hr.self.leave.request"); return submitSelfLeaveRequest(context.organization.id, ctx.user.id, input); }),
      submitAdvance: protectedProcedure.input(z.object({ occurredAt: z.coerce.date(), amount: z.number().positive(), currencyCode: z.string().trim().length(3), reason: z.string().trim().min(3).max(2000), recoveryMethod: z.enum(["one_payroll", "multiple_payrolls"]), idempotencyKey: z.string().trim().min(8).max(128) })).mutation(async ({ ctx, input }) => { const context = await requireHrPermission(ctx.user.id, "hr.self.advance.request"); return submitSelfAdvanceRequest(context.organization.id, ctx.user.id, input); }),
    }),
    team: router({
      decideLeave: protectedProcedure.input(z.object({ leaveRequestId: z.number().int().positive(), decision: z.enum(["approved", "rejected"]) })).mutation(async ({ ctx, input }) => { const context = await requireHrPermission(ctx.user.id, "hr.leave.approve_team"); return decideTeamLeaveRequest(context.organization.id, ctx.user.id, input.leaveRequestId, input.decision); }),
      decideAdvance: protectedProcedure.input(z.object({ advanceId: z.number().int().positive(), approved: z.boolean() })).mutation(async ({ ctx, input }) => { const context = await requireHrPermission(ctx.user.id, "hr.advance.approve_team"); return decideTeamAdvanceRequest(context.organization.id, ctx.user.id, input.advanceId, input.approved); }),
    }),
    dashboard: protectedProcedure.query(async ({ ctx }) => { const { context, scope } = await requireHrScopedPermission(ctx.user.id, "hr.directory.view"); if (hasRestrictedHrScope(scope)) throw new TRPCError({ code: "FORBIDDEN", message: "لوحة مؤشرات الموارد البشرية العامة غير متاحة لنطاق جزئي؛ استخدم التقرير المفلتر." }); return getHrDashboard(context.organization.id); }),
    directory: protectedProcedure.query(async ({ ctx }) => { const { context, scope } = await requireHrScopedPermission(ctx.user.id, "hr.directory.view"); return listHrDirectory(context.organization.id, scope); }),
    operations: protectedProcedure.query(async ({ ctx }) => { const { context, scope } = await requireHrScopedPermission(ctx.user.id, "hr.leave.view"); if (hasRestrictedHrScope(scope)) throw new TRPCError({ code: "FORBIDDEN", message: "قائمة العمليات العامة غير متاحة لنطاق جزئي؛ استخدم التقرير المفلتر." }); return listHrOperations(context.organization.id); }),
    payrollDashboard: protectedProcedure.query(async ({ ctx }) => { const context = await requireHrOwner(ctx.user.id); return getPayrollDashboard(context.organization.id); }),
    reports: protectedProcedure.input(z.object({ branchId: z.number().int().positive().optional(), departmentId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => { const { context, scope } = await requireHrScopedPermission(ctx.user.id, "hr.payroll.view"); if (scope.roleKey !== "owner") { if (scope.branchIds.length && (!input?.branchId || !scope.branchIds.includes(input.branchId))) throw new TRPCError({ code: "FORBIDDEN", message: "يلزم اختيار فرع داخل نطاق بياناتك المصرح به." }); if (scope.departmentIds.length && (!input?.departmentId || !scope.departmentIds.includes(input.departmentId))) throw new TRPCError({ code: "FORBIDDEN", message: "يلزم اختيار قسم داخل نطاق بياناتك المصرح به." }); } return getHrOperationalReports(context.organization.id, input); }),
    exportBankFile: protectedProcedure.input(z.object({ payrollPeriodId: z.number().int().positive(), delimiter: z.enum([",", ";"]).optional() })).query(async ({ ctx, input }) => { const context = await requireHrPermission(ctx.user.id, "hr.payroll.export_bank"); return exportPaidPayrollBankFile(context.organization.id, input.payrollPeriodId, input.delimiter); }),
    createEmployee: protectedProcedure.input(z.object({ employeeNumber: z.string().trim().min(2).max(64), fullName: z.string().trim().min(2).max(180), department: z.string().trim().max(120).optional(), jobTitle: z.string().trim().max(120).optional(), joinedAt: z.coerce.date().optional() })).mutation(async ({ ctx, input }) => { const context = await requireOrganizationOwner(ctx.user.id); return createEmployee(context.organization.id, ctx.user.id, input); }),
    createDepartment: protectedProcedure.input(z.object({ code: z.string().trim().min(2).max(48), name: z.string().trim().min(2).max(160), branchId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => { const context = await requireOrganizationOwner(ctx.user.id); return createDepartment(context.organization.id, ctx.user.id, input); }),
    createPosition: protectedProcedure.input(z.object({ code: z.string().trim().min(2).max(48), name: z.string().trim().min(2).max(160), departmentId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => { const context = await requireOrganizationOwner(ctx.user.id); return createPosition(context.organization.id, ctx.user.id, input); }),
    createEmployeeProfile: protectedProcedure.input(z.object({ employeeId: z.number().int().positive(), userId: z.number().int().positive().optional(), branchId: z.number().int().positive().optional(), departmentId: z.number().int().positive().optional(), positionId: z.number().int().positive().optional(), managerEmployeeId: z.number().int().positive().optional(), fullNameAr: z.string().trim().max(180).optional(), fullNameLatin: z.string().trim().max(180).optional(), payrollCurrency: z.string().trim().length(3), bankAccountReference: z.string().trim().max(128).optional(), phone: z.string().trim().max(48).optional(), email: z.string().trim().email().max(320).optional(), workLocation: z.string().trim().max(180).optional(), notes: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => { const context = await requireOrganizationOwner(ctx.user.id); return createEmployeeProfile(context.organization.id, ctx.user.id, input); }),
    createWorkSchedule: protectedProcedure.input(z.object({ code: z.string().trim().min(2).max(48), name: z.string().trim().min(2).max(160), workDays: z.array(z.number().int().min(0).max(6)).min(1), startTime: z.string().trim().regex(/^\d{2}:\d{2}$/), endTime: z.string().trim().regex(/^\d{2}:\d{2}$/), breakMinutes: z.number().int().nonnegative().optional(), weeklyHours: z.number().positive().optional(), branchId: z.number().int().positive().optional(), departmentId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => { const context = await requireOrganizationOwner(ctx.user.id); return createWorkSchedule(context.organization.id, ctx.user.id, input); }),
      createContract: protectedProcedure.input(z.object({ employeeId: z.number().int().positive(), workScheduleId: z.number().int().positive().optional(), contractType: z.enum(["permanent", "fixed_term", "daily", "hourly", "service"]), startsAt: z.coerce.date(), endsAt: z.coerce.date().optional(), salaryBasis: z.enum(["monthly", "daily", "hourly", "fixed"]), baseSalary: z.number().nonnegative(), absenceDeductionPerDay: z.number().nonnegative().optional(), currencyCode: z.string().trim().length(3), probationEndsAt: z.coerce.date().optional() })).mutation(async ({ ctx, input }) => { const { context, scope } = await requireHrScopedPermission(ctx.user.id, "hr.payroll.manage"); await assertHrEmployeeInScope(scope, input.employeeId); return createEmployeeContract(context.organization.id, ctx.user.id, input); }),
    recordAttendance: protectedProcedure.input(z.object({ employeeId: z.number().int().positive(), attendanceDate: z.coerce.date(), status: z.enum(["present", "absent", "leave", "late"]), checkInAt: z.coerce.date().optional(), checkOutAt: z.coerce.date().optional(), workingMinutes: z.number().int().nonnegative().optional(), lateMinutes: z.number().int().nonnegative().optional(), earlyLeaveMinutes: z.number().int().nonnegative().optional(), overtimeMinutes: z.number().int().nonnegative().optional(), source: z.enum(["manual", "supervisor", "device_ready", "mobile_ready"]).optional(), notes: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => { const { context, scope } = await requireHrScopedPermission(ctx.user.id, "hr.attendance.manage"); await assertHrEmployeeInScope(scope, input.employeeId, { allowDirectReports: true }); return recordAttendance(context.organization.id, ctx.user.id, input); }),
    createLeaveType: protectedProcedure.input(z.object({ code: z.string().trim().min(2).max(48), name: z.string().trim().min(2).max(160), defaultDays: z.number().nonnegative().optional(), isPaid: z.enum(["yes", "no"]).optional() })).mutation(async ({ ctx, input }) => { const context = await requireOrganizationOwner(ctx.user.id); return createLeaveType(context.organization.id, ctx.user.id, input); }),
    submitLeave: protectedProcedure.input(z.object({ employeeId: z.number().int().positive(), leaveTypeId: z.number().int().positive(), startsAt: z.coerce.date(), endsAt: z.coerce.date(), days: z.number().positive(), reason: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => { const { context, scope } = await requireHrScopedPermission(ctx.user.id, "hr.leave.manage"); await assertHrEmployeeInScope(scope, input.employeeId, { allowDirectReports: true }); return submitLeaveRequest(context.organization.id, ctx.user.id, input); }),
    decideLeave: protectedProcedure.input(z.object({ leaveRequestId: z.number().int().positive(), decision: z.enum(["approved", "rejected"]), note: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => { const context = await requireOrganizationOwner(ctx.user.id); return decideLeaveRequest(context.organization.id, ctx.user.id, input.leaveRequestId, input.decision, input.note); }),
    createOvertime: protectedProcedure.input(z.object({ employeeId: z.number().int().positive(), occurredAt: z.coerce.date(), hours: z.number().positive(), overtimeType: z.string().trim().min(2).max(64), multiplier: z.number().positive().optional(), reason: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => { const { context, scope } = await requireHrScopedPermission(ctx.user.id, "hr.overtime.manage"); await assertHrEmployeeInScope(scope, input.employeeId, { allowDirectReports: true }); return createOvertimeEntry(context.organization.id, ctx.user.id, input); }),
    decideOvertime: protectedProcedure.input(z.object({ overtimeId: z.number().int().positive(), approved: z.boolean() })).mutation(async ({ ctx, input }) => { const context = await requireOrganizationOwner(ctx.user.id); return approveOvertimeEntry(context.organization.id, ctx.user.id, input.overtimeId, input.approved); }),
    createPayrollPeriod: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(64), startsAt: z.coerce.date(), endsAt: z.coerce.date(), paymentDate: z.coerce.date().optional() })).mutation(async ({ ctx, input }) => { const context = await requireHrOwner(ctx.user.id); return createPayrollPeriod(context.organization.id, ctx.user.id, input); }),
    createAllowanceType: protectedProcedure.input(z.object({ code: z.string().trim().min(2).max(48), name: z.string().trim().min(2).max(160), calculationType: z.enum(["fixed", "percentage"]), defaultValue: z.number().nonnegative() })).mutation(async ({ ctx, input }) => { const context = await requireHrOwner(ctx.user.id); return createAllowanceType(context.organization.id, ctx.user.id, input); }),
    assignAllowance: protectedProcedure.input(z.object({ employeeId: z.number().int().positive(), allowanceTypeId: z.number().int().positive(), amount: z.number().nonnegative(), startsAt: z.coerce.date(), endsAt: z.coerce.date().optional() })).mutation(async ({ ctx, input }) => { const { context, scope } = await requireHrScopedPermission(ctx.user.id, "hr.payroll.manage"); await assertHrEmployeeInScope(scope, input.employeeId); return assignAllowance(context.organization.id, ctx.user.id, input); }),
    createAdjustment: protectedProcedure.input(z.object({ employeeId: z.number().int().positive(), payrollPeriodId: z.number().int().positive().optional(), adjustmentType: z.enum(["deduction", "bonus", "commission", "other"]), amount: z.number().nonnegative(), reason: z.string().trim().min(3).max(2000) })).mutation(async ({ ctx, input }) => { const { context, scope } = await requireHrScopedPermission(ctx.user.id, "hr.payroll.manage"); await assertHrEmployeeInScope(scope, input.employeeId); return createPayrollAdjustment(context.organization.id, ctx.user.id, input); }),
    createAdvance: protectedProcedure.input(z.object({ employeeId: z.number().int().positive(), occurredAt: z.coerce.date(), amount: z.number().positive(), currencyCode: z.string().trim().length(3), reason: z.string().trim().min(3).max(2000), recoveryMethod: z.enum(["one_payroll", "multiple_payrolls"]), idempotencyKey: z.string().trim().min(8).max(128) })).mutation(async ({ ctx, input }) => { const { context, scope } = await requireHrScopedPermission(ctx.user.id, "hr.advance.view"); await assertHrEmployeeInScope(scope, input.employeeId, { allowDirectReports: true }); return createEmployeeAdvance(context.organization.id, ctx.user.id, input); }),
    createCommissionRule: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(160), sourceType: z.enum(["sales", "collections", "deliveries", "product", "customer", "target", "route_performance"]), calculationType: z.enum(["fixed", "percentage"]), value: z.number().nonnegative() })).mutation(async ({ ctx, input }) => { const context = await requireHrOwner(ctx.user.id); return createCommissionRule(context.organization.id, ctx.user.id, input); }),
      createCommissionEntry: protectedProcedure.input(z.object({ employeeId: z.number().int().positive(), commissionRuleId: z.number().int().positive().optional(), sourceModule: z.string().trim().min(2).max(64), sourceDocumentType: z.string().trim().min(2).max(64), sourceDocumentId: z.number().int().positive(), occurredAt: z.coerce.date(), amount: z.number().nonnegative(), currencyCode: z.string().trim().length(3) })).mutation(async ({ ctx, input }) => { const { context, scope } = await requireHrScopedPermission(ctx.user.id, "hr.payroll.manage"); await assertHrEmployeeInScope(scope, input.employeeId); return createCommissionEntry(context.organization.id, ctx.user.id, input); }),
    calculatePayroll: protectedProcedure.input(z.object({ payrollPeriodId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const context = await requireHrOwner(ctx.user.id); return calculatePayroll(context.organization.id, ctx.user.id, input.payrollPeriodId); }),
    approvePayroll: protectedProcedure.input(z.object({ payrollPeriodId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const context = await requireHrOwner(ctx.user.id); return approvePayroll(context.organization.id, ctx.user.id, input.payrollPeriodId); }),
    reopenPayroll: protectedProcedure.input(z.object({ payrollPeriodId: z.number().int().positive(), reason: z.string().trim().min(3).max(2000) })).mutation(async ({ ctx, input }) => { const context = await requireHrOwner(ctx.user.id); return reopenPayroll(context.organization.id, ctx.user.id, input.payrollPeriodId, input.reason); }),
    postPayroll: protectedProcedure.input(z.object({ payrollPeriodId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const context = await requireHrOwner(ctx.user.id); await requireModule(ctx.user.id, "finance"); return postPayrollPeriod(context.organization.id, ctx.user.id, input.payrollPeriodId); }),
    payPayroll: protectedProcedure.input(z.object({ payrollPeriodId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const context = await requireHrOwner(ctx.user.id); await requireModule(ctx.user.id, "finance"); return payPayrollPeriod(context.organization.id, ctx.user.id, input.payrollPeriodId); }),
    postAdvance: protectedProcedure.input(z.object({ advanceId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const context = await requireHrOwner(ctx.user.id); await requireModule(ctx.user.id, "finance"); return postEmployeeAdvance(context.organization.id, ctx.user.id, input.advanceId); }),
  }),

  finance: router({
    bootstrap: protectedProcedure.mutation(async ({ ctx }) => {
      const context = await requireFinanceOwner(ctx.user.id);
      return seedDefaultChartOfAccounts(context.organization.id);
    }),
    chartOfAccounts: protectedProcedure.query(async ({ ctx }) => {
      const context = await requireModule(ctx.user.id, "finance");
      return listChartOfAccounts(context.organization.id);
    }),
    setup: protectedProcedure.query(async ({ ctx }) => {
      const context = await requireModule(ctx.user.id, "finance");
      return listFinanceSetup(context.organization.id);
    }),
    journalEntries: protectedProcedure.query(async ({ ctx }) => {
      const context = await requireModule(ctx.user.id, "finance");
      return listJournalEntries(context.organization.id);
    }),
    createFiscalYear: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(64), startsAt: z.coerce.date(), endsAt: z.coerce.date() })).mutation(async ({ ctx, input }) => {
      const context = await requireFinanceOwner(ctx.user.id);
      return createFiscalYear(context.organization.id, input);
    }),
    createFiscalPeriod: protectedProcedure.input(z.object({ fiscalYearId: z.number().int().positive(), name: z.string().trim().min(2).max(64), startsAt: z.coerce.date(), endsAt: z.coerce.date() })).mutation(async ({ ctx, input }) => {
      const context = await requireFinanceOwner(ctx.user.id);
      return createFiscalPeriod(context.organization.id, input);
    }),
    changeFiscalPeriodStatus: protectedProcedure.input(z.object({ fiscalPeriodId: z.number().int().positive(), status: z.enum(["open", "closed", "locked"]), reason: z.string().trim().min(3).max(1000) })).mutation(async ({ ctx, input }) => {
      const context = await requireFinanceOwner(ctx.user.id);
      return changeFiscalPeriodStatus(context.organization.id, ctx.user.id, input.fiscalPeriodId, input.status, input.reason);
    }),
    postJournalEntry: protectedProcedure.input(z.object({ journalEntryId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const context = await requireFinanceOwner(ctx.user.id);
      return postJournalEntry(context.organization.id, ctx.user.id, input.journalEntryId);
    }),
    reverseJournalEntry: protectedProcedure.input(z.object({ journalEntryId: z.number().int().positive(), fiscalPeriodId: z.number().int().positive(), reversalDate: z.coerce.date(), note: z.string().trim().max(1000).optional() })).mutation(async ({ ctx, input }) => {
      const context = await requireFinanceOwner(ctx.user.id);
      return reverseJournalEntry(context.organization.id, ctx.user.id, input.journalEntryId, input.fiscalPeriodId, input.note, input.reversalDate);
    }),
    accountBalance: protectedProcedure.input(z.object({ accountId: z.number().int().positive(), startsAt: z.coerce.date().optional(), endsAt: z.coerce.date().optional() })).query(async ({ ctx, input }) => {
      const context = await requireModule(ctx.user.id, "finance");
      return getAccountBalance(context.organization.id, input.accountId, input);
    }),
    treasury: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        const context = await requireModule(ctx.user.id, "finance");
        return listTreasury(context.organization.id);
      }),
      createCashbox: protectedProcedure.input(z.object({ code: z.string().trim().min(2).max(48), name: z.string().trim().min(2).max(160), currencyCode: z.string().trim().length(3), accountId: z.number().int().positive(), branchId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
        const context = await requireFinanceOwner(ctx.user.id);
        return createCashbox(context.organization.id, input);
      }),
      createBankAccount: protectedProcedure.input(z.object({ code: z.string().trim().min(2).max(48), name: z.string().trim().min(2).max(160), bankName: z.string().trim().min(2).max(180), accountNumberMasked: z.string().trim().max(64).optional(), currencyCode: z.string().trim().length(3), accountId: z.number().int().positive(), branchId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
        const context = await requireFinanceOwner(ctx.user.id);
        return createBankAccount(context.organization.id, input);
      }),
      transfer: protectedProcedure.input(z.object({ fromType: z.enum(["cashbox", "bank"]), fromId: z.number().int().positive(), toType: z.enum(["cashbox", "bank"]), toId: z.number().int().positive(), amount: z.number().positive(), occurredAt: z.coerce.date(), notes: z.string().trim().max(2000).optional(), idempotencyKey: z.string().trim().min(8).max(128) })).mutation(async ({ ctx, input }) => {
        const context = await requireFinanceOwner(ctx.user.id);
        return transferTreasuryFunds(context.organization.id, ctx.user.id, input);
      }),
      recordPayablePayment: protectedProcedure.input(z.object({ supplierId: z.number().int().positive(), purchaseOrderId: z.number().int().positive().optional(), paymentAccountType: z.enum(["cashbox", "bank"]), paymentAccountId: z.number().int().positive(), amount: z.number().positive(), occurredAt: z.coerce.date(), notes: z.string().trim().max(2000).optional(), idempotencyKey: z.string().trim().min(8).max(128) })).mutation(async ({ ctx, input }) => {
        const context = await requireFinanceOwner(ctx.user.id);
        return recordPayablePayment(context.organization.id, ctx.user.id, input);
      }),
    }),
    aging: router({
      receivables: protectedProcedure.query(async ({ ctx }) => {
        const context = await requireModule(ctx.user.id, "finance");
        return getReceivableAging(context.organization.id);
      }),
      payables: protectedProcedure.query(async ({ ctx }) => {
        const context = await requireModule(ctx.user.id, "finance");
        return getPayableAging(context.organization.id);
      }),
    }),
    reconciliations: router({
      list: protectedProcedure.query(async ({ ctx }) => {
        const context = await requireModule(ctx.user.id, "finance");
        return listReconciliations(context.organization.id);
      }),
      createBank: protectedProcedure.input(z.object({ bankAccountId: z.number().int().positive(), statementDate: z.coerce.date(), statementEndingBalance: z.number(), notes: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
        const context = await requireFinanceOwner(ctx.user.id);
        return createBankReconciliation(context.organization.id, ctx.user.id, input);
      }),
      addBankLine: protectedProcedure.input(z.object({ reconciliationId: z.number().int().positive(), bankMovementId: z.number().int().positive().optional(), statementReference: z.string().trim().max(128).optional(), statementDate: z.coerce.date().optional(), amount: z.number().positive(), direction: z.enum(["in", "out"]), matchStatus: z.enum(["matched", "unmatched", "excluded"]), notes: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
        const context = await requireFinanceOwner(ctx.user.id);
        return addBankReconciliationLine(context.organization.id, ctx.user.id, input);
      }),
      changeBankStatus: protectedProcedure.input(z.object({ reconciliationId: z.number().int().positive(), status: z.enum(["reviewed", "approved", "cancelled"]) })).mutation(async ({ ctx, input }) => {
        const context = await requireFinanceOwner(ctx.user.id);
        return changeBankReconciliationStatus(context.organization.id, ctx.user.id, input.reconciliationId, input.status);
      }),
      createCash: protectedProcedure.input(z.object({ cashboxId: z.number().int().positive(), reconciledAt: z.coerce.date(), actualBalance: z.number(), reason: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
        const context = await requireFinanceOwner(ctx.user.id);
        return createCashReconciliation(context.organization.id, ctx.user.id, input);
      }),
    }),
    planning: router({
      budgets: protectedProcedure.query(async ({ ctx }) => {
        const context = await requireModule(ctx.user.id, "finance");
        return listBudgets(context.organization.id);
      }),
      costCenters: protectedProcedure.query(async ({ ctx }) => {
        const context = await requireModule(ctx.user.id, "finance");
        return listCostCenters(context.organization.id);
      }),
      createCostCenter: protectedProcedure.input(z.object({ code: z.string().trim().min(2).max(48), name: z.string().trim().min(2).max(160), branchId: z.number().int().positive().optional(), dimensions: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional() })).mutation(async ({ ctx, input }) => {
        const context = await requireFinanceOwner(ctx.user.id);
        return createCostCenter(context.organization.id, ctx.user.id, input);
      }),
      createBudget: protectedProcedure.input(z.object({ fiscalYearId: z.number().int().positive(), name: z.string().trim().min(2).max(160), notes: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
        const context = await requireFinanceOwner(ctx.user.id);
        return createBudget(context.organization.id, ctx.user.id, input);
      }),
      upsertBudgetLine: protectedProcedure.input(z.object({ budgetId: z.number().int().positive(), accountId: z.number().int().positive(), fiscalPeriodId: z.number().int().positive(), amount: z.number().nonnegative(), branchId: z.number().int().positive().optional(), costCenterId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
        const context = await requireFinanceOwner(ctx.user.id);
        return upsertBudgetLine(context.organization.id, ctx.user.id, input);
      }),
      approveBudget: protectedProcedure.input(z.object({ budgetId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const context = await requireFinanceOwner(ctx.user.id);
        return approveBudget(context.organization.id, ctx.user.id, input.budgetId);
      }),
      budgetVsActual: protectedProcedure.input(z.object({ budgetId: z.number().int().positive() })).query(async ({ ctx, input }) => {
        const context = await requireModule(ctx.user.id, "finance");
        return getBudgetVsActual(context.organization.id, input.budgetId);
      }),
    }),
    reports: router({
      generalLedger: protectedProcedure.input(z.object({ startsAt: z.coerce.date().optional(), endsAt: z.coerce.date().optional(), accountId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
        const context = await requireModule(ctx.user.id, "finance");
        return getGeneralLedgerReport(context.organization.id, input ?? {});
      }),
      trialBalance: protectedProcedure.input(z.object({ startsAt: z.coerce.date().optional(), endsAt: z.coerce.date().optional() }).optional()).query(async ({ ctx, input }) => {
        const context = await requireModule(ctx.user.id, "finance");
        return getTrialBalanceReport(context.organization.id, input ?? {});
      }),
      profitAndLoss: protectedProcedure.input(z.object({ startsAt: z.coerce.date().optional(), endsAt: z.coerce.date().optional() }).optional()).query(async ({ ctx, input }) => {
        const context = await requireModule(ctx.user.id, "finance");
        return getProfitAndLossReport(context.organization.id, input ?? {});
      }),
      balanceSheet: protectedProcedure.input(z.object({ startsAt: z.coerce.date().optional(), endsAt: z.coerce.date().optional() }).optional()).query(async ({ ctx, input }) => {
        const context = await requireModule(ctx.user.id, "finance");
        return getBalanceSheetReport(context.organization.id, input ?? {});
      }),
      cashFlow: protectedProcedure.input(z.object({ startsAt: z.coerce.date().optional(), endsAt: z.coerce.date().optional() }).optional()).query(async ({ ctx, input }) => {
        const context = await requireModule(ctx.user.id, "finance");
        return getCashFlowReport(context.organization.id, input ?? {});
      }),
    }),
    posting: router({
      salesInvoice: protectedProcedure.input(z.object({ invoiceId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const context = await requireFinanceOwner(ctx.user.id);
        return postSalesInvoice(context.organization.id, ctx.user.id, input.invoiceId);
      }),
      purchaseOrder: protectedProcedure.input(z.object({ purchaseOrderId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const context = await requireFinanceOwner(ctx.user.id);
        return postPurchaseOrder(context.organization.id, ctx.user.id, input.purchaseOrderId);
      }),
      collection: protectedProcedure.input(z.object({ financialTransactionId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const context = await requireFinanceOwner(ctx.user.id);
        return postCollection(context.organization.id, ctx.user.id, input.financialTransactionId);
      }),
      productionMaterialIssue: protectedProcedure.input(z.object({ productionOrderId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const context = await requireFinanceOwner(ctx.user.id);
        return postProductionMaterialIssue(context.organization.id, ctx.user.id, input.productionOrderId);
      }),
      productionOutput: protectedProcedure.input(z.object({ productionOutputId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const context = await requireFinanceOwner(ctx.user.id);
        return postProductionOutput(context.organization.id, ctx.user.id, input.productionOutputId);
      }),
      inventoryAdjustment: protectedProcedure.input(z.object({ stockMovementId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const context = await requireFinanceOwner(ctx.user.id);
        return postInventoryAdjustment(context.organization.id, ctx.user.id, input.stockMovementId);
      }),
      distributionCollection: protectedProcedure.input(z.object({ collectionId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const context = await requireFinanceOwner(ctx.user.id);
        return postDistributionCollection(context.organization.id, ctx.user.id, input.collectionId);
      }),
      distributionRouteExpense: protectedProcedure.input(z.object({ expenseId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const context = await requireFinanceOwner(ctx.user.id);
        return postDistributionRouteExpense(context.organization.id, ctx.user.id, input.expenseId);
      }),
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

  uom: router({
    catalog: protectedProcedure.query(() => listUomCatalog()),
    packaging: protectedProcedure.input(z.object({ productId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const context = await getTenantContext(ctx.user.id);
      return listProductPackaging(context.organization.id, input.productId);
    }),
    logistics: protectedProcedure.input(z.object({ lines: z.array(z.object({ productId: z.number().int().positive(), packagingLevelId: z.number().int().positive(), quantity: z.union([z.string().regex(/^\d+(\.\d+)?$/), z.number().positive()]) })).min(1).max(200) })).query(async ({ ctx, input }) => {
      const context = await getTenantContext(ctx.user.id);
      const summary = await calculatePackagingLogistics(context.organization.id, input.lines);
      const vehicles = await findSuitableVehicles(context.organization.id, summary);
      return { summary, vehicles };
    }),
  }),
  manufacturing: router({
    overview: protectedProcedure.query(async ({ ctx }) => {
      const context = await requireManufacturingPermission(ctx.user.id, "manufacturing.view");
      return getManufacturingOverview(context.organization.id, context.membership.dataScope);
    }),
    orders: protectedProcedure.query(async ({ ctx }) => {
      const context = await requireManufacturingPermission(ctx.user.id, "manufacturing.view");
      return listProductionOrders(context.organization.id, context.membership.dataScope);
    }),
    capabilities: protectedProcedure.query(async ({ ctx }) => {
      const context = await requireModule(ctx.user.id, "manufacturing");
      const permissions = await getOrganizationRolePermissions(context.organization.id, context.membership.roleKey);
      const capabilities = Object.fromEntries(["manufacturing.view", "manufacturing.order.create", "manufacturing.order.plan", "manufacturing.order.approve", "manufacturing.order.start", "manufacturing.order.complete", "manufacturing.order.close", "manufacturing.materials.reserve", "manufacturing.materials.issue", "manufacturing.materials.return", "manufacturing.consumption.record", "manufacturing.output.record", "manufacturing.waste.record", "manufacturing.scrap.record", "manufacturing.rework.record", "manufacturing.quality.inspect", "manufacturing.quality.approve", "manufacturing.batch.release", "manufacturing.costs.view", "manufacturing.costs.edit", "manufacturing.reports.view", "manufacturing.reports.export"].map(permission => [permission, canUseManufacturingPermission(context.membership.roleKey, permissions, permission as ManufacturingPermission)]));
      return { roleKey: context.membership.roleKey, capabilities };
    }),
    operationalOptions: protectedProcedure.query(async ({ ctx }) => {
      const context = await requireManufacturingPermission(ctx.user.id, "manufacturing.view");
      const [options, members] = await Promise.all([
        getManufacturingOperationalOptions(context.organization.id, context.membership.dataScope),
        listOrganizationMembersForOrganization(context.organization.id),
      ]);
      const responsibleUsers = (await Promise.all(members.filter(member => member.status === "active").map(async member => {
        const permissions = await getOrganizationRolePermissions(context.organization.id, member.roleKey);
        const canOperate = canUseManufacturingPermission(member.roleKey, permissions, "manufacturing.order.start") || canUseManufacturingPermission(member.roleKey, permissions, "manufacturing.order.complete");
        return canOperate ? { userId: member.userId, name: member.name ?? member.email ?? `#${member.userId}`, roleKey: member.roleKey } : null;
      }))).filter((member): member is { userId: number; name: string; roleKey: string } => Boolean(member));
      return { ...options, responsibleUsers };
    }),
    orderDetails: protectedProcedure.input(z.object({ productionOrderId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const context = await requireManufacturingOrderPermission(ctx.user.id, "manufacturing.view", input.productionOrderId);
      const permissions = await getOrganizationRolePermissions(context.organization.id, context.membership.roleKey);
      const includeCosts = canUseManufacturingPermission(context.membership.roleKey, permissions, "manufacturing.costs.view");
      return getProductionOrderOperationalDetails(context.organization.id, input.productionOrderId, includeCosts);
    }),
    saveProductProfile: protectedProcedure.input(z.object({ productId: z.number().int().positive(), manufacturingType: z.enum(["raw_material", "packaging_material", "semi_finished", "finished_good", "consumable", "by_product"]), requiresQualityCheck: z.enum(["yes", "no"]).optional(), defaultShelfLifeDays: z.number().int().nonnegative().optional() })).mutation(async ({ ctx, input }) => {
      const context = await requireManufacturingPermission(ctx.user.id, "manufacturing.bom.edit");
      return saveManufacturingProductProfile(context.organization.id, ctx.user.id, input);
    }),
    createBom: protectedProcedure.input(z.object({ code: z.string().trim().min(2).max(64), version: z.string().trim().min(1).max(32), productId: z.number().int().positive(), outputQuantity: z.number().positive(), outputUnit: z.string().trim().min(1).max(32), notes: z.string().trim().max(2000).optional(), items: z.array(z.object({ componentProductId: z.number().int().positive(), quantity: z.number().positive(), unit: z.string().trim().min(1).max(32), baseQuantity: z.number().positive(), wasteAllowance: z.number().min(0).max(100).optional(), stageCode: z.string().trim().max(64).optional(), required: z.enum(["yes", "no"]).optional() })).min(1).max(200) })).mutation(async ({ ctx, input }) => {
      const context = await requireManufacturingPermission(ctx.user.id, "manufacturing.bom.create");
      return createManufacturingBom(context.organization.id, ctx.user.id, input);
    }),
    createOrder: protectedProcedure.input(z.object({ bomId: z.number().int().positive(), plannedQuantity: z.number().positive(), plannedUnit: z.string().trim().min(1).max(32), baseQuantity: z.number().positive(), rawMaterialWarehouseId: z.number().int().positive(), finishedGoodsWarehouseId: z.number().int().positive(), branchId: z.number().int().positive().optional(), productionLineId: z.number().int().positive().optional(), responsibleUserId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
      const context = await requireManufacturingPermission(ctx.user.id, "manufacturing.order.create");
      assertManufacturingScope(context, input);
      return createProductionOrder(context.organization.id, ctx.user.id, input);
    }),
    reserveMaterials: protectedProcedure.input(z.object({ productionOrderId: z.number().int().positive(), overrideReason: z.string().trim().min(3).max(1000).optional() })).mutation(async ({ ctx, input }) => {
      const context = await requireManufacturingOrderPermission(ctx.user.id, "manufacturing.materials.reserve", input.productionOrderId);
      return reserveProductionMaterials(context.organization.id, ctx.user.id, input.productionOrderId, input.overrideReason);
    }),
    issueMaterials: protectedProcedure.input(z.object({ productionOrderId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const context = await requireManufacturingOrderPermission(ctx.user.id, "manufacturing.materials.issue", input.productionOrderId);
      const issued = await issueMaterialsForProduction(context.organization.id, ctx.user.id, input.productionOrderId);
      await postWhenFinanceEnabled(context, () => postProductionMaterialIssue(context.organization.id, ctx.user.id, input.productionOrderId));
      return issued;
    }),
    returnMaterials: protectedProcedure.input(z.object({ productionOrderId: z.number().int().positive(), items: z.array(z.object({ reservationId: z.number().int().positive(), quantity: z.number().positive() })).min(1).max(200) })).mutation(async ({ ctx, input }) => {
      const context = await requireManufacturingOrderPermission(ctx.user.id, "manufacturing.materials.return", input.productionOrderId);
      return returnMaterialsFromProduction(context.organization.id, ctx.user.id, input.productionOrderId, input.items);
    }),
    updateStage: protectedProcedure.input(z.object({ productionOrderId: z.number().int().positive(), stageId: z.number().int().positive(), status: z.enum(["pending", "in_progress", "completed", "blocked", "skipped"]), responsibleUserId: z.number().int().positive().optional(), notes: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
      const permission = input.status === "completed" ? "manufacturing.order.complete" : "manufacturing.order.start" as const;
      const context = await requireManufacturingOrderPermission(ctx.user.id, permission, input.productionOrderId);
      return updateProductionStage(context.organization.id, ctx.user.id, input);
    }),
    recordOutput: protectedProcedure.input(z.object({ productionOrderId: z.number().int().positive(), lotNumber: z.string().trim().min(2).max(96), goodQuantity: z.number().positive(), defectiveQuantity: z.number().nonnegative().optional(), reworkQuantity: z.number().nonnegative().optional(), scrapQuantity: z.number().nonnegative().optional(), manufacturingDate: z.coerce.date().optional(), expiryDate: z.coerce.date().optional() })).mutation(async ({ ctx, input }) => {
      const context = await requireManufacturingOrderPermission(ctx.user.id, "manufacturing.output.record", input.productionOrderId);
      const output = await recordProductionOutput(context.organization.id, ctx.user.id, input.productionOrderId, input);
      await postWhenFinanceEnabled(context, () => postProductionOutput(context.organization.id, ctx.user.id, output.outputId));
      return output;
    }),
    qualityCheck: protectedProcedure.input(z.object({ productionOrderId: z.number().int().positive(), productionOutputId: z.number().int().positive(), checkType: z.string().trim().min(2).max(120), result: z.enum(["pass", "fail"]), numericValue: z.number().finite().optional(), notes: z.string().trim().max(2000).optional(), checkedAt: z.coerce.date().optional() })).mutation(async ({ ctx, input }) => {
      const context = await requireManufacturingOrderPermission(ctx.user.id, input.result === "pass" ? "manufacturing.quality.approve" : "manufacturing.quality.inspect", input.productionOrderId);
      if (input.result === "pass") await requireManufacturingOrderPermission(ctx.user.id, "manufacturing.batch.release", input.productionOrderId);
      return recordProductionQualityCheck(context.organization.id, ctx.user.id, input);
    }),
    recordWaste: protectedProcedure.input(z.object({ productionOrderId: z.number().int().positive(), productionOutputId: z.number().int().positive(), defectiveQuantity: z.number().nonnegative().optional(), reworkQuantity: z.number().nonnegative().optional(), scrapQuantity: z.number().nonnegative().optional(), reason: z.string().trim().max(1000).optional() })).mutation(async ({ ctx, input }) => {
      const context = await requireManufacturingOrderPermission(ctx.user.id, "manufacturing.waste.record", input.productionOrderId);
      if ((input.scrapQuantity ?? 0) > 0) await requireManufacturingOrderPermission(ctx.user.id, "manufacturing.scrap.record", input.productionOrderId);
      if ((input.reworkQuantity ?? 0) > 0) await requireManufacturingOrderPermission(ctx.user.id, "manufacturing.rework.record", input.productionOrderId);
      return recordProductionWaste(context.organization.id, ctx.user.id, input);
    }),
    recordExpense: protectedProcedure.input(z.object({ productionOrderId: z.number().int().positive(), category: z.enum(["labor", "energy", "cleaning", "setup", "other"]), amount: z.number().positive(), currencyCode: z.string().trim().length(3), notes: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
      const context = await requireManufacturingOrderPermission(ctx.user.id, "manufacturing.costs.edit", input.productionOrderId);
      return recordProductionExpense(context.organization.id, ctx.user.id, input);
    }),
    closeOrder: protectedProcedure.input(z.object({ productionOrderId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const context = await requireManufacturingOrderPermission(ctx.user.id, "manufacturing.order.close", input.productionOrderId);
      return closeProductionOrder(context.organization.id, ctx.user.id, input.productionOrderId);
    }),
    traceability: protectedProcedure.input(z.object({ productionOrderId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const context = await requireManufacturingOrderPermission(ctx.user.id, "manufacturing.view", input.productionOrderId);
      return getProductionTraceability(context.organization.id, input.productionOrderId);
    }),
    batchGenealogy: protectedProcedure.input(z.object({ batchId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const context = await requireManufacturingPermission(ctx.user.id, "manufacturing.view");
      const genealogy = await getProductionBatchGenealogy(context.organization.id, input.batchId);
      const relatedOrders = [...genealogy.usedAsRawMaterial.map(item => item.order), ...genealogy.finishedFrom.map(item => item.order)];
      if (relatedOrders.some(order => !canAccessManufacturingOrderScope(context.membership.dataScope, order))) throw new TRPCError({ code: "FORBIDDEN", message: "التتبّع المطلوب يتضمن أمراً خارج نطاق بيانات عضويتك." });
      return genealogy;
    }),
    transitionOrder: protectedProcedure.input(z.object({ productionOrderId: z.number().int().positive(), nextStatus: z.enum(["planned", "approved", "in_production", "quality_hold", "completed", "closed", "cancelled"]) })).mutation(async ({ ctx, input }) => {
      const permissionByStatus = { planned: "manufacturing.order.plan", approved: "manufacturing.order.approve", in_production: "manufacturing.order.start", quality_hold: "manufacturing.quality.inspect", completed: "manufacturing.order.complete", closed: "manufacturing.order.close", cancelled: "manufacturing.order.plan" } as const;
      const context = await requireManufacturingOrderPermission(ctx.user.id, permissionByStatus[input.nextStatus], input.productionOrderId);
      return transitionProductionOrderStatus(context.organization.id, ctx.user.id, input.productionOrderId, input.nextStatus);
    }),
  }),
  b2b: router({
    accesses: protectedProcedure.query(({ ctx }) => listRetailerAccesses(ctx.user.id)),
    management: router({
      accesses: protectedProcedure.query(async ({ ctx }) => {
        const context = await requireRetailPermission(ctx.user.id, "retail.admin.view");
        return listManagedRetailerAccesses(context.organization.id);
      }),
      lookupUser: protectedProcedure.input(z.object({ email: z.string().trim().email().max(320) })).query(async ({ ctx, input }) => {
        await requireRetailPermission(ctx.user.id, "retail.access.manage");
        return lookupRetailerUserByEmail(input.email);
      }),
      orders: protectedProcedure.query(async ({ ctx }) => {
        const context = await requireRetailPermission(ctx.user.id, "retail.orders.manage");
        return listOrganizationB2bOrders(context.organization.id);
      }),
      returns: protectedProcedure.query(async ({ ctx }) => {
        const context = await requireRetailPermission(ctx.user.id, "retail.orders.manage");
        return listOrganizationRetailerReturnRequests(context.organization.id);
      }),
      reviewReturn: protectedProcedure.input(z.object({ requestId: z.number().int().positive(), action: z.enum(["under_review", "approved", "rejected"]), note: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
        const context = await requireRetailPermission(ctx.user.id, "retail.orders.manage");
        return reviewRetailerReturnRequest(context.organization.id, ctx.user.id, input);
      }),
      promotions: protectedProcedure.query(async ({ ctx }) => {
        const context = await requireRetailPermission(ctx.user.id, "retail.visibility.manage");
        return listOrganizationRetailerPromotions(context.organization.id);
      }),
      grant: protectedProcedure.input(z.object({ customerId: z.number().int().positive(), userId: z.number().int().positive(), retailerRole: z.enum(["owner", "buyer", "accountant", "store_manager", "viewer"]).optional(), outletIds: z.array(z.number().int().positive()).max(100).optional(), priceListId: z.number().int().positive().optional(), customerSegment: z.string().trim().max(96).optional(), territoryId: z.number().int().positive().optional(), deliveryTrackingPolicy: z.enum(["off", "status_only", "eta_only", "limited_live"]).optional(), availabilityDisclosure: z.enum(["available", "low", "request"]).optional(), permissions: z.record(z.string(), z.boolean()).optional() })).mutation(async ({ ctx, input }) => {
        const context = await requireRetailPermission(ctx.user.id, "retail.access.manage");
        return grantRetailerAccess(context.organization.id, ctx.user.id, input);
      }),
      invite: protectedProcedure.input(z.object({ customerId: z.number().int().positive(), userId: z.number().int().positive(), retailerRole: z.enum(["owner", "buyer", "accountant", "store_manager", "viewer"]).optional(), outletIds: z.array(z.number().int().positive()).max(100).optional(), priceListId: z.number().int().positive().optional(), customerSegment: z.string().trim().max(96).optional(), territoryId: z.number().int().positive().optional(), deliveryTrackingPolicy: z.enum(["off", "status_only", "eta_only", "limited_live"]).optional(), availabilityDisclosure: z.enum(["available", "low", "request"]).optional(), permissions: z.record(z.string(), z.boolean()).optional() })).mutation(async ({ ctx, input }) => {
        const context = await requireRetailPermission(ctx.user.id, "retail.access.manage");
        return inviteRetailerAccess(context.organization.id, ctx.user.id, input);
      }),
      resendInvite: protectedProcedure.input(z.object({ accessId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const context = await requireRetailPermission(ctx.user.id, "retail.access.manage");
        return resendRetailerAccessInvite(context.organization.id, ctx.user.id, input.accessId);
      }),
      accessStatus: protectedProcedure.input(z.object({ accessId: z.number().int().positive(), status: z.enum(["active", "suspended", "revoked"]) })).mutation(async ({ ctx, input }) => {
        const context = await requireRetailPermission(ctx.user.id, "retail.access.manage");
        return updateRetailerAccessStatus(context.organization.id, ctx.user.id, input.accessId, input.status);
      }),
      visibility: protectedProcedure.input(z.object({ accessId: z.number().int().positive(), visibilityPolicy: z.object({ showCatalog: z.boolean().optional(), showPrices: z.boolean().optional(), showPromotions: z.boolean().optional(), showInvoices: z.boolean().optional(), showDeliveryNotes: z.boolean().optional(), showStatement: z.boolean().optional(), stockVisibility: z.enum(["hidden", "availability_only", "level", "exact"]).optional(), debtVisibility: z.enum(["hidden", "total_only", "invoice_breakdown"]).optional(), deliveryTracking: z.enum(["off", "status_only", "eta_only", "limited_near_delivery"]).optional(), allowRequestedDeliveryDate: z.boolean().optional(), allowReturnRequest: z.boolean().optional(), allowRetailerUserManagement: z.boolean().optional() }) })).mutation(async ({ ctx, input }) => {
        const context = await requireRetailPermission(ctx.user.id, "retail.visibility.manage");
        return updateRetailerVisibilityPolicy(context.organization.id, ctx.user.id, input.accessId, input.visibilityPolicy);
      }),
      promotion: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(180), type: z.enum(["percentage_discount", "fixed_discount", "special_price", "quantity_discount", "buy_x_get_y"]), productId: z.number().int().positive(), batchId: z.number().int().positive().optional(), customerId: z.number().int().positive().optional(), customerSegment: z.string().trim().max(96).optional(), territoryId: z.number().int().positive().optional(), minimumQuantity: z.number().positive().optional(), discountPercentage: z.number().min(0).max(100).optional(), discountAmount: z.number().nonnegative().optional(), specialPrice: z.number().nonnegative().optional(), buyQuantity: z.number().positive().optional(), getQuantity: z.number().positive().optional(), startsAt: z.coerce.date(), endsAt: z.coerce.date(), visibleToB2b: z.enum(["yes", "no"]).optional() })).mutation(async ({ ctx, input }) => {
        const context = await requireRetailPermission(ctx.user.id, "retail.visibility.manage");
        return createB2bPromotion(context.organization.id, ctx.user.id, input);
      }),
    }),
    outlets: router({
      list: protectedProcedure.input(z.object({ customerId: z.number().int().positive() })).query(async ({ ctx, input }) => {
        const context = await requireRetailPermission(ctx.user.id, "retail.outlets.manage");
        return listRetailerOutlets(context.organization.id, input.customerId);
      }),
      create: protectedProcedure.input(z.object({ customerId: z.number().int().positive(), code: z.string().trim().min(1).max(64), name: z.string().trim().min(1).max(160), address: z.string().trim().max(4000).optional(), wilaya: z.string().trim().max(120).optional(), commune: z.string().trim().max(120).optional(), deliveryInstructions: z.string().trim().max(2000).optional(), latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional(), territoryId: z.number().int().positive().optional() }).superRefine((input, validation) => { if ((input.latitude === undefined) !== (input.longitude === undefined)) validation.addIssue({ code: "custom", message: "يلزم إدخال خط العرض وخط الطول معاً." }); })).mutation(async ({ ctx, input }) => {
        const context = await requireRetailPermission(ctx.user.id, "retail.outlets.manage");
        return createRetailerOutlet(context.organization.id, ctx.user.id, input);
      }),
    }),
    outletsForAccess: protectedProcedure.input(z.object({ accessId: z.number().int().positive() })).query(({ ctx, input }) => listRetailerOutletsForAccess(ctx.user.id, input.accessId)),
    catalog: protectedProcedure.input(z.object({ accessId: z.number().int().positive(), query: z.string().trim().max(160).optional(), categoryId: z.number().int().positive().optional(), brandId: z.number().int().positive().optional(), favoritesOnly: z.boolean().optional() })).query(({ ctx, input }) => getRetailerCatalog(ctx.user.id, input.accessId, input)),
    favorites: router({
      list: protectedProcedure.input(z.object({ accessId: z.number().int().positive() })).query(({ ctx, input }) => listRetailerFavorites(ctx.user.id, input.accessId)),
      toggle: protectedProcedure.input(z.object({ accessId: z.number().int().positive(), productId: z.number().int().positive() })).mutation(({ ctx, input }) => toggleRetailerFavorite(ctx.user.id, input.accessId, input.productId)),
    }),
    frequent: protectedProcedure.input(z.object({ accessId: z.number().int().positive() })).query(({ ctx, input }) => getRetailerFrequentProducts(ctx.user.id, input.accessId)),
    promotions: protectedProcedure.input(z.object({ accessId: z.number().int().positive() })).query(({ ctx, input }) => listRetailerPromotions(ctx.user.id, input.accessId)),
    summary: protectedProcedure.input(z.object({ accessId: z.number().int().positive() })).query(({ ctx, input }) => getRetailerSummary(ctx.user.id, input.accessId)),
    report: router({
      monthly: protectedProcedure.input(z.object({ accessId: z.number().int().positive(), month: z.number().int().min(1).max(12), year: z.number().int().min(2020).max(2100) })).query(({ ctx, input }) => getRetailerMonthlyReport(ctx.user.id, input.accessId, input.month, input.year)),
    }),
    orders: router({
      list: protectedProcedure.input(z.object({ accessId: z.number().int().positive() })).query(({ ctx, input }) => listRetailerOrders(ctx.user.id, input.accessId)),
      create: protectedProcedure.input(z.object({ accessId: z.number().int().positive(), outletId: z.number().int().positive().optional(), clientOperationId: z.string().trim().min(8).max(128), notes: z.string().trim().max(2000).optional(), requestedDeliveryDate: z.coerce.date().optional(), lines: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().positive(), unit: z.string().trim().min(1).max(32).optional() })).min(1).max(100) })).mutation(({ ctx, input }) => createRetailerOrder(ctx.user.id, input.accessId, input)),
      reorder: protectedProcedure.input(z.object({ accessId: z.number().int().positive(), orderId: z.number().int().positive() })).mutation(({ ctx, input }) => reorderRetailerOrder(ctx.user.id, input.accessId, input.orderId)),
      cancel: protectedProcedure.input(z.object({ accessId: z.number().int().positive(), orderId: z.number().int().positive(), reason: z.string().trim().max(1000).optional() })).mutation(({ ctx, input }) => cancelRetailerOrder(ctx.user.id, input.accessId, input.orderId, input.reason)),
    }),
    returns: router({
      list: protectedProcedure.input(z.object({ accessId: z.number().int().positive() })).query(({ ctx, input }) => listRetailerReturnRequests(ctx.user.id, input.accessId)),
      create: protectedProcedure.input(z.object({ accessId: z.number().int().positive(), orderId: z.number().int().positive(), reason: z.string().trim().min(3).max(2000) })).mutation(({ ctx, input }) => createRetailerReturnRequest(ctx.user.id, input.accessId, input)),
    }),
    savedLists: router({
      list: protectedProcedure.input(z.object({ accessId: z.number().int().positive() })).query(({ ctx, input }) => listSavedRetailerOrderLists(ctx.user.id, input.accessId)),
      create: protectedProcedure.input(z.object({ accessId: z.number().int().positive(), name: z.string().trim().min(1).max(160), lines: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().positive(), unit: z.string().trim().min(1).max(32).optional() })).min(1).max(100) })).mutation(({ ctx, input }) => createSavedRetailerOrderList(ctx.user.id, input.accessId, input)),
      submit: protectedProcedure.input(z.object({ accessId: z.number().int().positive(), listId: z.number().int().positive(), outletId: z.number().int().positive().optional(), clientOperationId: z.string().trim().min(8).max(128), notes: z.string().trim().max(2000).optional(), requestedDeliveryDate: z.coerce.date().optional() })).mutation(({ ctx, input }) => submitSavedRetailerOrderList(ctx.user.id, input.accessId, input)),
    }),
    review: protectedProcedure.input(z.object({ orderId: z.number().int().positive(), action: z.enum(["approve", "reject"]), reason: z.string().trim().max(1000).optional(), confirmedDeliveryDate: z.coerce.date().optional(), lines: z.array(z.object({ orderItemId: z.number().int().positive(), quantity: z.number().positive(), unitPrice: z.number().nonnegative().optional(), reason: z.string().trim().max(1000).optional() })).max(100).optional() })).mutation(async ({ ctx, input }) => {
      const context = await requireRetailPermission(ctx.user.id, "retail.orders.manage");
      return reviewAndConvertRetailerOrder(context.organization.id, ctx.user.id, input);
    }),
    documents: protectedProcedure.input(z.object({ accessId: z.number().int().positive() })).query(({ ctx, input }) => listRetailerDocuments(ctx.user.id, input.accessId)),
    notifications: protectedProcedure.input(z.object({ accessId: z.number().int().positive() })).query(({ ctx, input }) => listRetailerNotifications(ctx.user.id, input.accessId)),
    markNotificationRead: protectedProcedure.input(z.object({ accessId: z.number().int().positive(), notificationId: z.number().int().positive() })).mutation(({ ctx, input }) => markRetailerNotificationRead(ctx.user.id, input.accessId, input.notificationId)),
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
      documentAlerts: protectedProcedure.input(z.object({ thresholdDays: z.number().int().min(1).max(90).optional() }).optional()).query(async ({ ctx, input }) => {
        const context = await requireDistributionPermission(ctx.user.id, "fleet.view");
        return listFleetVehicleDocumentAlerts(context.organization.id, input?.thresholdDays ?? 30);
      }),
      inventory: protectedProcedure.input(z.object({ vehicleId: z.number().int().positive() })).query(async ({ ctx, input }) => {
        const context = await requireDistributionPermission(ctx.user.id, "distribution.view");
        assertDistributionScope(context, { vehicleId: input.vehicleId });
        return listVehicleInventory(context.organization.id, input.vehicleId);
      }),
      create: protectedProcedure.input(z.object({ code: z.string().trim().min(2).max(48), registrationNumber: z.string().trim().min(2).max(96), type: z.string().trim().min(2).max(80), brand: z.string().trim().max(80).optional(), model: z.string().trim().max(80).optional(), modelYear: z.number().int().min(1900).max(2100).optional(), branchId: z.number().int().positive().optional(), ownerPartyId: z.number().int().positive().optional(), ownershipType: z.enum(["owned", "leased", "external"]), driverEmployeeId: z.number().int().positive().optional(), representativeEmployeeId: z.number().int().positive().optional(), maximumPayloadWeight: z.number().nonnegative(), maximumVolume: z.number().nonnegative(), palletCapacity: z.number().int().nonnegative().optional(), insuranceStartAt: z.coerce.date().optional(), insuranceEndAt: z.coerce.date().optional(), technicalInspectionStartAt: z.coerce.date().optional(), technicalInspectionEndAt: z.coerce.date().optional() }).superRefine((input, context) => { if ((input.insuranceStartAt === undefined) !== (input.insuranceEndAt === undefined)) context.addIssue({ code: "custom", message: "يلزم إدخال تاريخ بداية ونهاية التأمين معاً." }); if ((input.technicalInspectionStartAt === undefined) !== (input.technicalInspectionEndAt === undefined)) context.addIssue({ code: "custom", message: "يلزم إدخال تاريخ بداية ونهاية المراقبة التقنية معاً." }); if (input.insuranceStartAt && input.insuranceEndAt && input.insuranceEndAt <= input.insuranceStartAt) context.addIssue({ code: "custom", message: "انتهاء التأمين يجب أن يكون بعد البداية." }); if (input.technicalInspectionStartAt && input.technicalInspectionEndAt && input.technicalInspectionEndAt <= input.technicalInspectionStartAt) context.addIssue({ code: "custom", message: "انتهاء المراقبة التقنية يجب أن يكون بعد البداية." }); })).mutation(async ({ ctx, input }) => {
        const context = await requireDistributionPermission(ctx.user.id, "fleet.editVehicle");
        assertDistributionScope(context, { branchId: input.branchId });
        return createFleetVehicle(context.organization.id, ctx.user.id, input);
      }),
      document: protectedProcedure.input(z.object({ vehicleId: z.number().int().positive(), documentType: z.enum(["insurance", "technical_inspection", "registration", "other"]), referenceNumber: z.string().trim().max(96).optional(), issuedAt: z.coerce.date().optional(), expiresAt: z.coerce.date().optional(), attachmentUrl: z.string().url().max(1024).optional() }).refine(input => !input.issuedAt || !input.expiresAt || input.expiresAt > input.issuedAt, { message: "انتهاء الوثيقة يجب أن يكون بعد تاريخ بدايتها." })).mutation(async ({ ctx, input }) => {
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
      create: protectedProcedure.input(z.object({ code: z.string().trim().min(2).max(48), name: z.string().trim().min(2).max(160), latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional(), branchId: z.number().int().positive().optional(), representativeEmployeeId: z.number().int().positive().optional(), defaultVehicleId: z.number().int().positive().optional() }).refine(input => (input.latitude === undefined) === (input.longitude === undefined), { message: "يلزم إدخال خط العرض وخط الطول معاً." })).mutation(async ({ ctx, input }) => {
        const context = await requireDistributionPermission(ctx.user.id, "distribution.editRoute");
        assertDistributionScope(context, { branchId: input.branchId, vehicleId: input.defaultVehicleId });
        return createDistributionTerritory(context.organization.id, ctx.user.id, input);
      }),
    }),
    customers: protectedProcedure.query(async ({ ctx }) => {
      const context = await requireDistributionPermission(ctx.user.id, "distribution.view");
      return listActiveCustomersForOrganization(context.organization.id);
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
      vanSale: protectedProcedure.input(z.object({ routeId: z.number().int().positive(), customerId: z.number().int().positive().optional(), productId: z.number().int().positive(), quantity: z.number().positive(), unit: z.string().trim().min(1).max(32), idempotencyKey: z.string().trim().min(8).max(128), paymentAmount: z.number().positive().optional() })).mutation(async ({ ctx, input }) => {
        const context = await requireDistributionPermission(ctx.user.id, "distribution.deliver");
        assertDistributionScope(context, { routeId: input.routeId });
        if (!context.membership.dataScope?.assignedRouteIds?.includes(input.routeId)) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك تنفيذ بيع من جولة غير مسندة إليك." });
        return createDriverVanSale(context.organization.id, ctx.user.id, { ...input, currencyCode: context.organization.baseCurrency });
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
        const delivery = await recordDistributionDelivery(context.organization.id, ctx.user.id, input);
        if (!delivery.replayed) await createDeliveryCommissionFromCompletedDelivery(context.organization.id, ctx.user.id, delivery.id);
        return delivery;
      }),
    }),
    collections: router({
      record: protectedProcedure.input(z.object({ routeId: z.number().int().positive(), customerId: z.number().int().positive(), salesInvoiceId: z.number().int().positive().optional(), representativeEmployeeId: z.number().int().positive().optional(), driverEmployeeId: z.number().int().positive().optional(), collectionType: z.enum(["cash_sale", "current_invoice", "previous_debt"]), amount: z.number().positive(), currencyCode: z.string().trim().length(3), exchangeRateUsed: z.number().positive().optional(), paymentMethod: z.enum(["cash", "card", "transfer", "check", "other"]).optional(), idempotencyKey: z.string().trim().min(8).max(128) })).mutation(async ({ ctx, input }) => {
        const context = await requireDistributionPermission(ctx.user.id, "distribution.collect");
        assertDistributionScope(context, { routeId: input.routeId });
        const collection = await recordDistributionCollection(context.organization.id, ctx.user.id, input);
        if (!collection.replayed) await createCollectionCommissionFromDistributionReceipt(context.organization.id, ctx.user.id, collection.id);
        if (!collection.replayed) await postWhenFinanceEnabled(context, () => postDistributionCollection(context.organization.id, ctx.user.id, collection.id));
        return collection;
      }),
    }),
    returns: router({
      record: protectedProcedure.input(z.object({ routeId: z.number().int().positive(), customerId: z.number().int().positive().optional(), deliveryId: z.number().int().positive().optional(), salesInvoiceId: z.number().int().positive().optional(), productId: z.number().int().positive(), vehicleBatchId: z.number().int().positive(), quantity: z.number().positive(), unit: z.string().trim().min(1).max(32), reason: z.string().trim().max(240).optional(), condition: z.enum(["resalable", "damaged", "quarantined"]), idempotencyKey: z.string().trim().min(8).max(128) })).mutation(async ({ ctx, input }) => {
        const context = await requireDistributionPermission(ctx.user.id, "distribution.deliver");
        assertDistributionScope(context, { routeId: input.routeId });
        const returned = await recordDistributionReturn(context.organization.id, ctx.user.id, input);
        if (!returned.replayed) await reverseDeliveryCommissionFromReturn(context.organization.id, ctx.user.id, returned.id);
        return returned;
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
        const expense = await addDistributionRouteExpense(context.organization.id, ctx.user.id, input);
        await postWhenFinanceEnabled(context, () => postDistributionRouteExpense(context.organization.id, ctx.user.id, expense.id));
        return expense;
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
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      const context = await getTenantContext(ctx.user.id);
      return markAllNotificationsRead(context.organization.id);
    }),
  }),

  ai: router({
    ask: protectedProcedure
      .input(z.object({ prompt: z.string().trim().min(3).max(1200) }))
      .mutation(async ({ ctx, input }) => {
        const context = await requireModule(ctx.user.id, "ai_assistant");
        const metrics = await getDashboardMetrics(context.organization.id);
        return askNawaAI({ organizationId: context.organization.id, userId: ctx.user.id, feature: "assistant", prompt: input.prompt, safeContext: { currency: context.organization.baseCurrency, metrics } });
      }),
    insight: protectedProcedure
      .input(z.object({ domain: z.enum(["commerce", "inventory", "manufacturing", "finance", "hr", "distribution"]) }))
      .mutation(async ({ ctx, input }) => {
        const context = await requireModule(ctx.user.id, "ai_assistant");
        if (input.domain === "manufacturing") {
          const manufacturingContext = await requireManufacturingPermission(ctx.user.id, "manufacturing.view");
          const manufacturing = await getManufacturingOverview(manufacturingContext.organization.id, manufacturingContext.membership.dataScope);
          return askNawaAI({ organizationId: manufacturingContext.organization.id, userId: ctx.user.id, feature: "manufacturing", prompt: "حلل مخاطر نقص المواد والإنتاج والجودة والهدر من الملخص المتاح فقط. قدّم توصية واحدة تتطلب موافقة بشرية.", safeContext: { manufacturing } });
        }
        if (input.domain === "finance") {
          await requireModule(ctx.user.id, "reports");
          const finance = await getFinancialReportSummary(context.organization.id);
          return askNawaAI({ organizationId: context.organization.id, userId: ctx.user.id, feature: "finance", prompt: "حلل مؤشرات التدفق النقدي والذمم والربحية من الملخص المالي فقط. لا تقدم توقعاً دقيقاً بلا بيانات كافية، وقدّم توصية واحدة تتطلب موافقة بشرية.", safeContext: { currency: context.organization.baseCurrency, finance } });
        }
        if (input.domain === "hr") {
          const hrContext = await requireHrOwner(ctx.user.id);
          const payroll = await getPayrollDashboard(hrContext.organization.id);
          return askNawaAI({ organizationId: hrContext.organization.id, userId: ctx.user.id, feature: "hr", prompt: "حلل مؤشرات الرواتب والسلف من الملخص الإجمالي فقط. لا تقترح قراراً آلياً عن موظف، وقدّم توصية واحدة تتطلب موافقة بشرية.", safeContext: { currency: hrContext.organization.baseCurrency, payroll } });
        }
        if (input.domain === "distribution") {
          const distributionContext = await requireDistributionPermission(ctx.user.id, "distribution.view");
          const distribution = await getDistributionControlCenter(distributionContext.organization.id);
          return askNawaAI({ organizationId: distributionContext.organization.id, userId: ctx.user.id, feature: "distribution", prompt: "حلل مخاطر الجولات والتحصيلات ووثائق المركبات من مركز التحكم المتاح فقط، وقدّم توصية واحدة تتطلب موافقة بشرية.", safeContext: { distribution } });
        }
        const commerce = await getCommerceReportSummary(context.organization.id);
        const prompt = input.domain === "commerce"
          ? "حلل مؤشرات التجارة وقدّم توصية واحدة قابلة للتنفيذ بعد موافقة بشرية، مع ذكر الدليل المتاح فقط."
          : "حلل مخاطر المخزون من المؤشرات المتاحة وقدّم توصية واحدة قابلة للتنفيذ بعد موافقة بشرية، مع ذكر الدليل المتاح فقط.";
        return askNawaAI({ organizationId: context.organization.id, userId: ctx.user.id, feature: input.domain, prompt, safeContext: { currency: context.organization.baseCurrency, commerce } });
      }),
  }),

  alerts: router({
    listDecisionAlerts: protectedProcedure.query(async ({ ctx }) => {
      const context = await getTenantContext(ctx.user.id);
      const [metrics, notifications, distributionReasons] = await Promise.all([
        getDashboardMetrics(context.organization.id),
        listNotificationsForOrganization(context.organization.id),
        getDistributionOwnerAlertReasons(context.organization.id),
      ]);
      const generated = [
        ...(metrics.lowStockProducts > 0 ? [{ id: "inventory-low-stock", type: "inventory", priority: "high" as const, title: `مخزون منخفض: ${metrics.lowStockProducts} منتج`, detail: "تحتاج المنتجات عند أو دون نقطة إعادة الطلب إلى مراجعة وتوريد.", destination: "/commerce/products", actionLabel: "مراجعة المنتجات" }] : []),
        ...(metrics.overdueInvoices > 0 ? [{ id: "finance-overdue", type: "finance", priority: "high" as const, title: `فواتير متأخرة: ${metrics.overdueInvoices}`, detail: "تتطلب الفواتير المتأخرة متابعة التحصيل أو التسوية.", destination: "/finance/aging", actionLabel: "مراجعة الذمم" }] : []),
        ...(metrics.budgetExceeded ? [{ id: "finance-budget", type: "finance", priority: "high" as const, title: "تجاوز الميزانية الشهرية", detail: "المصروفات الشهرية المسجلة تجاوزت السقف المعتمد للمؤسسة.", destination: "/finance/reports", actionLabel: "مراجعة التقارير" }] : []),
        ...distributionReasons.map((detail, index) => ({ id: `distribution-${index}`, type: "distribution", priority: "medium" as const, title: "تنبيه أسطول وتشغيل", detail, destination: "/distribution/alerts", actionLabel: "مراجعة الأسطول" })),
      ];
      const persisted = notifications.map(notification => ({ id: `notification-${notification.id}`, notificationId: notification.id, type: notification.type, priority: notification.severity === "critical" ? "critical" as const : notification.severity === "warning" ? "high" as const : "medium" as const, title: notification.title, detail: notification.content, destination: notification.content.includes("مركبة") || notification.content.includes("صيانة") ? "/distribution/alerts" : notification.content.includes("فاتورة") ? "/finance/aging" : "/commerce/products", actionLabel: "فتح المعالجة", isRead: notification.isRead }));
      return [...generated, ...persisted];
    }),
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
