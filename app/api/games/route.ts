import { NextResponse } from "next/server";
import { db } from "@/db";
import { games } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const allGames = db.select().from(games).orderBy(desc(games.createdAt)).all();
  return NextResponse.json(allGames);
}

export async function POST(request: Request) {
  const { name } = await request.json();
  const result = db.insert(games).values({ name }).returning().get();
  return NextResponse.json(result, { status: 201 });
}
