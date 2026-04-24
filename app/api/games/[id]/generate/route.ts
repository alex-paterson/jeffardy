import { NextResponse } from "next/server";
import { db } from "@/db";
import { categories, clues } from "@/db/schema";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
import fs from "fs";
import path from "path";

const openai = new OpenAI();

interface GeneratedClue {
  value: number;
  answer: string;
  question: string;
  pun: string;
}

async function generateCluesForCategory(
  categoryName: string,
  categoryDescription: string
): Promise<GeneratedClue[]> {
  const descriptionContext = categoryDescription
    ? `\nCategory description/guidance from the host: "${categoryDescription}". Use this to guide the theme and scope of your clues, but do NOT reveal this description in the clues themselves.`
    : "";

  const response = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 2048,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You generate Jeopardy-style clues. Always respond with valid JSON.",
      },
      {
        role: "user",
        content: `Generate 5 Jeopardy-style clues for the category "${categoryName}".${descriptionContext}

Return a JSON object with a "clues" key containing an array of exactly 5 objects.
Each object has:
- "value": the dollar value (200, 400, 600, 800, or 1000)
- "answer": the clue shown to players (a factual statement, like real Jeopardy)
- "question": the correct response (in "What is...?" or "Who is...?" form)
- "pun": a short, witty one-liner pun or quip related to the answer (1 sentence max, should be groan-worthy and fun to hear read aloud)

IMPORTANT difficulty guidelines:
- The clues MUST get progressively harder from $200 to $1000. This is critical.
- $200: Easy — common knowledge, most people would get this.
- $400: Moderate — requires some familiarity with the topic.
- $600: Tricky — requires decent knowledge of the subject.
- $800: Challenging — requires good knowledge of the subject.
- $1000: Hard — tough but still answerable by someone who knows the topic well.
- Write clues that are clever and indirect, not just "This is the name of X." Make players think.`,
      },
    ],
  });

  const rawText = response.choices[0]?.message?.content ?? "";
  const parsed = JSON.parse(rawText);
  const clueArray: GeneratedClue[] = parsed.clues ?? parsed;
  if (!Array.isArray(clueArray) || clueArray.length === 0) {
    console.error("Failed to parse AI response:", rawText);
    throw new Error("Failed to parse AI response");
  }
  return clueArray;
}

async function generateTTS(text: string, clueId: number): Promise<void> {
  const audioDir = path.join(process.cwd(), "public", "audio");
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }

  const filePath = path.join(audioDir, `clue-${clueId}.mp3`);

  try {
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "onyx",
      input: text,
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
  } catch {
    // TTS generation failed silently — game works without audio
  }
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

  // Clear existing clues and audio for all categories in this game
  for (const cat of gameCats) {
    const existing = db.select().from(clues).where(eq(clues.categoryId, cat.id)).all();
    for (const c of existing) {
      const audioPath = path.join(process.cwd(), "public", "audio", `clue-${c.id}.mp3`);
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    }
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
            pun: clue.pun || "",
          })
          .returning()
          .get()
      );
      return { category: cat.name, clues: inserted, puns: generated.map((g) => g.pun) };
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

  // TTS disabled temporarily
  // const ttsPromises = results.flatMap((r) =>
  //   r.clues.map((clue, i) => {
  //     const pun = r.puns[i];
  //     return pun ? generateTTS(pun, clue.id) : Promise.resolve();
  //   })
  // );
  // await Promise.all(ttsPromises);

  return NextResponse.json(results);
}
