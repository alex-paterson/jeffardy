import { NextResponse } from "next/server";
import { db } from "@/db";
import { clues, categories, games } from "@/db/schema";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
import fs from "fs";
import path from "path";

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

  const game = db.select().from(games).where(eq(games.id, category.gameId)).get();

  // Get all existing clues in this category to avoid repeats
  const existingClues = db
    .select()
    .from(clues)
    .where(eq(clues.categoryId, clue.categoryId))
    .all();

  let parsed: { answer: string; question: string; pun: string };

  if (game?.imageMode) {
    const avoidList = existingClues
      .filter((c) => c.id !== clueId)
      .map((c) => `- ${c.question}`)
      .join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 512,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You generate subjects for a visual guessing game. Always respond with valid JSON.
The subject must be real and visually identifiable — something that can be clearly depicted in an image with no text.`,
        },
        {
          role: "user",
          content: `Generate 1 NEW visual subject for the category "${category.name}" at the $${clue.value} difficulty level.
${category.description ? `Category hint: "${category.description}"` : ""}

IMPORTANT: Do NOT repeat any of these existing answers:
${avoidList}

Return a JSON object with:
- "answer": a short, vivid image prompt describing exactly what to draw (one clear, unambiguous subject — no text in image)
- "question": the correct response (in "What is...?" or "Who is...?" form)
- "pun": a short witty one-liner related to the subject

Difficulty: $${clue.value} (${clue.value <= 200 ? "easy/instantly recognisable" : clue.value <= 400 ? "well-known" : clue.value <= 600 ? "moderately specific" : clue.value <= 800 ? "requires familiarity" : "niche/challenging"}).`,
        },
      ],
    });

    const rawText = response.choices[0]?.message?.content ?? "";
    parsed = JSON.parse(rawText);
  } else {
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
          content: `You generate Jeopardy-style clues. Always respond with valid JSON.
Every fact must be 100% real and verifiable — no fictional or invented information.
Each clue must unambiguously point to exactly one correct answer so the contestant knows precisely what to name or identify.
The "answer" field is a statement read aloud; the "question" field is the response in "What is...?" or "Who is...?" form.`,
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

Difficulty: $${clue.value} (${clue.value <= 200 ? "easy" : clue.value <= 400 ? "easy-moderate" : clue.value <= 600 ? "moderate" : clue.value <= 800 ? "tricky" : "challenging"}).
Write a clever, indirect clue. Make players think.`,
        },
      ],
    });

    const rawText = response.choices[0]?.message?.content ?? "";
    parsed = JSON.parse(rawText);
  }

  // Generate new image if in image mode
  let imagePath = clue.imagePath;
  if (game?.imageMode) {
    // Delete old image
    if (clue.imagePath) {
      const oldPath = path.join(process.cwd(), "public", clue.imagePath);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    try {
      const imageDir = path.join(process.cwd(), "public", "images");
      if (!fs.existsSync(imageDir)) fs.mkdirSync(imageDir, { recursive: true });

      console.log(`[image] regen clue ${clueId}: "${parsed.answer}"`);
      const imgResponse = await openai.images.generate({
        model: "dall-e-3",
        prompt: `${parsed.answer}. No text, labels, or words in the image. Clean, bold, iconic visual style.`,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
      });

      const b64 = imgResponse.data?.[0]?.b64_json;
      if (b64) {
        const filePath = path.join(imageDir, `clue-${clueId}.png`);
        fs.writeFileSync(filePath, Buffer.from(b64, "base64"));
        imagePath = `/images/clue-${clueId}.png`;
        console.log(`[image] regen clue ${clueId}: saved`);
      } else {
        console.error(`[image] regen clue ${clueId}: no b64 data`);
      }
    } catch (err: unknown) {
      console.error(`[image] regen clue ${clueId}: failed —`, (err as { message?: string })?.message ?? err);
    }
  }

  const updated = db
    .update(clues)
    .set({
      answer: parsed.answer,
      question: parsed.question,
      pun: parsed.pun || "",
      imagePath,
    })
    .where(eq(clues.id, clueId))
    .returning()
    .get();

  return NextResponse.json(updated);
}
