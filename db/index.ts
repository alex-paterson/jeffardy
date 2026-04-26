import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "jeopardy.db");

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

// Auto-create tables if they don't exist
const initSql = `
CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'setup',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS clues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  value INTEGER NOT NULL,
  answer TEXT NOT NULL,
  question TEXT NOT NULL,
  is_revealed INTEGER NOT NULL DEFAULT 0,
  is_daily_double INTEGER NOT NULL DEFAULT 0,
  pun TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0
);
`;

sqlite.exec(initSql);

// Migrations for existing databases
try {
  sqlite.exec(`ALTER TABLE clues ADD COLUMN is_daily_double INTEGER NOT NULL DEFAULT 0`);
} catch {
  // Column already exists
}
try {
  sqlite.exec(`ALTER TABLE categories ADD COLUMN description TEXT NOT NULL DEFAULT ''`);
} catch {
  // Column already exists
}
try {
  sqlite.exec(`ALTER TABLE clues ADD COLUMN pun TEXT NOT NULL DEFAULT ''`);
} catch {
  // Column already exists
}
try {
  sqlite.exec(`ALTER TABLE games ADD COLUMN buzzer_mode INTEGER NOT NULL DEFAULT 0`);
} catch {
  // Column already exists
}
