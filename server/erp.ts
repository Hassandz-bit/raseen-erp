import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createOperationalNotifications, createOperationalRecord, createOrganizationForUser, getDashboardMetrics, getDefaultTenantContext, getFinancialReportSummary, getOrCreateOrganizationSettings, getOrCreateUserPreferences, listNotificationsForOrganization, listOperationalRecords, listProductsForOrganization, markNotificationRead, updateOrganizationSettings, updateUserPreferences, type OperationalModule } from "./db";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import { protectedProcedure, router } from "./_core/trpc";
import { buildOwnerAlertReasons, canAccessTenantModule, hasActiveMembership } from "./tenantPolicy";

const moduleKeys = ["inventory", "sales", "purchases", "finance", "hr", "reports", "ai_assistant"] as const;
type ModuleKey = (typeof moduleKeys)[number];
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
      fontScale: z.enum(["small", "normal", "large"]).optional(),
      accentColor: z.enum(["gold", "blue", "emerald", "violet"]).optional(),
      radiusPreset: z.enum(["soft", "rounded", "sharp"]).optional(),
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
