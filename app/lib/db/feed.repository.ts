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

/** Increments a reaction count on a post. */
export async function addReaction(
  postId: number,
  type: "heart" | "helpful" | "relate",
): Promise<void> {
  const post = await db.feedPosts.get(postId);
  if (!post) return;
  const reactions = { ...post.reactions };
  reactions[type] += 1;
  await db.feedPosts.update(postId, { reactions });
}

/** Deletes a post if it belongs to the current user. */
export async function deletePost(postId: number): Promise<void> {
  const userId = getCurrentUserId();
  const post = await db.feedPosts.get(postId);
  if (post && post.userId === userId) {
    await db.feedPosts.delete(postId);
  }
}
