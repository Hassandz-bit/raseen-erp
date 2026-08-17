import { auditLogs } from "../drizzle/schema";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";

export type NawaAIFeature = "assistant" | "commerce" | "inventory" | "distribution" | "manufacturing" | "finance" | "hr";

export type NawaAIRecommendation = {
  recommendation: string;
  confidence: "low" | "medium" | "high";
  evidence: string[];
  proposedAction: string | null;
  requiresHumanApproval: true;
};

function parseRecommendation(content: unknown): NawaAIRecommendation {
  const fallback: NawaAIRecommendation = { recommendation: "تعذر إنشاء توصية موثوقة بالبيانات المتاحة.", confidence: "low", evidence: [], proposedAction: null, requiresHumanApproval: true };
  if (typeof content !== "string") return fallback;
  try {
    const parsed = JSON.parse(content) as Partial<NawaAIRecommendation>;
    if (typeof parsed.recommendation !== "string" || !["low", "medium", "high"].includes(String(parsed.confidence))) return fallback;
    return { recommendation: parsed.recommendation.slice(0, 1200), confidence: parsed.confidence as NawaAIRecommendation["confidence"], evidence: Array.isArray(parsed.evidence) ? parsed.evidence.filter(item => typeof item === "string").slice(0, 8) : [], proposedAction: typeof parsed.proposedAction === "string" ? parsed.proposedAction.slice(0, 300) : null, requiresHumanApproval: true };
  } catch { return fallback; }
}

export async function askNawaAI(input: { organizationId: number; userId: number; feature: NawaAIFeature; prompt: string; safeContext: Record<string, unknown> }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً.");
  const prompt = input.prompt.trim().slice(0, 1200);
  try {
    const response = await invokeLLM({
      model: "gpt-5-mini",
      maxTokens: 700,
      messages: [
        { role: "system", content: "أنت Nawa AI، مساعد ERP للقراءة والتحليل فقط. لا تنفذ عمليات ولا تطلب أسراراً أو بيانات بنكية أو رواتب تفصيلية. استخدم حصراً السياق المصرح به. أعد JSON صالحاً يطابق recommendation/confidence/evidence/proposedAction/requiresHumanApproval؛ يجب أن تكون requiresHumanApproval=true دائماً." },
        { role: "user", content: `الخاصية: ${input.feature}\nالسؤال: ${prompt}\nالسياق المعزول: ${JSON.stringify(input.safeContext)}` },
      ],
      response_format: { type: "json_schema", json_schema: { name: "nawa_recommendation", strict: true, schema: { type: "object", properties: { recommendation: { type: "string" }, confidence: { type: "string", enum: ["low", "medium", "high"] }, evidence: { type: "array", items: { type: "string" } }, proposedAction: { type: ["string", "null"] }, requiresHumanApproval: { type: "boolean", const: true } }, required: ["recommendation", "confidence", "evidence", "proposedAction", "requiresHumanApproval"], additionalProperties: false } } },
    });
    const result = parseRecommendation(response.choices[0]?.message.content);
    await db.insert(auditLogs).values({ organizationId: input.organizationId, actorUserId: input.userId, action: "nawa_ai.completed", entityType: "nawa_ai", entityId: input.feature, metadata: { feature: input.feature, status: "completed", model: "gpt-5-mini", promptLength: prompt.length, evidenceCount: result.evidence.length, requiresHumanApproval: true } });
    return { ...result, model: "gpt-5-mini", status: "completed" as const };
  } catch {
    await db.insert(auditLogs).values({ organizationId: input.organizationId, actorUserId: input.userId, action: "nawa_ai.unavailable", entityType: "nawa_ai", entityId: input.feature, metadata: { feature: input.feature, status: "configuration_or_provider_unavailable", promptLength: prompt.length } });
    return { recommendation: "خدمة Nawa AI غير متاحة حالياً أو تحتاج تهيئة. لم تُنشأ أي نتيجة بديلة أو عملية تلقائية.", confidence: "low" as const, evidence: [], proposedAction: null, requiresHumanApproval: true as const, model: null, status: "unavailable" as const };
  }
}
