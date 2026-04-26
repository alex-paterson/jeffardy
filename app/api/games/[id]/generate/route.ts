import { NextResponse } from "next/server";
import { db } from "@/db";
import { categories, clues, games } from "@/db/schema";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
import fs from "fs";
import path from "path";

const openai = new OpenAI();

// Limit concurrent DALL-E requests to avoid rate-limit failures.
// DALL-E 3 tier-1 allows ~5 img/min; keeping 2 in-flight at once keeps us
// well under that while still generating in parallel where possible.
function makeConcurrencyLimiter(limit: number) {
  let running = 0;
  const queue: Array<() => void> = [];

  function next() {
    while (running < limit && queue.length > 0) {
      running++;
      queue.shift()!();
    }
  }

  return function run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(async () => {
        try {
          resolve(await fn());
        } catch (e) {
          reject(e);
        } finally {
          running--;
          next();
        }
      });
      next();
    });
  };
}

const imageGenLimit = makeConcurrencyLimiter(2);

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

const IMAGE_MODE_SYSTEM_PROMPT = `You generate subjects for a visual guessing game. Always respond with valid JSON.
ABSOLUTE RULES:
1. Every subject must be 100% real and visually identifiable — something that can be clearly depicted in an image.
2. The "answer" field is a short, vivid description of what the image should show (used as a DALL-E image prompt). It must unambiguously depict exactly one correct answer.
3. The "question" field is the correct response in "What is...?" or "Who is...?" form.
4. No text, labels, or words should appear in the image — the subject must be recognisable purely visually.`;

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
    return draftClues;
  }
  return clueArray;
}

async function generateImageModeCluesForCategory(
  categoryName: string,
  categoryDescription: string
): Promise<GeneratedClue[]> {
  const descriptionContext = categoryDescription
    ? ` The real topic within this category is: "${categoryDescription}".`
    : "";

  const response = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 2048,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: IMAGE_MODE_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Generate 5 subjects for a visual guessing game in the category "${categoryName}".${descriptionContext}

Players will see an AI-generated image and must identify what it shows.

Return a JSON object with a "clues" key containing an array of exactly 5 objects.
Each object has:
- "value": the dollar value (200, 400, 600, 800, or 1000)
- "answer": a short, vivid image prompt describing exactly what to draw (e.g. "The Eiffel Tower lit up at night in Paris"). Must be visually unambiguous — one clear subject, no text in the image.
- "question": the correct response (in "What is...?" or "Who is...?" form)
- "pun": a short, witty one-liner related to the subject

Difficulty guidelines (harder = more obscure or specific):
- $200: Instantly recognisable worldwide (e.g. famous landmark, iconic object)
- $400: Well-known but requires some general knowledge
- $600: Moderately specific — most interested people would know it
- $800: Requires real familiarity with the category topic
- $1000: Niche or specific enough to challenge even enthusiasts`,
      },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "";
  const parsed = JSON.parse(text);
  const clueArray: GeneratedClue[] = parsed.clues ?? parsed;
  if (!Array.isArray(clueArray) || clueArray.length === 0) {
    throw new Error("Failed to parse AI image-mode response");
  }
  return clueArray;
}

async function generateClueImage(imagePrompt: string, clueId: number): Promise<string> {
  return imageGenLimit(async () => {
    const imageDir = path.join(process.cwd(), "public", "images");
    if (!fs.existsSync(imageDir)) fs.mkdirSync(imageDir, { recursive: true });

    const fullPrompt = `${imagePrompt}. No text, labels, or words in the image. Clean, bold, iconic visual style.`;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[image] clue ${clueId} attempt ${attempt}: "${imagePrompt}"`);

        const response = await openai.images.generate({
          model: "dall-e-3",
          prompt: fullPrompt,
          n: 1,
          size: "1024x1024",
          response_format: "b64_json",
        });

        const b64 = response.data?.[0]?.b64_json;
        if (!b64) {
          console.error(`[image] clue ${clueId}: no b64 data in response`);
          return "";
        }

        const filePath = path.join(imageDir, `clue-${clueId}.png`);
        fs.writeFileSync(filePath, Buffer.from(b64, "base64"));
        console.log(`[image] clue ${clueId}: saved to ${filePath}`);
        return `/images/clue-${clueId}.png`;
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status;
        const message = (err as { message?: string })?.message ?? String(err);

        if (status === 429 && attempt < maxRetries) {
          const delay = attempt * 20_000; // 20s, 40s
          console.warn(`[image] clue ${clueId}: rate limited, retrying in ${delay / 1000}s (attempt ${attempt}/${maxRetries})`);
          await new Promise((r) => setTimeout(r, delay));
        } else {
          console.error(`[image] clue ${clueId}: failed after ${attempt} attempt(s) — ${message}`);
          return "";
        }
      }
    }

    return "";
  });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gameId = parseInt(id);

  const game = db.select().from(games).where(eq(games.id, gameId)).get();
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

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

  // Clear existing clues and images for all categories in this game
  for (const cat of gameCats) {
    const existing = db.select().from(clues).where(eq(clues.categoryId, cat.id)).all();
    for (const c of existing) {
      const audioPath = path.join(process.cwd(), "public", "audio", `clue-${c.id}.mp3`);
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      if (c.imagePath) {
        const imgPath = path.join(process.cwd(), "public", c.imagePath);
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
      }
    }
    db.delete(clues).where(eq(clues.categoryId, cat.id)).run();
  }

  // Generate clue text for all categories in parallel.
  // In image mode, kick off image generation for each category immediately as its
  // text finishes — so images for early-completing categories overlap with text
  // generation for later ones rather than waiting for a separate second phase.
  const imageGenPromises: Promise<void>[] = [];

  const results = await Promise.all(
    gameCats.map(async (cat) => {
      const generated = game.imageMode
        ? await generateImageModeCluesForCategory(cat.name, cat.description)
        : await generateCluesForCategory(cat.name, cat.description);

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

      // Start image generation immediately (don't await — let it run concurrently
      // with text generation for other categories still in flight)
      if (game.imageMode) {
        for (let i = 0; i < inserted.length; i++) {
          const clue = inserted[i];
          const imagePrompt = generated[i]?.answer ?? clue.answer;
          imageGenPromises.push(
            generateClueImage(imagePrompt, clue.id).then((imagePath) => {
              if (imagePath) {
                db.update(clues).set({ imagePath }).where(eq(clues.id, clue.id)).run();
              }
            })
          );
        }
      }

      return { category: cat.name, clues: inserted };
    })
  );

  // Wait for all image generation to finish
  if (imageGenPromises.length > 0) {
    await Promise.all(imageGenPromises);
  }

  // Randomly assign one daily double from all inserted clues
  const allInserted = results.flatMap((r) => r.clues);
  if (allInserted.length > 0) {
    const ddClue = allInserted[Math.floor(Math.random() * allInserted.length)];
    db.update(clues)
      .set({ isDailyDouble: true })
      .where(eq(clues.id, ddClue.id))
      .run();
  }

  return NextResponse.json(results.map((r) => ({ category: r.category, clues: r.clues })));
}
