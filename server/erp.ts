import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createOrganizationForUser, getDashboardMetrics, getDefaultTenantContext, listProductsForOrganization } from "./db";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import { protectedProcedure, router } from "./_core/trpc";
import { buildOwnerAlertReasons, canAccessTenantModule, hasActiveMembership } from "./tenantPolicy";

const moduleKeys = ["inventory", "sales", "purchases", "finance", "hr", "reports", "ai_assistant"] as const;
type ModuleKey = (typeof moduleKeys)[number];

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
