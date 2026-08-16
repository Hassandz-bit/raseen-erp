import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "./ThemeContext";

function PreferenceProbe() {
  const { preferences, updatePreferences } = useTheme();
  return <button onClick={() => updatePreferences({ fontFamily: "tajawal", fontScale: "extra_large", numeralStyle: "arabic_indic", moduleViewMode: "nawa_flow" })}>{preferences.fontFamily}</button>;
}

describe("مزود تفضيلات المظهر", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    ["density", "font", "accent", "radius", "sidebar", "fontScale", "numeralStyle"].forEach(key => document.documentElement.removeAttribute(`data-${key.replace(/[A-Z]/g, character => `-${character.toLowerCase()}`)}`));
    Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
  });

  it("يحفظ تفضيلات الخط والحجم ونمط الأرقام ويعكسها على سمات واجهة المستند", async () => {
    render(<ThemeProvider><PreferenceProbe /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button"));

    const stored = JSON.parse(localStorage.getItem("nawa-appearance") ?? "{}");
    expect(stored).toMatchObject({ fontFamily: "tajawal", fontScale: "extra_large", numeralStyle: "arabic_indic", moduleViewMode: "nawa_flow" });
    expect(document.documentElement.dataset).toMatchObject({ font: "tajawal", fontScale: "extra_large", numeralStyle: "arabic_indic" });
  });
});
