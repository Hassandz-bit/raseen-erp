import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: "fr", t: (key: string) => ({ inventory: "Stock", available: "Disponible", lowStock: "Faible", criticalStock: "Critique", paid: "Payée", collecting: "En recouvrement", overdue: "En retard" }[key] ?? key), formatNumber: (value: number) => new Intl.NumberFormat("fr-FR").format(value) }),
}));

import { ModuleView } from "./Home";

describe("ModuleView", () => {
  it("affiche le contenu français du module sans le texte de copie arabe hérité", () => {
    render(<ModuleView section="inventory" onBack={() => undefined} />);
    expect(screen.getByText("Une vision instantanée du stock")).toBeTruthy();
    expect(screen.getByText("Retour au tableau de bord")).toBeTruthy();
    expect(screen.getAllByText("Disponible").length).toBeGreaterThan(0);
    expect(screen.queryByText("رؤية لحظية للمخزون")).toBeNull();
  });
});
