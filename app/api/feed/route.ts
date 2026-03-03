import { NextRequest, NextResponse } from "next/server";

/**
 * Feed API route — for future DynamoDB sync.
 *
 * GET: List posts (from DynamoDB if available, fallback to IndexedDB on client)
 * POST: Create new post (write to DynamoDB when available)
 *
 * Currently returns placeholder responses since DynamoDB is not yet configured.
 * The client-side IndexedDB is the primary data source for now.
 */

// GET /api/feed — List posts
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const category = searchParams.get("category") || undefined;

  // TODO: Query DynamoDB when configured
  // For now, return an empty array — client uses IndexedDB as primary store
  return NextResponse.json({
    posts: [],
    source: "placeholder",
    message:
      "DynamoDB not configured. Client should use IndexedDB as primary data source.",
    params: { limit, category },
  });
}

// POST /api/feed — Create a new post
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, category, anonymous } = body;

    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 },
      );
    }

    const validCategories = ["tip", "milestone", "question", "resource"];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Category must be one of: ${validCategories.join(", ")}` },
        { status: 400 },
      );
    }

    // TODO: Write to DynamoDB when configured
    // For now, acknowledge the post — client writes to IndexedDB
    return NextResponse.json({
      success: true,
      source: "placeholder",
      message:
        "DynamoDB not configured. Post saved to IndexedDB on client only.",
      post: {
        content: content.trim(),
        category,
        anonymous: anonymous !== false,
        createdAt: Date.now(),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}
