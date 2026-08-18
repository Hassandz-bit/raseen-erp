import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const templatePath = resolve(projectRoot, "client/public/nawa-erp-sw.js");
const outputDir = resolve(projectRoot, process.env.NAWA_PWA_OUTPUT_DIR ?? "dist/public");
const rawVersion = process.env.NAWA_PWA_BUILD_ID ?? process.env.GITHUB_SHA?.slice(0, 12) ?? `build-${Date.now().toString(36)}`;
const buildVersion = rawVersion.replace(/[^a-zA-Z0-9._-]/g, "-");
const template = readFileSync(templatePath, "utf8");

if (!template.includes("__NAWA_PWA_BUILD_ID__")) {
  throw new Error("قالب Service Worker لا يتضمن موضع إصدار Nawa PWA.");
}

if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
const worker = template.replaceAll("__NAWA_PWA_BUILD_ID__", buildVersion);
writeFileSync(resolve(outputDir, "nawa-erp-sw.js"), worker, "utf8");
writeFileSync(resolve(outputDir, "nawa-pwa-build.json"), `${JSON.stringify({ version: buildVersion }, null, 2)}\n`, "utf8");
console.info(`Nawa PWA Service Worker version: ${buildVersion}`);
