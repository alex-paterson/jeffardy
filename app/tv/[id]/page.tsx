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
  imagePath: string;
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
  | { screen: "daily-double"; categoryName: string; playerName?: string; playerScore?: number; clueValue?: number }
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
  const [buzzer, setBuzzer] = useState<{ playerName: string } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const buzzerAudioRef = useRef<HTMLAudioElement | null>(null);

  // Preload audio and unlock it on the first click anywhere (browser autoplay policy)
  useEffect(() => {
    const audio = new Audio("/buzzer.mp3");
    audio.load();
    buzzerAudioRef.current = audio;

    function unlock() {
      audio.play()
        .then(() => { audio.pause(); audio.currentTime = 0; setSoundEnabled(true); })
        .catch(() => {});
      document.removeEventListener("click", unlock);
    }
    document.addEventListener("click", unlock);
    return () => document.removeEventListener("click", unlock);
  }, []);

  function playBuzzer() {
    const audio = buzzerAudioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

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
      if (data.type === "buzz") {
        setBuzzer({ playerName: data.playerName });
        playBuzzer();
      } else if (data.type === "buzz-clear") {
        setBuzzer(null);
      } else {
        setTvState(data as TVState);
        if (data.game?.name) setGameName(data.game.name);
        // Clear buzzer whenever we transition screens
        if (data.screen) setBuzzer(null);
      }
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
        {!soundEnabled && (
          <p className="absolute bottom-6 text-white/30 text-sm">Click anywhere to enable sound</p>
        )}
      </div>
    );
  }

  // Daily Double splash
  if (tvState.screen === "daily-double") {
    const { playerName, playerScore, clueValue } = tvState;
    const minWager = playerScore !== undefined && playerScore <= 0 ? 5 : 200;
    const maxWager =
      playerScore !== undefined && clueValue !== undefined
        ? playerScore > 0
          ? playerScore
          : clueValue
        : undefined;

    return (
      <div className="flex flex-col items-center justify-center h-screen no-select">
        <p className="text-jeopardy-gold text-6xl md:text-8xl font-bold animate-pulse">
          DAILY DOUBLE!
        </p>
        <p className="text-white/60 text-2xl md:text-3xl mt-4">
          {tvState.categoryName}
        </p>
        {playerName && maxWager !== undefined && (
          <p className="text-white text-2xl md:text-3xl mt-8 font-semibold">
            {playerName}
          </p>
        )}
        {maxWager !== undefined && (
          <p className="text-blue-200 text-xl md:text-2xl mt-2">
            Wager: ${minWager.toLocaleString()} – ${maxWager.toLocaleString()}
          </p>
        )}
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
          {tvState.clue.imagePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tvState.clue.imagePath}
              alt="Image clue"
              className="max-h-[60vh] max-w-full object-contain rounded-xl"
            />
          ) : (
            <p className="text-white text-2xl md:text-4xl lg:text-5xl text-center leading-snug font-light max-w-5xl">
              {tvState.clue.answer}
            </p>
          )}
        </div>
        {buzzer && (
          <div className="shrink-0 py-4 text-center animate-pulse">
            <p className="text-jeopardy-gold text-3xl md:text-5xl font-black tracking-wide">
              🔔 {buzzer.playerName}!
            </p>
          </div>
        )}
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
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-4 gap-6">
          {tvState.clue.imagePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tvState.clue.imagePath}
              alt="Image clue"
              className="max-h-48 md:max-h-64 object-contain rounded-xl opacity-60"
            />
          ) : (
            <p className="text-white/60 text-2xl md:text-3xl lg:text-4xl text-center leading-snug font-light max-w-5xl">
              {tvState.clue.answer}
            </p>
          )}
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
      {/* Game name */}
      <div className="shrink-0 text-center pt-2 pb-1">
        <p className="text-white/40 text-sm uppercase tracking-widest">{gameName}</p>
      </div>
      {/* Sound status indicator — disappears once enabled */}
      {!soundEnabled && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="bg-black/70 border-2 border-jeopardy-gold rounded-2xl px-10 py-6 text-center">
            <p className="text-jeopardy-gold text-3xl font-black mb-1">🔇 Sound is off</p>
            <p className="text-white text-lg">Click anywhere to enable buzzer sound</p>
          </div>
        </div>
      )}
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
