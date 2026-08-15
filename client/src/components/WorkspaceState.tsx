import React from "react";
import { Spinner } from "@/components/ui/spinner";

export function WorkspaceState({ label, loading = false, tone = "muted" }: { label: string; loading?: boolean; tone?: "muted" | "error" }) {
  return <div className={`grid min-h-24 place-items-center py-8 text-center text-sm ${tone === "error" ? "text-destructive" : "text-muted-foreground"}`}><div className="flex flex-col items-center gap-3">{loading ? <Spinner className="h-5 w-5 text-primary" /> : null}<p>{label}</p></div></div>;
}
