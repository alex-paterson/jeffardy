"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Game {
  id: number;
  name: string;
  state: string;
  createdAt: string;
}

export default function Home() {
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/games")
      .then((r) => r.json())
      .then(setGames);
  }, []);

  async function createGame() {
    setCreating(true);
    try {
      const name = newName.trim() || `Game ${new Date().toLocaleDateString()}`;
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const game = await res.json();
      window.location.href = `/game/${game.id}/setup`;
    } catch {
      setCreating(false);
    }
  }

  function resumeGame(game: Game) {
    if (game.state === "setup") {
      router.push(`/game/${game.id}/setup`);
    } else if (game.state === "playing") {
      router.push(`/game/${game.id}/board`);
    } else {
      router.push(`/game/${game.id}/final`);
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-8">
      <h1 className="text-6xl font-bold text-jeopardy-gold mb-2 tracking-wide">
        JEOPARDY!
      </h1>
      <p className="text-xl text-blue-200 mb-12">AI-Powered Party Game</p>

      <div className="flex gap-3 mb-12 w-full max-w-md">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Game name (e.g. Friday Night)"
          onKeyDown={(e) => e.key === "Enter" && createGame()}
          className="flex-1 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 text-lg focus:outline-none focus:border-jeopardy-gold"
        />
        <button
          type="button"
          onClick={createGame}
          disabled={creating}
          className="px-6 py-3 bg-jeopardy-gold text-jeopardy-dark font-bold rounded-lg text-lg hover:bg-jeopardy-gold-light disabled:opacity-50 transition-colors"
        >
          {creating ? "..." : "New Game"}
        </button>
      </div>

      {games.length > 0 && (
        <div className="w-full max-w-md">
          <h2 className="text-sm uppercase tracking-widest text-blue-300 mb-3">
            Previous Games
          </h2>
          <div className="space-y-2">
            {games.map((game) => (
              <button
                key={game.id}
                onClick={() => resumeGame(game)}
                className="w-full text-left px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex items-center justify-between"
              >
                <span className="font-medium">{game.name}</span>
                <span className="text-sm text-blue-300 capitalize">
                  {game.state}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
