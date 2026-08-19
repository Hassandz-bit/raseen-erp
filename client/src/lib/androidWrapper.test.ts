import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const config = readFileSync(resolve(process.cwd(), "capacitor.config.ts"), "utf8");
const manifest = readFileSync(resolve(process.cwd(), "android/app/src/main/AndroidManifest.xml"), "utf8");
const gradle = readFileSync(resolve(process.cwd(), "android/app/build.gradle"), "utf8");
const strings = readFileSync(resolve(process.cwd(), "android/app/src/main/res/values/strings.xml"), "utf8");
const signingExample = readFileSync(resolve(process.cwd(), "android/release-signing.properties.example"), "utf8");

describe("غلاف Android لتطبيق Nawa ERP", () => {
  it("يستعمل اسم الحزمة الرسمي ورابط HTTPS قابل للاستبدال عند النشر", () => {
    expect(config).toContain('appId: "com.nawa.erp"');
    expect(config).toContain("NAWA_ANDROID_SERVER_URL");
    expect(config).toContain("cleartext: false");
    expect(config).toContain("allowNavigation: [appHost]");
  });

  it("يطلب الإنترنت والكاميرا فقط لمسح المنتج ولا يفرض وجود كاميرا", () => {
    expect(manifest).toContain('android.permission.INTERNET');
    expect(manifest).toContain('android.permission.CAMERA');
    expect(manifest).toContain('android.hardware.camera.any" android:required="false"');
  });

  it("يحمل هوية RASEEN وإعداد توقيع إصدار اختياري لا يضم مفتاحاً سرياً", () => {
    expect(strings).toContain("RASEEN ERP");
    expect(gradle).toContain('versionName "1.1.0"');
    expect(gradle).toContain("release-signing.properties");
    expect(gradle).toContain("hasReleaseSigning");
    expect(signingExample).toContain("REPLACE_WITH_A_LONG_PRIVATE_PASSWORD");
  });
});
