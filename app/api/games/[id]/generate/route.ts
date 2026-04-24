import { NextResponse } from "next/server";
import { db } from "@/db";
import { categories, clues } from "@/db/schema";
import { eq } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

interface GeneratedClue {
  value: number;
  answer: string;
  question: string;
}

async function generateCluesForCategory(
  categoryName: string,
  categoryDescription: string
): Promise<GeneratedClue[]> {
  const descriptionContext = categoryDescription
    ? `\nCategory description/guidance from the host: "${categoryDescription}". Use this to guide the theme and scope of your clues, but do NOT reveal this description in the clues themselves.`
    : "";
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Generate 5 Jeopardy-style clues for the category "${categoryName}".${descriptionContext}

Return ONLY a JSON array with exactly 5 objects. No other text.
Each object has:
- "value": the dollar value (200, 400, 600, 800, or 1000)
- "answer": the clue shown to players (a factual statement, like real Jeopardy)
- "question": the correct response (in "What is...?" or "Who is...?" form)

IMPORTANT difficulty guidelines:
- The clues MUST get progressively harder from $200 to $1000. This is critical.
- $200: Moderate — most adults would know this, but it shouldn't be completely obvious or trivial.
- $400: Trickier — requires some knowledge of the topic.
- $600: Hard — only someone with decent knowledge of the subject would get this.
- $800: Very hard — requires specific or niche knowledge.
- $1000: Expert level — obscure facts, deep cuts, the kind of thing only an enthusiast or specialist would know.
- Do NOT make any clue a total giveaway. Even $200 should require a moment of thought.
- Write clues that are clever and indirect, not just "This is the name of X." Make players think.

Example format:
[
  {"value": 200, "answer": "This planet is known as the Red Planet", "question": "What is Mars?"},
  ...
]`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("Failed to parse AI response");
  return JSON.parse(jsonMatch[0]);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gameId = parseInt(id);

  const gameCats = db
    .select()
    .from(categories)
    .where(eq(categories.gameId, gameId))
    .orderBy(categories.position)
    .all();

  if (gameCats.length === 0) {
    return NextResponse.json(
      { error: "No categories found. Add categories first." },
      { status: 400 }
    );
  }

  // Clear existing clues for all categories in this game
  for (const cat of gameCats) {
    db.delete(clues).where(eq(clues.categoryId, cat.id)).run();
  }

  // Generate clues for all categories in parallel
  const results = await Promise.all(
    gameCats.map(async (cat) => {
      const generated = await generateCluesForCategory(cat.name, cat.description);
      const inserted = generated.map((clue) =>
        db
          .insert(clues)
          .values({
            categoryId: cat.id,
            value: clue.value,
            answer: clue.answer,
            question: clue.question,
          })
          .returning()
          .get()
      );
      return { category: cat.name, clues: inserted };
    })
  );

  // Randomly assign one daily double from all inserted clues
  const allInserted = results.flatMap((r) => r.clues);
  if (allInserted.length > 0) {
    const ddClue = allInserted[Math.floor(Math.random() * allInserted.length)];
    db.update(clues)
      .set({ isDailyDouble: true })
      .where(eq(clues.id, ddClue.id))
      .run();
  }

  return NextResponse.json(results);
}
