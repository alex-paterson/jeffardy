🚨 Made with Claude

---

# Jeffardy

An AI-powered Jeopardy game for hosting with friends. The host controls the board, players buzz in on their phones, and a TV display shows the game state in real time.

## Features

- AI-generated clue boards using OpenAI (with a two-pass reflection step for accuracy)
- Real-time buzzer system via Server-Sent Events — players buzz in on their phones
- Three views: host controller, TV display, and participant buzzer
- Daily Double support with wager input
- Score tracking with correct/incorrect marking
- Clone games to reuse categories with fresh AI-generated clues
- Regenerate individual clues without redoing the whole board
- Optional "Guests use buzzers" mode — host sees only the player who buzzed first

## Prerequisites

- Node.js 20+
- An [OpenAI API key](https://platform.openai.com/api-keys)

## Setup

1. Clone the repo and install dependencies:

   ```bash
   git clone <repo-url>
   cd jeffardy
   npm install
   ```

2. Create a `.env.local` file in the project root:

   ```bash
   cp .env.example .env.local
   ```

   Then edit `.env.local` and add your OpenAI API key:

   ```
   OPENAI_API_KEY=sk-...
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

This starts two servers:

- **Port 3000** — host controller (keep this on your device)
- **Port 3001** — TV display and participant buzzer proxy (open on the TV and players' phones)

## Usage

| URL | Who uses it |
|-----|-------------|
| `http://localhost:3000` | Host — create games, control the board, mark answers |
| `http://<your-ip>:3001/tv/<game-id>` | TV — cast this to the screen |
| `http://<your-ip>:3001/participant/<game-id>` | Players — open on phone to buzz in |

### Quick start

1. Open the host view at `http://localhost:3000`
2. Create a new game and add categories (with optional description hints for the AI)
3. Add players
4. Click **Generate Clues** to have AI write the board
5. Click **Start Game** — the board appears
6. Share the participant URL with players so they can buzz in on their phones
7. Open the TV URL on your display

### Buzzer mode

Enable **"Guests use buzzers"** on the setup page to activate phone-based buzzing:

- Players open the participant URL and select their name
- A 5-second delay after each clue opens prevents early buzzing
- Buzzing during the delay applies a 2-second penalty
- The host sees who buzzed first and marks correct/incorrect
- A wrong answer locks that player out until the next clue

## Tech stack

- [Next.js 16](https://nextjs.org) — React framework, App Router
- [Drizzle ORM](https://orm.drizzle.team) + SQLite (better-sqlite3) — local database
- [OpenAI API](https://platform.openai.com) — clue generation (GPT)
- Server-Sent Events — real-time game state to TV and participants
- [Tailwind CSS 4](https://tailwindcss.com) — styling
