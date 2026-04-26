import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const games = sqliteTable("games", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  state: text("state", { enum: ["setup", "playing", "finished"] })
    .notNull()
    .default("setup"),
  buzzerMode: integer("buzzer_mode", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameId: integer("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  position: integer("position").notNull(),
});

export const clues = sqliteTable("clues", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  value: integer("value").notNull(),
  answer: text("answer").notNull(),
  question: text("question").notNull(),
  isRevealed: integer("is_revealed", { mode: "boolean" })
    .notNull()
    .default(false),
  isDailyDouble: integer("is_daily_double", { mode: "boolean" })
    .notNull()
    .default(false),
  pun: text("pun").notNull().default(""),
});

export const players = sqliteTable("players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameId: integer("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  score: integer("score").notNull().default(0),
});
