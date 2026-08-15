import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkspaceState } from "@/components/WorkspaceState";

describe("WorkspaceState", () => {
  it("يعرض حالات التحميل والفراغ والخطأ بتسميات مستقلة", () => {
    const { rerender } = render(<WorkspaceState label="جارٍ التحميل" loading />);
    expect(screen.getByText("جارٍ التحميل")).toBeTruthy();
    expect(screen.getByRole("status")).toBeTruthy();

    rerender(<WorkspaceState label="لا توجد بيانات" />);
    expect(screen.getByText("لا توجد بيانات")).toBeTruthy();

    rerender(<WorkspaceState label="تعذر التحميل" tone="error" />);
    expect(screen.getByText("تعذر التحميل")).toBeTruthy();
  });
});
