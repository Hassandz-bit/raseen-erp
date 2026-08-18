import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/components/BarcodeScannerInput.tsx"), "utf8");

describe("مكوّن ماسح الباركود وQR", () => {
  it("يستخدم ماسح ZXing للكاميرا ويتحقق من إتاحة mediaDevices", () => {
    expect(source).toContain('from "@zxing/browser"');
    expect(source).toContain("new BrowserMultiFormatReader()");
    expect(source).toContain("navigator.mediaDevices?.getUserMedia");
  });

  it("يدعم قارئ USB كلوحة مفاتيح ويوقف الكاميرا عند الإغلاق", () => {
    expect(source).toContain('event.key === "Enter"');
    expect(source).toContain("controlsRef.current?.stop()");
    expect(source).toContain("onOpenChange={nextOpen => { if (!nextOpen) stopCamera(); setOpen(nextOpen); }}");
  });
});
