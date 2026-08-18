import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "client/public/retail.webmanifest"), "utf8"));
const worker = readFileSync(resolve(process.cwd(), "client/public/nawa-retail-sw.js"), "utf8");

describe("RASEEN Merchant Portal PWA", () => {
  it("يبدأ من بوابة التاجر المستقلة", () => {
    expect(manifest.name).toBe("RASEEN Merchant Portal — بوابة التاجر");
    expect(manifest.start_url).toBe("/retailer");
    expect(manifest.display).toBe("standalone");
  });

  it("لا يخزن أي استدعاء API أو بيانات تجارية في التخزين المؤقت", () => {
    expect(worker).toContain('url.pathname.startsWith("/api/")');
    expect(worker).toContain("request.method !== \"GET\"");
    expect(worker).toContain('const RETAIL_FALLBACK = "/retailer"');
  });

  it("يحذف نسخ shell القديمة ويدعم مسحاً صريحاً عند الخروج", () => {
    expect(worker).toContain('key.startsWith("nawa-retail-shell-")');
    expect(worker).toContain('type === "CLEAR_NAWA_RETAIL_CACHE"');
  });
});
