"use client";

import { useState, useEffect, useRef, use } from "react";

interface Clue {
  id: number;
  categoryId: number;
  value: number;
  answer: string;
  question: string;
  isRevealed: boolean;
  isDailyDouble: boolean;
  pun: string;
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

type TVState =
  | { screen: "waiting" }
  | { screen: "board"; game: GameData; currentPickerId: number | null }
  | { screen: "clue"; clue: Clue; categoryName: string; dailyDouble?: { playerName: string; wager: number } }
  | { screen: "daily-double"; categoryName: string }
  | { screen: "answer"; clue: Clue; categoryName: string }
  | { screen: "final"; players: Player[] };

const VALUES = [200, 400, 600, 800, 1000];

export default function TVPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [tvState, setTvState] = useState<TVState>({ screen: "waiting" });
  const [gameName, setGameName] = useState("");
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load initial state and connect to SSE
  useEffect(() => {
    // Load initial game data
    fetch(`/api/games/${id}`)
      .then((r) => r.json())
      .then((game: GameData) => {
        setGameName(game.name);
        setTvState({
          screen: "board",
          game,
          currentPickerId: null,
        });
      });

    // Connect to SSE
    const es = new EventSource(`/api/games/${id}/events`);
    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setTvState(data as TVState);
      if (data.game?.name) setGameName(data.game.name);
    };
    eventSourceRef.current = es;

    return () => es.close();
  }, [id]);

  // Waiting screen
  if (tvState.screen === "waiting") {
    return (
      <div className="flex items-center justify-center h-screen no-select">
        <p className="text-3xl text-blue-200 animate-pulse">
          Connecting to game...
        </p>
      </div>
    );
  }

  // Daily Double splash
  if (tvState.screen === "daily-double") {
    return (
      <div className="flex flex-col items-center justify-center h-screen no-select">
        <p className="text-jeopardy-gold text-6xl md:text-8xl font-bold animate-pulse">
          DAILY DOUBLE!
        </p>
        <p className="text-white/60 text-2xl md:text-3xl mt-4">
          {tvState.categoryName}
        </p>
      </div>
    );
  }

  // Clue view
  if (tvState.screen === "clue") {
    return (
      <div className="flex flex-col h-screen no-select bg-jeopardy-blue">
        <div className="shrink-0 text-center pt-6 md:pt-10 pb-4">
          <p className="text-jeopardy-gold text-2xl md:text-3xl font-bold uppercase tracking-wider">
            {tvState.categoryName}
          </p>
          <p className="text-jeopardy-gold text-3xl md:text-5xl font-bold mt-2">
            {tvState.dailyDouble
              ? `DAILY DOUBLE — $${tvState.dailyDouble.wager.toLocaleString()} (${tvState.dailyDouble.playerName})`
              : `$${tvState.clue.value}`}
          </p>
        </div>
        <div className="flex-1 flex items-center justify-center px-8 py-4">
          <p className="text-white text-3xl md:text-5xl lg:text-7xl text-center leading-snug font-light max-w-5xl">
            {tvState.clue.answer}
          </p>
        </div>
      </div>
    );
  }

  // Answer revealed
  if (tvState.screen === "answer") {
    return (
      <div className="flex flex-col h-screen no-select bg-jeopardy-blue">
        <div className="shrink-0 text-center pt-6 md:pt-10 pb-4">
          <p className="text-jeopardy-gold text-2xl md:text-3xl font-bold uppercase tracking-wider">
            {tvState.categoryName}
          </p>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-4">
          <p className="text-white/60 text-2xl md:text-3xl lg:text-4xl text-center leading-snug font-light max-w-5xl mb-8">
            {tvState.clue.answer}
          </p>
          <p className="text-jeopardy-gold text-3xl md:text-5xl lg:text-6xl font-bold text-center max-w-4xl">
            {tvState.clue.question}
          </p>
        </div>
      </div>
    );
  }

  // Final scores
  if (tvState.screen === "final") {
    const ranked = [...tvState.players].sort((a, b) => b.score - a.score);
    return (
      <div className="flex flex-col items-center justify-center h-screen no-select px-8">
        <h1 className="text-5xl md:text-7xl font-bold text-jeopardy-gold mb-4 tracking-wide">
          FINAL SCORES
        </h1>
        <p className="text-2xl text-blue-200 mb-12">{gameName}</p>
        <div className="w-full max-w-3xl space-y-4">
          {ranked.map((player, i) => (
            <div
              key={player.id}
              className={`flex items-center justify-between px-8 py-6 rounded-2xl ${
                i === 0
                  ? "bg-jeopardy-gold/20 border-2 border-jeopardy-gold"
                  : "bg-white/5 border border-white/10"
              }`}
            >
              <span
                className={`text-4xl font-bold ${
                  i === 0 ? "text-jeopardy-gold" : "text-white"
                }`}
              >
                #{i + 1} {player.name}
              </span>
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
      </div>
    );
  }

  // Board view (default)
  const { game, currentPickerId } = tvState;

  return (
    <div className="flex flex-col h-screen no-select">
      {/* Board */}
      <div className="flex-1 overflow-y-auto">
        <div
          className="grid gap-1.5 p-3 min-h-full"
          style={{
            gridTemplateColumns: `repeat(${game.categories.length}, minmax(150px, 1fr))`,
            gridTemplateRows: `auto repeat(${VALUES.length}, 1fr)`,
          }}
        >
          {/* Category Headers */}
          {game.categories.map((cat) => (
            <div
              key={`header-${cat.id}`}
              className="bg-jeopardy-blue flex items-center justify-center px-4 py-3 rounded"
            >
              <span className="text-jeopardy-gold font-bold text-xl md:text-2xl lg:text-3xl text-center uppercase tracking-wide">
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
                <div
                  key={clue.id}
                  className={`rounded flex items-center justify-center text-3xl md:text-4xl lg:text-5xl font-bold ${
                    clue.isRevealed
                      ? "bg-board-cell-revealed text-white/10"
                      : "bg-board-cell text-jeopardy-gold"
                  }`}
                >
                  {clue.isRevealed ? "" : `$${value}`}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Score Bar */}
      <div className="shrink-0 flex justify-center gap-6 md:gap-10 p-4 md:p-6 bg-black/40">
        {game.players.map((player) => {
          const isPicker = currentPickerId === player.id;
          return (
            <div
              key={player.id}
              className={`text-center px-6 py-3 rounded-lg transition-colors ${
                isPicker
                  ? "bg-jeopardy-gold/15 border-2 border-jeopardy-gold"
                  : "border-2 border-transparent"
              }`}
            >
              <p
                className={`text-lg md:text-2xl font-medium ${
                  isPicker ? "text-jeopardy-gold" : "text-white"
                }`}
              >
                {player.name}
              </p>
              {isPicker && (
                <p className="text-xs md:text-sm text-jeopardy-gold/70 uppercase tracking-wider">
                  picking
                </p>
              )}
              <p
                className={`text-2xl md:text-4xl font-bold ${
                  player.score >= 0 ? "text-jeopardy-gold" : "text-incorrect"
                }`}
              >
                ${player.score.toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
