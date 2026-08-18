import { getPortalForPath, getPortalNavigationIcon } from "@/config/nawaPortals";
import { AlertTriangle, Settings2 } from "lucide-react";
import { describe, expect, it } from "vitest";

describe("سجل تنبيهات القرار", () => {
  it("ينتمي إلى الإدارة ويملك رمز أولوية مميزاً", () => {
    expect(getPortalForPath("/alerts")?.id).toBe("administration");
    expect(getPortalNavigationIcon("decision-alerts", Settings2)).toBe(AlertTriangle);
  });
});
