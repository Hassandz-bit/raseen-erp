import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

const transitionMutate = vi.fn();

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { name: "سائق تجريبي" } }) }));
vi.mock("@/components/Map", () => ({ MapView: () => <div data-testid="driver-map" /> }));
vi.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ language: "ar", direction: "rtl", formatDate: () => "16/08/2026" }) }));
vi.mock("@/lib/trpc", () => ({ trpc: { erp: { distribution: { driver: { myRoutes: { useQuery: () => ({ data: [{ id: 33, routeNumber: "RTE-33", routeDate: new Date(), status: "started", vehicleId: 8, vehicleCode: "V-8", stops: [{ id: 17, customerId: 72, sequence: 1, deliveryStatus: "pending", customerName: "عميل الاختبار", customerAddress: "الجزائر", customerLatitude: "36.75", customerLongitude: "3.05" }] }], isLoading: false, isError: false, refetch: vi.fn() }) }, transition: { useMutation: () => ({ mutate: transitionMutate, isPending: false }) } }, tracking: { location: { useMutation: () => ({ mutate: vi.fn() }) }, geofence: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } } } } } }));

import Driver from "./Driver";

describe("Driver UI", () => {
  it("يعرض الجولة المسندة فقط ويتطلب موافقة السائق قبل تفعيل مشاركة الموقع", () => {
    render(<Driver />);
    expect(screen.getByText("RTE-33")).toBeTruthy();
    expect(screen.getByText("عميل الاختبار")).toBeTruthy();
    expect(screen.getByTestId("driver-map")).toBeTruthy();
    const startTracking = screen.getByText("بدء مشاركة الموقع").closest("button");
    expect(startTracking?.disabled).toBe(true);
    fireEvent.click(screen.getByText("أوافق على مشاركة موقعي أثناء الجولة النشطة."));
    expect(startTracking?.disabled).toBe(false);
    fireEvent.click(screen.getByText("بدء التنفيذ"));
    expect(transitionMutate).toHaveBeenCalledWith({ routeId: 33, status: "in_progress" });
  });
});
