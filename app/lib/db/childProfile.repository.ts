import { db } from "./schema";
import { getCurrentUserId } from "../identity/identity";
import type { ChildProfile } from "../../types/childProfile";

/** Creates a new child profile for the current user. */
export async function createProfile(
  data: Omit<ChildProfile, "userId" | "createdAt">,
): Promise<void> {
  const userId = getCurrentUserId();
  await db.childProfiles.add({
    ...data,
    userId,
    createdAt: Date.now(),
  });
}

/** Lists all child profiles belonging to the current user. */
export async function listProfiles(): Promise<ChildProfile[]> {
  const userId = getCurrentUserId();
  return db.childProfiles
    .where("userId")
    .equals(userId)
    .reverse()
    .sortBy("createdAt");
}

/** Gets a single child profile by ID. */
export async function getProfile(
  id: string,
): Promise<ChildProfile | undefined> {
  return db.childProfiles.get(id);
}

/** Updates an existing child profile. */
export async function updateProfile(
  id: string,
  data: Partial<Omit<ChildProfile, "id" | "userId" | "createdAt">>,
): Promise<void> {
  await db.childProfiles.update(id, data);
}

/** Deletes a child profile by ID. */
export async function deleteProfile(id: string): Promise<void> {
  await db.childProfiles.delete(id);
}
