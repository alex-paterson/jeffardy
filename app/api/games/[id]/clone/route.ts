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

  const game = db.select().from(games).where(eq(games.id, gameId)).get();
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  // Create new game (preserve buzzerMode and imageMode)
  const newGame = db
    .insert(games)
    .values({ name: `${game.name} (copy)`, state: "setup", buzzerMode: game.buzzerMode, imageMode: game.imageMode })
    .returning()
    .get();

  // Copy categories and clues
  const gameCats = db
    .select()
    .from(categories)
    .where(eq(categories.gameId, gameId))
    .orderBy(categories.position)
    .all();

  for (const cat of gameCats) {
    const newCat = db
      .insert(categories)
      .values({
        gameId: newGame.id,
        name: cat.name,
        description: cat.description,
        position: cat.position,
      })
      .returning()
      .get();

    const catClues = db
      .select()
      .from(clues)
      .where(eq(clues.categoryId, cat.id))
      .all();

    for (const clue of catClues) {
      db.insert(clues)
        .values({
          categoryId: newCat.id,
          value: clue.value,
          answer: clue.answer,
          question: clue.question,
          pun: clue.pun,
          isDailyDouble: clue.isDailyDouble,
        })
        .run();
    }
  }

  // Copy players (reset scores to 0)
  const gamePlayers = db
    .select()
    .from(players)
    .where(eq(players.gameId, gameId))
    .all();

  for (const player of gamePlayers) {
    db.insert(players)
      .values({ gameId: newGame.id, name: player.name, score: 0 })
      .run();
  }

  return NextResponse.json(newGame, { status: 201 });
}
