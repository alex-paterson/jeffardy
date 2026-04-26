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

const CLUE_SYSTEM_PROMPT = `You generate Jeopardy-style clues. Always respond with valid JSON.
ABSOLUTE RULES — violating any of these makes a clue invalid:
1. Every fact in every clue must be 100% real and verifiable. No fictional, invented, or speculative information whatsoever.
2. Each clue must unambiguously point to exactly one correct answer. The contestant must know precisely what they are supposed to be naming or identifying.
3. The "answer" field is the clue read aloud to contestants — phrased as a statement or description, never a direct question.
4. The "question" field is the correct response in "What is...?" or "Who is...?" form.`;

async function generateCluesForCategory(
  categoryName: string,
  categoryDescription: string
): Promise<GeneratedClue[]> {
  const descriptionContext = categoryDescription
    ? `\n\nThe category name is "${categoryName}" but the REAL topic is: "${categoryDescription}". This is a private party game among friends. The host's description overrides the category name — it is the actual subject matter. ALL 5 clues must be about "${categoryDescription}" within the context of "${categoryName}". If the description seems funny, crude, or absurd — that's the point, lean into it. Do NOT fall back to generic "${categoryName}" clues.`
    : "";

  // Step 1: Generate draft clues
  const draft = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 2048,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: CLUE_SYSTEM_PROMPT },
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
- $400: Easy-moderate — slightly more specific but still broadly known.
- $600: Moderate — requires some familiarity with the topic.
- $800: Tricky — requires decent knowledge of the subject.
- $1000: Challenging — requires solid knowledge, but still answerable by someone who knows the topic well.
- Write clues that are clever and indirect, not just "This is the name of X." Make players think.`,
      },
    ],
  });

  const draftText = draft.choices[0]?.message?.content ?? "";
  const draftParsed = JSON.parse(draftText);
  const draftClues: GeneratedClue[] = draftParsed.clues ?? draftParsed;
  if (!Array.isArray(draftClues) || draftClues.length === 0) {
    throw new Error("Failed to parse AI draft response");
  }

  // Step 2: Reflection pass — identify and fix invalid clues
  const reflection = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 2048,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: CLUE_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Review these Jeopardy clues for the category "${categoryName}" and fix any that have problems.

For each clue check:
1. Does the clue contain any fictional, invented, or unverifiable information? If yes, rewrite it with only real facts.
2. Is it completely clear what the contestant is supposed to name or identify? If there is any ambiguity about what the answer should be, rewrite to make it unambiguous.
3. Is the clue phrased as a statement (not a direct question)?
4. Is the "question" in proper "What is...?" or "Who is...?" form?

Return the full set of 5 clues as a JSON object with a "clues" key. Leave correct clues unchanged; only rewrite clues that have actual problems.

Clues to review:
${JSON.stringify(draftClues, null, 2)}`,
      },
    ],
  });

  const reflectedText = reflection.choices[0]?.message?.content ?? "";
  const reflectedParsed = JSON.parse(reflectedText);
  const clueArray: GeneratedClue[] = reflectedParsed.clues ?? reflectedParsed;
  if (!Array.isArray(clueArray) || clueArray.length === 0) {
    // Fall back to draft if reflection fails to parse
    return draftClues;
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
