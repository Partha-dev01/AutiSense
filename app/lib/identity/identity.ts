/*Generates a stable random ID stored in localStorage.
 This ID is used as a partition key in IndexedDB and DynamoDB.
 It is NOT linked to any personal information
 server-side code should never call this
 for real user data.*/

const STORAGE_KEY = "autisense-user-id";

export function getCurrentUserId(): string {
  if (typeof window === "undefined") return "server";

  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const newId = "anon-" + crypto.randomUUID();
  localStorage.setItem(STORAGE_KEY, newId);
  return newId;
}

//to wipe out user data completely
export function clearUserId(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
