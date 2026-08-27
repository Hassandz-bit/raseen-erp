import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "./ThemeContext";

function PreferenceProbe() {
  const { preferences, updatePreferences } = useTheme();
  return <button onClick={() => updatePreferences({ fontFamily: "tajawal", fontScale: "extra_large", sidebarFontScale: "extra_large", highContrast: true, tabletSidebarWidth: "wide", numeralStyle: "arabic_indic", moduleViewMode: "nawa_flow" })}>{preferences.fontFamily}</button>;
}

function ThemeToggleProbe() {
  const { theme, toggleTheme } = useTheme();
  return <button onClick={toggleTheme}>{theme}</button>;
}

describe("مزود تفضيلات المظهر", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    ["density", "font", "accent", "radius", "sidebar", "fontScale", "sidebarFontScale", "highContrast", "tabletSidebarWidth", "numeralStyle"].forEach(key => document.documentElement.removeAttribute(`data-${key.replace(/[A-Z]/g, character => `-${character.toLowerCase()}`)}`));
    Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
  });

  it("يحفظ تفضيلات الخط والحجم ونمط الأرقام ويعكسها على سمات واجهة المستند", async () => {
    render(<ThemeProvider><PreferenceProbe /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button"));

    const stored = JSON.parse(localStorage.getItem("nawa-appearance") ?? "{}");
    expect(stored).toMatchObject({ fontFamily: "tajawal", fontScale: "extra_large", sidebarFontScale: "extra_large", highContrast: true, tabletSidebarWidth: "wide", numeralStyle: "arabic_indic", moduleViewMode: "nawa_flow" });
    expect(document.documentElement.dataset).toMatchObject({ font: "tajawal", fontScale: "extra_large", sidebarFontScale: "extra_large", highContrast: "true", tabletSidebarWidth: "wide", numeralStyle: "arabic_indic" });
  });

  it("يبدل بين الوضعين الفاتح والداكن ويحفظ الاختيار", () => {
    render(<ThemeProvider defaultTheme="light"><ThemeToggleProbe /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "light" }));

    expect(screen.getByRole("button", { name: "dark" })).toBeTruthy();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(JSON.parse(localStorage.getItem("nawa-appearance") ?? "{}")).toMatchObject({ themeMode: "dark" });
  });
});
