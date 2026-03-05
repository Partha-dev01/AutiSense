import { db } from "./schema";
import { getCurrentUserId } from "../identity/identity";
import type { FeedPost } from "../../types/feedPost";

/** Creates an anonymized community feed post. */
export async function createPost(
  content: string,
  category: FeedPost["category"],
  anonymous: boolean = true,
): Promise<void> {
  const userId = getCurrentUserId();
  await db.feedPosts.add({
    userId,
    content,
    category,
    reactions: { heart: 0, helpful: 0, relate: 0 },
    createdAt: Date.now(),
    anonymous,
  });
}

/** Lists recent community feed posts, newest first. */
export async function listPosts(limit: number = 50): Promise<FeedPost[]> {
  const all = await db.feedPosts.orderBy("createdAt").reverse().toArray();
  return all.slice(0, limit);
}

/** Toggle a reaction: add if not reacted, remove if already reacted. */
export async function toggleReaction(
  postId: number,
  type: "heart" | "helpful" | "relate",
): Promise<boolean> {
  const userId = getCurrentUserId();
  const existing = await db.feedReactions
    .where({ postId, userId, type })
    .first();

  const post = await db.feedPosts.get(postId);
  if (!post) return false;

  const reactions = { ...post.reactions };

  if (existing) {
    // Remove reaction
    await db.feedReactions.delete(existing.id!);
    reactions[type] = Math.max(0, reactions[type] - 1);
    await db.feedPosts.update(postId, { reactions });
    return false; // no longer reacted
  } else {
    // Add reaction
    await db.feedReactions.add({ postId, userId, type });
    reactions[type] += 1;
    await db.feedPosts.update(postId, { reactions });
    return true; // now reacted
  }
}

/** Get all reactions by the current user (for displaying filled/unfilled state). */
export async function getUserReactions(): Promise<Set<string>> {
  const userId = getCurrentUserId();
  const reactions = await db.feedReactions.where("userId").equals(userId).toArray();
  return new Set(reactions.map((r) => `${r.postId}-${r.type}`));
}

/** Deletes a post if it belongs to the current user. Also cleans up reactions. */
export async function deletePost(postId: number): Promise<void> {
  const userId = getCurrentUserId();
  const post = await db.feedPosts.get(postId);
  if (post && post.userId === userId) {
    await db.feedReactions.where("postId").equals(postId).delete();
    await db.feedPosts.delete(postId);
  }
}
