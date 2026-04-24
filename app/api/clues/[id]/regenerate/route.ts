import { NextResponse } from "next/server";
import { db } from "@/db";
import { clues, categories } from "@/db/schema";
import { eq } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI();

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const clueId = parseInt(id);

  const clue = db.select().from(clues).where(eq(clues.id, clueId)).get();
  if (!clue) {
    return NextResponse.json({ error: "Clue not found" }, { status: 404 });
  }

  const category = db
    .select()
    .from(categories)
    .where(eq(categories.id, clue.categoryId))
    .get();
  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  // Get all existing clues in this category to avoid repeats
  const existingClues = db
    .select()
    .from(clues)
    .where(eq(clues.categoryId, clue.categoryId))
    .all();
  const avoidList = existingClues
    .map((c) => `- ${c.question} (${c.answer})`)
    .join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 512,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You generate Jeopardy-style clues. Always respond with valid JSON.",
      },
      {
        role: "user",
        content: `Generate 1 NEW Jeopardy-style clue for the category "${category.name}" at the $${clue.value} difficulty level.
${category.description ? `Category hint: "${category.description}"` : ""}

IMPORTANT: Do NOT repeat any of these existing answers. Pick a completely different topic/subject within the category:
${avoidList}

Return a JSON object with:
- "answer": the clue shown to players (a factual statement)
- "question": the correct response (in "What is...?" or "Who is...?" form)
- "pun": a short witty one-liner pun related to the answer

Difficulty: $${clue.value} (${clue.value <= 200 ? "easy" : clue.value <= 400 ? "moderate" : clue.value <= 600 ? "tricky" : clue.value <= 800 ? "challenging" : "hard"}).
Write a clever, indirect clue. Make players think.`,
      },
    ],
  });

  const rawText = response.choices[0]?.message?.content ?? "";
  const parsed = JSON.parse(rawText);

  const updated = db
    .update(clues)
    .set({
      answer: parsed.answer,
      question: parsed.question,
      pun: parsed.pun || "",
    })
    .where(eq(clues.id, clueId))
    .returning()
    .get();

  return NextResponse.json(updated);
}
