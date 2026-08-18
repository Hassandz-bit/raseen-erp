import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { LanguageProvider, useLanguage } from "./LanguageContext";

function LanguageProbe() {
  const { language, direction, setLanguage, t } = useLanguage();
  return <><button onClick={() => setLanguage("fr")}>{`${language}:${direction}`}</button><output>{`${t("quality_hold" as never)}|${t("unmapped_status" as never)}`}</output></>;
}

describe("سياق اللغة", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/");
    document.documentElement.lang = "";
    document.documentElement.dir = "";
  });

  it("يحدث لغة واتجاه المستند ويحفظهما عند التبديل إلى الفرنسية", () => {
    render(<LanguageProvider><LanguageProbe /></LanguageProvider>);
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("button").textContent).toBe("fr:ltr");
    expect(document.documentElement.lang).toBe("fr");
    expect(document.documentElement.dir).toBe("ltr");
    expect(localStorage.getItem("nawa-language")).toBe("fr");
  });

  it("يعرض نصاً مفهوماً للحالات التشغيلية ولأي مفتاح ديناميكي غير معرف بدلاً من شارة فارغة", () => {
    render(<LanguageProvider><LanguageProbe /></LanguageProvider>);

    expect(screen.getAllByRole("status").at(-1)?.textContent).toBe("quality hold|unmapped status");
  });
});
