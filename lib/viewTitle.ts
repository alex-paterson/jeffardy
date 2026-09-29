import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { games } from "@/db/schema";

// Tab title for a game view, e.g. "Friday Night · Host". Falls back to
// "Jeffardy · Host" when the game does not exist.
export async function gameViewMetadata(
  params: Promise<{ id: string }>,
  view: string
): Promise<Metadata> {
  const { id } = await params;
  const gameId = parseInt(id);
  const game = Number.isNaN(gameId)
    ? undefined
    : db.select({ name: games.name }).from(games).where(eq(games.id, gameId)).get();
  return { title: `${game?.name ?? "Jeffardy"} · ${view}` };
}
