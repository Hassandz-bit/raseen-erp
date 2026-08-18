import type { CapacitorConfig } from "@capacitor/cli";

const appUrl = process.env.NAWA_ANDROID_SERVER_URL ?? "https://3000-i3q5pr4wn63xgi97jgyfp-34422df9.us2.manus.computer";
const appHost = new URL(appUrl).hostname;

const config: CapacitorConfig = {
  appId: "com.nawa.erp",
  appName: "RASEEN ERP",
  webDir: "dist/public",
  server: {
    url: appUrl,
    cleartext: false,
    allowNavigation: [appHost],
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
