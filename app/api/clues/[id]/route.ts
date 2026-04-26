import { NextResponse } from "next/server";
import { db } from "@/db";
import { clues } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const clueId = parseInt(id);
  const body = await request.json();

  const result = db
    .update(clues)
    .set(body)
    .where(eq(clues.id, clueId))
    .returning()
    .get();

  return NextResponse.json(result);
}
