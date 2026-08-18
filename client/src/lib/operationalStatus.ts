import type { AppLanguage } from "@/i18n/translations";

const labels: Record<AppLanguage, Record<string, string>> = {
  ar: { active: "نشطة", closed: "مغلقة", planned: "مخططة", started: "بدأت", in_progress: "قيد التنفيذ", maintenance: "صيانة", expired: "منتهية", critical: "حرج", draft: "مسودة", approved: "معتمد", materials_reserved: "المواد محجوزة", in_production: "قيد الإنتاج", quality_hold: "قيد الجودة", completed: "مكتمل", delivered: "تم التسليم", arrived: "وصل", failed: "فشل", skipped: "تم التجاوز", new: "جديد" },
  fr: { active: "Actif", closed: "Clôturé", planned: "Planifié", started: "Démarré", in_progress: "En cours", maintenance: "Maintenance", expired: "Expiré", critical: "Critique", draft: "Brouillon", approved: "Approuvé", materials_reserved: "Matières réservées", in_production: "En production", quality_hold: "Contrôle qualité", completed: "Terminé", delivered: "Livré", arrived: "Arrivé", failed: "Échoué", skipped: "Ignoré", new: "Nouveau" },
  en: { active: "Active", closed: "Closed", planned: "Planned", started: "Started", in_progress: "In progress", maintenance: "Maintenance", expired: "Expired", critical: "Critical", draft: "Draft", approved: "Approved", materials_reserved: "Materials reserved", in_production: "In production", quality_hold: "Quality hold", completed: "Completed", delivered: "Delivered", arrived: "Arrived", failed: "Failed", skipped: "Skipped", new: "New" },
};

export function formatOperationalStatus(language: AppLanguage, status: string | null | undefined) {
  const normalized = status?.trim();
  if (!normalized) return "—";
  return labels[language][normalized] ?? normalized.replace(/[_-]+/g, " ");
}
