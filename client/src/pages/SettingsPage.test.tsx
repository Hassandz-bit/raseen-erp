import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ toastError: vi.fn(), toastSuccess: vi.fn(), createBranch: vi.fn(), markRead: vi.fn(), notificationRefetch: vi.fn(), logout: vi.fn(), saveOrganization: vi.fn(), section: "organization", branchMode: "conflict" as "conflict" | "success", notificationMode: "success" as "success" | "error", subscriptionMode: "ready" as "ready" | "suspended" | "empty" | "error" }));

vi.mock("@/components/DashboardLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</>, DashboardLayout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/ExchangeRatesPanel", () => ({ ExchangeRatesPanel: () => null }));
vi.mock("@/components/DocumentPreviewActions", () => ({ DocumentPreviewActions: () => null }));
vi.mock("@/contexts/ThemeContext", () => ({ useTheme: () => ({ preferences: { themeMode: "dark", numeralStyle: "western", sidebarMode: "expanded", density: "comfortable", fontFamily: "inter", fontScale: "medium", accentColor: "gold", radiusPreset: "large", moduleViewMode: "classic" }, updatePreferences: vi.fn(), resetPreferences: vi.fn() }) }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { name: "Marie Exemple", email: "marie@example.com" }, loading: false, logout: state.logout }) }));
vi.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ language: "fr", setLanguage: vi.fn(), formatOrganizationDate: () => "16/08/2026", t: (key: string) => ({ settings: "Paramètres", preferences: "Préférences", branches: "Succursales", branchCode: "Code", branchName: "Nom", createBranch: "Ajouter", branchCreated: "Succursale ajoutée", active: "Actif", inactive: "Inactif", branchCodeConflict: "Code déjà utilisé", branchSaveError: "Échec de sauvegarde", error: "Erreur", empty: "Vide", saved: "Enregistré", organization: "Organisation", language: "Langue", currencies: "Devises", exchangeRates: "Taux", dateAndNumbers: "Dates", appearance: "Apparence", typography: "Typographie", moduleView: "Modules", printing: "Impression", notifications: "Notifications", noNotifications: "Aucune notification", users: "Utilisateurs" })[key] ?? key }) }));
vi.mock("wouter", () => ({ useSearch: () => `section=${state.section}` }));
vi.mock("sonner", () => ({ toast: { success: state.toastSuccess, error: state.toastError } }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    erp: {
      bootstrap: { useQuery: () => ({ data: state.subscriptionMode === "empty" ? { modules: [] } : { modules: [{ key: "inventory", status: state.subscriptionMode === "suspended" ? "suspended" : "active" }] }, isLoading: false, isError: state.subscriptionMode === "error" }) },
      preferences: {
        user: { useQuery: () => ({ data: undefined }) }, organization: { useQuery: () => ({ data: undefined, refetch: vi.fn() }) }, currencyCatalog: { useQuery: () => ({ data: [] }) }, currencies: { useQuery: () => ({ data: [], refetch: vi.fn() }) }, branches: { useQuery: () => ({ data: [{ id: 1, name: "Alger", code: "ALG", status: "active" }], isLoading: false, isError: false, refetch: vi.fn() }) }, members: { useQuery: () => ({ data: [{ id: 9, userId: 3, name: "Marie Exemple", email: "marie@example.com", roleKey: "owner", status: "active" }], isLoading: false, isError: false }) },
        saveUser: { useMutation: () => ({ mutate: vi.fn() }) }, saveOrganization: { useMutation: () => ({ mutate: state.saveOrganization, isPending: false }) }, saveCurrency: { useMutation: () => ({ mutate: vi.fn() }) }, createBranch: { useMutation: (options: { onError: (error: { data?: { code?: string } }) => void; onSuccess: () => void }) => ({ mutate: (...args: unknown[]) => { state.createBranch(...args); state.branchMode === "success" ? options.onSuccess() : options.onError({ data: { code: "CONFLICT" } }); }, isPending: false }) },
      },
      notifications: { list: { useQuery: () => ({ data: [{ id: 7, title: "Alerte stock", content: "Le niveau minimal est atteint.", isRead: "no", createdAt: new Date("2026-08-16T09:00:00Z") }], isLoading: false, isError: false, refetch: state.notificationRefetch }) }, markRead: { useMutation: (options: { onSuccess: () => void; onError: () => void }) => ({ mutate: (input: unknown) => { state.markRead(input); state.notificationMode === "success" ? options.onSuccess() : options.onError(); }, isPending: false }) } },
    },
  },
}));

import SettingsPage from "./Settings";

afterEach(() => { cleanup(); state.section = "organization"; state.branchMode = "conflict"; state.notificationMode = "success"; state.subscriptionMode = "ready"; });

