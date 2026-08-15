export function classifyBranchPersistenceError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? (error as { code?: string }).code : undefined;
  return code === "ER_DUP_ENTRY" ? "conflict" : "save_failed";
}
