export function getCurrentUserId(): string {
  if (typeof window === "undefined") return "server";

  const existing = localStorage.getItem("autisense-user-id");
  if (existing) return existing;

  const newId = "anon-" + crypto.randomUUID();
  localStorage.setItem("autisense-user-id", newId);
  return newId;
}
