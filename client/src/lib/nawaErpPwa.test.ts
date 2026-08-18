import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "client/public/manifest.webmanifest"), "utf8"));
const worker = readFileSync(resolve(process.cwd(), "client/public/nawa-erp-sw.js"), "utf8");
const statusSource = readFileSync(resolve(process.cwd(), "client/src/components/PwaStatus.tsx"), "utf8");
const offline = readFileSync(resolve(process.cwd(), "client/public/offline.html"), "utf8");
const buildWriter = readFileSync(resolve(process.cwd(), "scripts/write-pwa-service-worker.mts"), "utf8");

describe("RASEEN ERP PWA", () => {
  it("يعرّف تطبيق ERP عاماً مستقلاً عن مانيـفست السائق", () => {
    expect(manifest.name).toBe("RASEEN ERP — منصة رصين لإدارة الأعمال");
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: "/manus-storage/raseen-brand-mark_5c7cbd99.png", sizes: "192x192", type: "image/png" }),
      expect.objectContaining({ src: "/manus-storage/raseen-brand-mark_5c7cbd99.png", sizes: "512x512", purpose: "any maskable" }),
    ]));
  });

  it("يخزن shell فقط ولا يعترض API أو طلبات غير GET", () => {
    expect(worker).toContain('url.pathname.startsWith("/api/")');
    expect(worker).toContain('request.method !== "GET"');
    expect(worker).toContain('const APP_SHELL = "/"');
    expect(worker).toContain("__NAWA_PWA_BUILD_ID__");
    expect(worker).toContain('const OFFLINE_PAGE = "/offline.html"');
    expect(worker).toContain('cache.addAll([APP_SHELL, OFFLINE_PAGE])');
    expect(worker).toContain('type === "CLEAR_NAWA_ERP_CACHE"');
  });

  it("يسجل PWA في الإنتاج ويعرض حالة التحديث وعدم الاتصال من دون حظر التطبيق", () => {
    expect(statusSource).toContain('navigator.serviceWorker.register("/nawa-erp-sw.js")');
    expect(statusSource).toContain('import.meta.env.PROD');
    expect(statusSource).toContain('window.addEventListener("offline"');
    expect(statusSource).toContain('type: "SKIP_WAITING"');
    expect(statusSource).toContain('"nawa-pwa-open-install"');
    expect(statusSource).toContain("ثبّت رصين كتطبيق");
    expect(offline).toContain("أنت الآن دون اتصال");
    expect(offline).toContain("لن تُخزَّن بيانات المؤسسة");
  });

  it("يولد إصداراً جديداً في dist بعد كل بناء من دون تعديل قالب التطوير", () => {
    expect(buildWriter).toContain("Date.now().toString(36)");
    expect(buildWriter).toContain('template.replaceAll("__NAWA_PWA_BUILD_ID__", buildVersion)');
    expect(buildWriter).toContain('"nawa-pwa-build.json"');
    expect(buildWriter).toContain("NAWA_PWA_BUILD_ID");
  });
});
