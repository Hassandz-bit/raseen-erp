import { describe, expect, it } from "vitest";
import { dashboardHeroCopy, documentPreviewActionLabels, getDirection, glossary, operationalPanelCopy, translations, workspaceAssistantCopy } from "./translations";

describe("i18n foundation", () => {
  it("يعرض اتجاه RTL للعربية وLTR للفرنسية والإنجليزية", () => {
    expect(getDirection("ar")).toBe("rtl");
    expect(getDirection("fr")).toBe("ltr");
    expect(getDirection("en")).toBe("ltr");
  });

  it("يوفر نفس مفاتيح التجربة المشتركة بكل اللغات المدعومة", () => {
    const baseKeys = Object.keys(translations.ar).sort();
    expect(Object.keys(translations.fr).sort()).toEqual(baseKeys);
    expect(Object.keys(translations.en).sort()).toEqual(baseKeys);
    expect(glossary.ar.inventory).toBeTruthy();
    expect(glossary.fr.inventory).toBeTruthy();
    expect(glossary.en.inventory).toBeTruthy();
  });

  it("يوفر مفردات معاينة الطباعة ومقاس الورق الحراري بكل لغة", () => {
    (['ar', 'fr', 'en'] as const).forEach(language => {
      expect(translations[language].thermalPaper).toBeTruthy();
      expect(translations[language].documentPreviewTitle).toBeTruthy();
    });
  });

  it("يوفر مفردات ملخص مساحة العمل والتنبيهات والاشتراك بكل لغة", () => {
    (['ar', 'fr', 'en'] as const).forEach(language => {
      expect(translations[language].financialSummary).toBeTruthy();
      expect(translations[language].notificationCenter).toBeTruthy();
      expect(translations[language].subscriptionModules).toBeTruthy();
    });
  });

  it("يوفر مفردات مؤشرات لوحة التحكم المالية بكل لغة", () => {
    (["ar", "fr", "en"] as const).forEach(language => {
      expect(translations[language].totalSalesMetric).toBeTruthy();
      expect(translations[language].netRevenueMetric).toBeTruthy();
      expect(translations[language].inventoryValueMetric).toBeTruthy();
      expect(translations[language].dueInvoicesMetric).toBeTruthy();
    });
  });

  it("يوفر مفردات التاريخ والوقت والفواصل الرقمية بكل لغة", () => {
    (["ar", "fr", "en"] as const).forEach(language => {
      expect(translations[language].timeFormat).toBeTruthy();
      expect(translations[language].firstDay).toBeTruthy();
      expect(translations[language].decimalSeparator).toBeTruthy();
      expect(translations[language].thousandsSeparator).toBeTruthy();
    });
  });

  it("يوفر مفردات مساعد مساحة العمل وإجراءات المعاينة الدقيقة بكل لغة", () => {
    (["ar", "fr", "en"] as const).forEach(language => {
      expect(workspaceAssistantCopy[language].assistantDescription).toBeTruthy();
      expect(workspaceAssistantCopy[language].evaluateDescription).toBeTruthy();
      expect(documentPreviewActionLabels[language].download).toBeTruthy();
      expect(documentPreviewActionLabels[language].print).toBeTruthy();
    });
  });

  it("يوفر مفردات ترحيب لوحة التحكم بكل لغة", () => {
    (["ar", "fr", "en"] as const).forEach(language => {
      expect(dashboardHeroCopy[language].welcome).toBeTruthy();
      expect(dashboardHeroCopy[language].title).toBeTruthy();
      expect(dashboardHeroCopy[language].description).toBeTruthy();
    });
  });

  it("يوفر مفردات إدارة الفروع ورسائل الحفظ بكل لغة", () => {
    (["ar", "fr", "en"] as const).forEach(language => {
      expect(translations[language].branchCode).toBeTruthy();
      expect(translations[language].branchName).toBeTruthy();
      expect(translations[language].branchCodeConflict).toBeTruthy();
      expect(translations[language].branchSaveError).toBeTruthy();
    });
  });

  it("يوفر مفردات إجراءات المالية والموارد البشرية بكل لغة", () => {
    (["ar", "fr", "en"] as const).forEach(language => {
      expect(translations[language].createTransaction).toBeTruthy();
      expect(translations[language].addEmployee).toBeTruthy();
    });
  });

  it("يوفر مفردات لوحة الوحدات التشغيلية بكل لغة", () => {
    (["ar", "fr", "en"] as const).forEach(language => {
      expect(operationalPanelCopy[language].title).toBeTruthy();
      expect(operationalPanelCopy[language].description).toBeTruthy();
      expect(operationalPanelCopy[language].optionalReference).toBeTruthy();
      expect(operationalPanelCopy[language].optionalValue).toBeTruthy();
    });
  });
});
