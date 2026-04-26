import { NextResponse } from "next/server";
import { db } from "@/db";
import { games, categories, clues, players } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gameId = parseInt(id);

  const game = db.select().from(games).where(eq(games.id, gameId)).get();
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const gameCats = db
    .select()
    .from(categories)
    .where(eq(categories.gameId, gameId))
    .orderBy(categories.position)
    .all();

  const catIds = gameCats.map((c) => c.id);
  const gameClues =
    catIds.length > 0
      ? db
          .select()
          .from(clues)
          .where(
            catIds.length === 1
              ? eq(clues.categoryId, catIds[0])
              : eq(clues.categoryId, catIds[0]) // fallback, handled below
          )
          .all()
      : [];

  // Get all clues for all categories in one pass
  const allClues =
    catIds.length > 0
      ? catIds.flatMap((catId) =>
          db
            .select()
            .from(clues)
            .where(eq(clues.categoryId, catId))
            .all()
        )
      : [];

  const gamePlayers = db
    .select()
    .from(players)
    .where(eq(players.gameId, gameId))
    .all();

  return NextResponse.json({
    ...game,
    categories: gameCats.map((cat) => ({
      ...cat,
      clues: allClues
        .filter((c) => c.categoryId === cat.id)
        .sort((a, b) => a.value - b.value),
    })),
    players: gamePlayers,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gameId = parseInt(id);
  const body = await request.json();

  const result = db
    .update(games)
    .set(body)
    .where(eq(games.id, gameId))
    .returning()
    .get();

  return NextResponse.json(result);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gameId = parseInt(id);

  db.delete(games).where(eq(games.id, gameId)).run();

  return NextResponse.json({ ok: true });
}
