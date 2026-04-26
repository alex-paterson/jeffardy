import { NextResponse } from "next/server";
import { eventBus } from "@/lib/events";
import { getBuzzState } from "@/lib/buzzState";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { lockOutPlayerId } = await request.json();

  const state = getBuzzState(id);
  state.buzzedPlayerId = null;
  state.buzzedPlayerName = null;

  if (lockOutPlayerId != null) {
    state.lockedOut.add(lockOutPlayerId);
  }

  eventBus.emit(`game:${id}`, {
    type: "buzz-clear",
    lockedOutPlayerId: lockOutPlayerId ?? null,
  });

  return NextResponse.json({ ok: true });
}
