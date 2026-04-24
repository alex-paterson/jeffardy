import { NextResponse } from "next/server";
import { eventBus } from "@/lib/events";
import { clearBuzzState } from "@/lib/buzzState";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  // Clear buzz state whenever a new clue opens or we return to the board
  if (
    body.screen === "clue" ||
    body.screen === "daily-double" ||
    body.screen === "board"
  ) {
    clearBuzzState(id);
  }

  eventBus.emit(`game:${id}`, body);
  return NextResponse.json({ ok: true });
}
