"use client";

import { useState, useEffect, use } from "react";
import ClueModal from "@/components/ClueModal";

interface Clue {
  id: number;
  categoryId: number;
  value: number;
  answer: string;
  question: string;
  isRevealed: boolean;
  isDailyDouble: boolean;
}

interface Category {
  id: number;
  name: string;
  position: number;
  clues: Clue[];
}

interface Player {
  id: number;
  name: string;
  score: number;
}

interface GameData {
  id: number;
  name: string;
  state: string;
  categories: Category[];
  players: Player[];
}

const VALUES = [200, 400, 600, 800, 1000];

export default function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [game, setGame] = useState<GameData | null>(null);
  const [activeClue, setActiveClue] = useState<{
    clue: Clue;
    categoryName: string;
  } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [currentPickerId, setCurrentPickerId] = useState<number | null>(null);
  const currentPicker = game?.players.find((p) => p.id === currentPickerId) ?? null;

  // Load game data once on mount
  useEffect(() => {
    fetch(`/api/games/${id}`)
      .then((r) => r.json())
      .then(setGame)
      .catch(() => setLoadError(true));
  }, [id]);

  function handleClueClick(clue: Clue, categoryName: string) {
    if (clue.isRevealed) return;
    setActiveClue({ clue, categoryName });
  }

  function handleClueCancel() {
    setActiveClue(null);
  }

  function handleClueClose(updatedPlayers: Player[], correctPlayerId?: number) {
    if (correctPlayerId) {
      setCurrentPickerId(correctPlayerId);
    }

    setGame((prev) => {
      if (!prev) return prev;

      const newGame = {
        ...prev,
        players: updatedPlayers,
        categories: prev.categories.map((cat) => ({
          ...cat,
          clues: cat.clues.map((c) =>
            c.id === activeClue?.clue.id ? { ...c, isRevealed: true } : c
          ),
        })),
      };

      // Check if all clues are revealed
      const allRevealed = newGame.categories.every((cat) =>
        cat.clues.every((c) => c.isRevealed)
      );
      if (allRevealed) {
        fetch(`/api/games/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: "finished" }),
        }).catch(() => {});
        setTimeout(() => {
          window.location.href = `/game/${id}/final`;
        }, 1500);
      }

      return newGame;
    });

    setActiveClue(null);
  }

  if (loadError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-2xl text-blue-200 gap-4">
        <p>Failed to load game</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-jeopardy-gold text-jeopardy-dark font-bold rounded-lg text-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="flex-1 flex items-center justify-center text-2xl text-blue-200">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen no-select">
      {/* Board */}
      <div className="flex-1 overflow-y-auto">
      <div className="grid gap-1 p-2 min-h-full" style={{
        gridTemplateColumns: `repeat(${game.categories.length}, minmax(150px, 1fr))`,
        gridTemplateRows: `auto repeat(${VALUES.length}, 1fr)`,
      }}>
        {/* Category Headers */}
        {game.categories.map((cat) => (
          <div
            key={`header-${cat.id}`}
            className="bg-jeopardy-blue flex items-center justify-center px-4 py-2 rounded"
          >
            <span className="text-jeopardy-gold font-bold text-lg md:text-xl lg:text-2xl text-center uppercase tracking-wide">
              {cat.name}
            </span>
          </div>
        ))}

        {/* Clue Grid */}
        {VALUES.map((value) =>
          game.categories.map((cat) => {
            const clue = cat.clues.find((c) => c.value === value);
            if (!clue) {
              return (
                <div
                  key={`empty-${cat.id}-${value}`}
                  className="bg-board-cell-revealed rounded"
                />
              );
            }
            return (
              <button
                key={clue.id}
                onClick={() => handleClueClick(clue, cat.name)}
                disabled={clue.isRevealed}
                className={`rounded flex items-center justify-center px-4 py-2 text-2xl md:text-3xl lg:text-4xl font-bold transition-all ${
                  clue.isRevealed
                    ? "bg-board-cell-revealed text-white/10"
                    : "bg-board-cell text-jeopardy-gold hover:bg-board-cell-hover hover:scale-[1.02] cursor-pointer active:scale-95"
                }`}
              >
                {clue.isRevealed ? "" : `$${value}`}
              </button>
            );
          })
        )}
      </div>
      </div>

      {/* Score Bar */}
      <div className="shrink-0 flex justify-center gap-4 md:gap-6 p-3 md:p-4 bg-black/40">
        {game.players.map((player) => {
          const isPicker = currentPicker?.id === player.id;
          return (
            <div
              key={player.id}
              className={`text-center px-4 py-2 rounded-lg transition-colors ${
                isPicker
                  ? "bg-jeopardy-gold/15 border-2 border-jeopardy-gold"
                  : "border-2 border-transparent"
              }`}
            >
              <p className={`text-sm md:text-lg font-medium ${
                isPicker ? "text-jeopardy-gold" : "text-white"
              }`}>
                {player.name}
              </p>
              {isPicker && (
                <p className="text-[10px] md:text-xs text-jeopardy-gold/70 uppercase tracking-wider">
                  picking
                </p>
              )}
              <p
                className={`text-xl md:text-2xl font-bold ${
                  player.score >= 0 ? "text-jeopardy-gold" : "text-incorrect"
                }`}
              >
                ${player.score.toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>

      {/* Clue Modal */}
      {activeClue && (
        <ClueModal
          clue={activeClue.clue}
          categoryName={activeClue.categoryName}
          players={game.players}
          currentPicker={currentPicker}
          onClose={handleClueClose}
          onCancel={handleClueCancel}
        />
      )}
    </div>
  );
}
