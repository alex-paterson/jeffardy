import { NextResponse } from "next/server";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq } from "drizzle-orm";

interface CategoryInput {
  name: string;
  description?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gameId = parseInt(id);
  const body = await request.json();

  // Support both { names: string[] } and { categories: CategoryInput[] }
  const catList: CategoryInput[] = body.categories
    ?? (body.names as string[]).map((name: string) => ({ name, description: "" }));

  // Clear existing categories for this game
  db.delete(categories).where(eq(categories.gameId, gameId)).run();

  const created = catList.map((cat, i) =>
    db
      .insert(categories)
      .values({ gameId, name: cat.name, description: cat.description ?? "", position: i })
      .returning()
      .get()
  );

  return NextResponse.json(created, { status: 201 });
}
