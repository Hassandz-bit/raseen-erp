import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentPreviewActions } from "./DocumentPreviewActions";

describe("DocumentPreviewActions", () => {
  it("يعرض تسميات الإجراءات المترجمة ويستدعي التنزيل والطباعة بصورة مستقلة", () => {
    const onDownload = vi.fn();
    const onPrint = vi.fn();
    render(<DocumentPreviewActions onDownload={onDownload} onPrint={onPrint} downloadLabel="تنزيل ملف HTML" printLabel="طباعة أو حفظ PDF" />);

    fireEvent.click(screen.getByRole("button", { name: "تنزيل ملف HTML" }));
    fireEvent.click(screen.getByRole("button", { name: "طباعة أو حفظ PDF" }));

    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(onPrint).toHaveBeenCalledTimes(1);
  });
});
