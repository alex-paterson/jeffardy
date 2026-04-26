import { NextResponse } from "next/server";
import { db } from "@/db";
import { games, categories, clues, players } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gameId = parseInt(id);

  // Reset all player scores to 0
  db.update(players)
    .set({ score: 0 })
    .where(eq(players.gameId, gameId))
    .run();

  // Un-reveal all clues
  const gameCats = db
    .select()
    .from(categories)
    .where(eq(categories.gameId, gameId))
    .all();

  for (const cat of gameCats) {
    db.update(clues)
      .set({ isRevealed: false })
      .where(eq(clues.categoryId, cat.id))
      .run();
  }

  // Set game state back to playing
  db.update(games)
    .set({ state: "playing" })
    .where(eq(games.id, gameId))
    .run();

  return NextResponse.json({ ok: true });
}
