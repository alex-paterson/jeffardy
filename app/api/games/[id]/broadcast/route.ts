import { NextResponse } from "next/server";
import { eventBus } from "@/lib/events";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  eventBus.emit(`game:${id}`, body);
  return NextResponse.json({ ok: true });
}
