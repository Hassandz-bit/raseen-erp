import { describe, expect, it } from "vitest";
import { buildProductLabelDocument, escapeLabelText, isLinearBarcodeCompatible, productLabelPrintStyles } from "./productLabelPrint";

describe("قالب ملصقات المنتجات", () => {
  it("يسمح بالقيم المناسبة للباركود الخطي ويحول غير المناسبة إلى QR فقط", () => {
    expect(isLinearBarcodeCompatible("EAN-123/ABC")).toBe(true);
    expect(isLinearBarcodeCompatible("رمز-123")).toBe(false);
  });

  it("يهرب بيانات المنتج ويحافظ على أبعاد الطباعة المختارة", () => {
    expect(escapeLabelText('منتج <مميز> & "آمن"')).toBe("منتج &lt;مميز&gt; &amp; &quot;آمن&quot;");
    expect(productLabelPrintStyles("small")).toContain("50mm");
    expect(productLabelPrintStyles("medium")).toContain("70mm");
    expect(buildProductLabelDocument("<article>Label</article>", "small", "ملصقات")).toContain("<article>Label</article>");
  });
});
