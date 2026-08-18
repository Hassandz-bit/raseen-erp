import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "client/public/manifest.webmanifest"), "utf8"));
const worker = readFileSync(resolve(process.cwd(), "client/public/nawa-erp-sw.js"), "utf8");
const statusSource = readFileSync(resolve(process.cwd(), "client/src/components/PwaStatus.tsx"), "utf8");

describe("Nawa ERP PWA", () => {
  it("يعرّف تطبيق ERP عاماً مستقلاً عن مانيـفست السائق", () => {
    expect(manifest.name).toBe("Nawa ERP — منصة الأعمال الذكية");
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons[0]).toMatchObject({ type: "image/png", purpose: "any maskable" });
  });

  it("يخزن shell فقط ولا يعترض API أو طلبات غير GET", () => {
    expect(worker).toContain('url.pathname.startsWith("/api/")');
    expect(worker).toContain('request.method !== "GET"');
    expect(worker).toContain('const APP_SHELL = "/"');
    expect(worker).toContain('type === "CLEAR_NAWA_ERP_CACHE"');
  });

  it("يسجل PWA في الإنتاج ويعرض حالة التحديث وعدم الاتصال من دون حظر التطبيق", () => {
    expect(statusSource).toContain('navigator.serviceWorker.register("/nawa-erp-sw.js")');
    expect(statusSource).toContain('import.meta.env.PROD');
    expect(statusSource).toContain('window.addEventListener("offline"');
    expect(statusSource).toContain('type: "SKIP_WAITING"');
  });
});
