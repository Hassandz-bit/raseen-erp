import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const languageState = vi.hoisted(() => ({ value: "fr" }));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => {
    const french = languageState.value === "fr";
    const labels = french ? { inventory: "Stock", available: "Disponible", lowStock: "Faible", criticalStock: "Critique", paid: "Payée", collecting: "En recouvrement", overdue: "En retard" } : { inventory: "Inventory", available: "Available", lowStock: "Low", criticalStock: "Critical", paid: "Paid", collecting: "In collection", overdue: "Overdue" };
    return { language: languageState.value, t: (key: string) => labels[key as keyof typeof labels] ?? key, formatNumber: (value: number) => new Intl.NumberFormat(french ? "fr-FR" : "en-US").format(value) };
  },
}));

import { ModuleView } from "./Home";

describe("ModuleView", () => {
  afterEach(() => cleanup());

  it("affiche le contenu français du module sans le texte de copie arabe hérité", () => {
    languageState.value = "fr";
    render(<ModuleView section="inventory" onBack={() => undefined} />);
    expect(screen.getByText("Une vision instantanée du stock")).toBeTruthy();
    expect(screen.getByText("Retour au tableau de bord")).toBeTruthy();
    expect(screen.getAllByText("Disponible").length).toBeGreaterThan(0);
    expect(screen.queryByText("رؤية لحظية للمخزون")).toBeNull();
  });

  it("renders English module copy without inherited Arabic text", () => {
    languageState.value = "en";
    render(<ModuleView section="inventory" onBack={() => undefined} />);
    expect(screen.getByText("Instant inventory visibility")).toBeTruthy();
    expect(screen.getByText("Back to dashboard")).toBeTruthy();
    expect(screen.getAllByText("Available").length).toBeGreaterThan(0);
    expect(screen.queryByText("رؤية لحظية للمخزون")).toBeNull();
  });
});
