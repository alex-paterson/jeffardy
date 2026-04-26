import { NextResponse } from "next/server";
import { db } from "@/db";
import { players } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const playerId = parseInt(id);
  const { delta } = (await request.json()) as { delta: number };

  const result = db
    .update(players)
    .set({ score: sql`score + ${delta}` })
    .where(eq(players.id, playerId))
    .returning()
    .get();

  return NextResponse.json(result);
}
