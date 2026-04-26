import { NextResponse } from "next/server";
import { db } from "@/db";
import { players } from "@/db/schema";
import { eq } from "drizzle-orm";

interface PlayerInput {
  name: string;
  score?: number;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gameId = parseInt(id);
  const body = await request.json();

  // Support both { names: string[] } and { players: PlayerInput[] }
  const playerList: PlayerInput[] = body.players
    ?? (body.names as string[]).map((name: string) => ({ name, score: 0 }));

  // Clear existing players for this game
  db.delete(players).where(eq(players.gameId, gameId)).run();

  const created = playerList.map((p) =>
    db
      .insert(players)
      .values({ gameId, name: p.name, score: p.score ?? 0 })
      .returning()
      .get()
  );

  return NextResponse.json(created, { status: 201 });
}