describe("قسم الأمان في الإعدادات", () => {
  it("يعرض الجلسة الحالية ويربط إجراء إنهائها", () => {
    state.logout.mockClear();
    state.section = "security";
    render(<SettingsPage />);
    expect(screen.getByText("Marie Exemple")).toBeTruthy();
    fireEvent.click(screen.getByText("Terminer la session"));
    expect(state.logout).toHaveBeenCalled();
  });
});

describe("قسم الاشتراكات في الإعدادات", () => {
  it("يعرض الوحدة وحالة وصولها", () => {
    state.subscriptionMode = "ready";
    state.section = "subscriptions";
    render(<SettingsPage />);
    expect(screen.getByText("inventory")).toBeTruthy();
    expect(screen.getByText("Actif")).toBeTruthy();
  });

  it("يعرض حالتي الفراغ والخطأ دون كشف بيانات اشتراك غير صالحة", () => {
    state.subscriptionMode = "empty";
    state.section = "subscriptions";
    const { unmount } = render(<SettingsPage />);
    expect(screen.getByText("Vide")).toBeTruthy();
    unmount();
    state.subscriptionMode = "error";
    state.section = "subscriptions";
    render(<SettingsPage />);
    expect(screen.getByText("Erreur")).toBeTruthy();
  });

  it("يعرض حالة الوحدة المعلقة كما وردت من الخادم", () => {
    state.subscriptionMode = "suspended";
    state.section = "subscriptions";
    render(<SettingsPage />);
    expect(screen.getByText("Suspendu")).toBeTruthy();
  });
});

describe("قسم الفروع في الإعدادات", () => {
  it("يعرض حالة الفرع الفعلية ويربط تعارض الرمز برسالة مترجمة", () => {
    state.branchMode = "conflict";
    state.section = "branches";
    render(<SettingsPage />);
    expect(screen.getByText("Alger")).toBeTruthy();
    expect(screen.getByText("Actif")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "ALG" } });
    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Alger centre" } });
    fireEvent.click(screen.getByText("Ajouter"));
    expect(state.createBranch).toHaveBeenCalledWith({ code: "ALG", name: "Alger centre" });
    expect(state.toastError).toHaveBeenCalledWith("Code déjà utilisé");
  });

  it("يعرض تأكيداً مترجماً عند نجاح إنشاء الفرع", () => {
    state.branchMode = "success";
    state.createBranch.mockClear();
    state.toastSuccess.mockClear();
    state.section = "branches";
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "ORN" } });
    fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Oran" } });
    fireEvent.click(screen.getByText("Ajouter"));
    expect(state.createBranch).toHaveBeenCalledWith({ code: "ORN", name: "Oran" });
    expect(state.toastSuccess).toHaveBeenCalledWith("Succursale ajoutée");
  });
});

describe("قسم الإشعارات في الإعدادات", () => {
  it("يعرض التنبيه ويعيد تحميله بعد التعليم كمقروء", () => {
    state.notificationMode = "success";
    state.markRead.mockClear();
    state.notificationRefetch.mockClear();
    state.section = "notifications";
    render(<SettingsPage />);
    expect(screen.getByText("Alerte stock")).toBeTruthy();
    fireEvent.click(screen.getByText("Marquer comme lu"));
    expect(state.markRead).toHaveBeenCalledWith({ notificationId: 7 });
    expect(state.notificationRefetch).toHaveBeenCalled();
  });

  it("يعرض رسالة مترجمة عند فشل التعليم كمقروء", () => {
    state.notificationMode = "error";
    state.toastError.mockClear();
    state.section = "notifications";
    render(<SettingsPage />);
    fireEvent.click(screen.getByText("Marquer comme lu"));
    expect(state.toastError).toHaveBeenCalledWith("Impossible de marquer la notification comme lue.");
  });
});

describe("قسم المستخدمين في الإعدادات", () => {
  it("يعرض عضوية المؤسسة ودورها وحالتها", () => {
    state.section = "users";
    render(<SettingsPage />);
    expect(screen.getByText("Marie Exemple")).toBeTruthy();
    expect(screen.getByText("marie@example.com")).toBeTruthy();
    expect(screen.getByText("Propriétaire")).toBeTruthy();
    expect(screen.getByText("Actif")).toBeTruthy();
  });
});

describe("إعدادات ضريبة القيمة المضافة", () => {
  it("يحفظ النسبة ووضع السعر ضمن إعدادات المستندات من الرابط السياقي", () => {
    state.saveOrganization.mockClear();
    state.section = "vat";
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText("Taux de TVA par défaut (%)"), { target: { value: "19" } });
    fireEvent.change(screen.getByLabelText("Mode de prix"), { target: { value: "inclusive" } });
    fireEvent.click(screen.getByText("Enregistrer les paramètres de TVA"));
    expect(state.saveOrganization).toHaveBeenLastCalledWith(expect.objectContaining({ documentSettings: expect.objectContaining({ vat: { defaultRate: 19, priceMode: "inclusive" } }) }));
  });
});
