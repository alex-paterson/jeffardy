"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";

interface Player {
  id: number;
  name: string;
  score: number;
}

interface GameData {
  id: number;
  name: string;
  players: Player[];
}

export default function FinalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [game, setGame] = useState<GameData | null>(null);

  useEffect(() => {
    fetch(`/api/games/${id}`)
      .then((r) => r.json())
      .then(setGame);
  }, [id]);

  if (!game) {
    return (
      <div className="flex-1 flex items-center justify-center text-2xl text-blue-200">
        Loading...
      </div>
    );
  }

  const ranked = [...game.players].sort((a, b) => b.score - a.score);
  const medals = ["", "", ""];

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-8 pt-14 no-select">
      <h1 className="text-5xl md:text-6xl font-bold text-jeopardy-gold mb-2 tracking-wide">
        FINAL SCORES
      </h1>
      <p className="text-xl text-blue-200 mb-12">{game.name}</p>

      <div className="w-full max-w-2xl space-y-4">
        {ranked.map((player, i) => (
          <div
            key={player.id}
            className={`flex items-center justify-between px-8 py-6 rounded-2xl ${
              i === 0
                ? "bg-jeopardy-gold/20 border-2 border-jeopardy-gold"
                : "bg-white/5 border border-white/10"
            }`}
          >
            <div className="flex items-center gap-4">
              <span className="text-4xl">{medals[i] || `#${i + 1}`}</span>
              <span
                className={`text-3xl font-bold ${
                  i === 0 ? "text-jeopardy-gold" : "text-white"
                }`}
              >
                {player.name}
              </span>
            </div>
            <span
              className={`text-4xl font-bold ${
                player.score >= 0 ? "text-jeopardy-gold" : "text-incorrect"
              }`}
            >
              ${player.score.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      <div className="flex gap-4 mt-12">
        <button
          onClick={() => router.push("/")}
          className="px-8 py-4 bg-jeopardy-gold text-jeopardy-dark font-bold text-xl rounded-xl hover:bg-jeopardy-gold-light transition-colors"
        >
          New Game
        </button>
        <button
          onClick={() => router.push(`/game/${id}/board`)}
          className="px-8 py-4 border border-white/20 text-white font-bold text-xl rounded-xl hover:bg-white/10 transition-colors"
        >
          Review Board
        </button>
      </div>
    </main>
  );
}
