import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { LanguageProvider, useLanguage } from "./LanguageContext";

function LanguageProbe() {
  const { language, direction, setLanguage } = useLanguage();
  return <button onClick={() => setLanguage("fr")}>{`${language}:${direction}`}</button>;
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
});
