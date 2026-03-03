export interface FeedPost {
  id?: number;
  userId: string;
  content: string;
  category: "tip" | "milestone" | "question" | "resource";
  reactions: { heart: number; helpful: number; relate: number };
  createdAt: number;
  anonymous: boolean;
}
