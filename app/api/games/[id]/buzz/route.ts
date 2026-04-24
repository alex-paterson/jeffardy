import { NextResponse } from "next/server";
import { eventBus } from "@/lib/events";
import { getBuzzState } from "@/lib/buzzState";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { playerId, playerName } = await request.json();

  const state = getBuzzState(id);

  if (state.lockedOut.has(playerId)) {
    return NextResponse.json({ ok: false, reason: "locked_out" });
  }

  if (state.buzzedPlayerId !== null) {
    return NextResponse.json({ ok: false, reason: "already_buzzed" });
  }

  state.buzzedPlayerId = playerId;
  state.buzzedPlayerName = playerName;

  eventBus.emit(`game:${id}`, { type: "buzz", playerId, playerName });

  return NextResponse.json({ ok: true });
}
