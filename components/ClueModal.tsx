"use client";

import { useState, useRef } from "react";

interface Player {
  id: number;
  name: string;
  score: number;
}

interface Clue {
  id: number;
  categoryId: number;
  value: number;
  answer: string;
  question: string;
  isRevealed: boolean;
  isDailyDouble: boolean;
}

interface ClueModalProps {
  clue: Clue;
  categoryName: string;
  players: Player[];
  currentPicker: Player | null;
  onClose: (updatedPlayers: Player[], correctPlayerId?: number) => void;
  onCancel: () => void;
}

function persist(url: string, body: Record<string, unknown>) {
  fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export default function ClueModal({
  clue,
  categoryName,
  players,
  currentPicker,
  onClose,
  onCancel,
}: ClueModalProps) {
  // Daily double: skip pick-player if we already know who's picking
  const autoPickDD = clue.isDailyDouble && currentPicker;
  const [ddPhase, setDdPhase] = useState<
    "pick-player" | "wager" | "play"
  >(clue.isDailyDouble ? (autoPickDD ? "wager" : "pick-player") : "play");
  const [ddPlayer, setDdPlayer] = useState<Player | null>(
    autoPickDD ? currentPicker : null
  );
  const [wager, setWager] = useState(() => {
    if (autoPickDD && currentPicker) {
      const maxWager = currentPicker.score > 0 ? currentPicker.score : clue.value;
      return Math.min(clue.value, maxWager);
    }
    return clue.value;
  });

  // Normal play state
  const [showQuestion, setShowQuestion] = useState(false);
  const [peeking, setPeeking] = useState(false);
  const [answeredWrong, setAnsweredWrong] = useState<Set<number>>(new Set());
  const [updatedPlayers, setUpdatedPlayers] = useState<Player[]>(players);
  const [resolved, setResolved] = useState(false);
  const [correctPlayerId, setCorrectPlayerId] = useState<number | undefined>(undefined);
  const resolvedRef = useRef(false);

  const effectiveValue = clue.isDailyDouble && ddPlayer ? wager : clue.value;

  function resolve() {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    persist(`/api/clues/${clue.id}`, { isRevealed: true });
    setShowQuestion(true);
    setResolved(true);
  }

  function handleCorrect(player: Player) {
    const newScore = player.score + effectiveValue;
    setUpdatedPlayers((prev) =>
      prev.map((p) => (p.id === player.id ? { ...p, score: newScore } : p))
    );
    setCorrectPlayerId(player.id);
    persist(`/api/players/${player.id}/score`, { delta: effectiveValue });
    resolve();
  }

  function handleWrong(player: Player) {
    const newScore = player.score - effectiveValue;
    setUpdatedPlayers((prev) =>
      prev.map((p) => (p.id === player.id ? { ...p, score: newScore } : p))
    );
    persist(`/api/players/${player.id}/score`, { delta: -effectiveValue });

    const newWrong = new Set(answeredWrong).add(player.id);
    setAnsweredWrong(newWrong);

    // For daily double, only one player answers
    if (clue.isDailyDouble || newWrong.size >= players.length) {
      resolve();
    }
  }

  const availablePlayers = updatedPlayers.filter(
    (p) => !answeredWrong.has(p.id)
  );

  // Daily Double: pick player
  if (ddPhase === "pick-player") {
    return (
      <div className="fixed inset-0 z-50 no-select bg-jeopardy-blue flex flex-col items-center justify-center overflow-y-auto">
        <p className="text-jeopardy-gold text-4xl md:text-6xl font-bold mb-2 animate-pulse">
          DAILY DOUBLE!
        </p>
        <p className="text-white/60 text-lg md:text-xl mb-8">
          {categoryName} - ${clue.value}
        </p>
        <p className="text-blue-200 text-lg mb-4">Who selected this clue?</p>
        <div className="flex flex-wrap justify-center gap-3">
          {players.map((player) => (
            <button
              key={player.id}
              onClick={() => {
                setDdPlayer(player);
                // Default wager: clue value, clamped to valid range
                const maxWager =
                  player.score > 0 ? player.score : clue.value;
                setWager(Math.min(clue.value, maxWager));
                setDdPhase("wager");
              }}
              className="px-6 py-3 bg-jeopardy-gold text-jeopardy-dark font-bold text-lg rounded-lg hover:bg-jeopardy-gold-light transition-colors"
            >
              {player.name}
            </button>
          ))}
        </div>
        <button
          onClick={onCancel}
          className="mt-6 px-4 py-2 text-sm text-white/40 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  // Daily Double: wager
  if (ddPhase === "wager" && ddPlayer) {
    const minWager = ddPlayer.score <= 0 ? 5 : 200;
    const maxWager =
      ddPlayer.score > 0 ? ddPlayer.score : clue.value;
    const clampedWager = Math.max(minWager, Math.min(wager, maxWager));

    return (
      <div className="fixed inset-0 z-50 no-select bg-jeopardy-blue flex flex-col items-center justify-center overflow-y-auto px-4">
        <p className="text-jeopardy-gold text-3xl md:text-5xl font-bold mb-2">
          DAILY DOUBLE!
        </p>
        <p className="text-white text-xl md:text-2xl mb-1">
          {ddPlayer.name}&apos;s wager
        </p>
        <p className="text-white/50 text-sm mb-6">
          Current score: ${ddPlayer.score.toLocaleString()} | Range: ${minWager} - ${maxWager.toLocaleString()}
        </p>

        <div className="flex items-center gap-4 mb-8">
          <span className="text-jeopardy-gold text-4xl font-bold">$</span>
          <input
            type="number"
            value={wager}
            onChange={(e) => setWager(parseInt(e.target.value) || 0)}
            min={minWager}
            max={maxWager}
            className="w-40 px-4 py-3 text-3xl font-bold text-center rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-jeopardy-gold"
          />
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {[200, 400, 600, 800, 1000].map((v) =>
            v >= minWager && v <= maxWager ? (
              <button
                key={v}
                onClick={() => setWager(v)}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
                  wager === v
                    ? "bg-jeopardy-gold text-jeopardy-dark"
                    : "border border-white/20 text-white/60 hover:bg-white/10"
                }`}
              >
                ${v}
              </button>
            ) : null
          )}
          {maxWager > 1000 && (
            <button
              onClick={() => setWager(maxWager)}
              className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
                wager === maxWager
                  ? "bg-jeopardy-gold text-jeopardy-dark"
                  : "border border-white/20 text-white/60 hover:bg-white/10"
              }`}
            >
              ALL IN (${maxWager.toLocaleString()})
            </button>
          )}
        </div>

        <button
          onClick={() => {
            setWager(Math.max(minWager, Math.min(clampedWager, maxWager)));
            setDdPhase("play");
          }}
          className="px-10 py-4 bg-jeopardy-gold text-jeopardy-dark font-bold text-xl rounded-xl hover:bg-jeopardy-gold-light transition-colors"
        >
          Lock In Wager
        </button>
      </div>
    );
  }

  // Normal play (or daily double after wager)
  return (
    <div className="fixed inset-0 z-50 no-select bg-jeopardy-blue flex flex-col overflow-y-auto">
      {/* Category & Value */}
      <div className="shrink-0 text-center pt-4 pb-2 px-4 md:pt-8 md:pb-4">
        <p className="text-jeopardy-gold text-lg md:text-2xl font-bold uppercase tracking-wider">
          {categoryName}
        </p>
        <p className="text-jeopardy-gold text-2xl md:text-4xl font-bold mt-1">
          {clue.isDailyDouble ? (
            <>DAILY DOUBLE - ${effectiveValue.toLocaleString()} wager</>
          ) : (
            <>${clue.value}</>
          )}
        </p>
      </div>

      {/* Clue Text */}
      <div className="flex-1 flex items-center justify-center px-6 py-4">
        <div className="text-center max-w-4xl">
          <p className="text-white text-2xl md:text-4xl lg:text-6xl leading-snug font-light">
            {clue.answer}
          </p>
          {showQuestion && (
            <p className="text-jeopardy-gold text-xl md:text-3xl lg:text-4xl font-bold mt-6">
              {clue.question}
            </p>
          )}
          {!showQuestion && peeking && (
            <p className="text-white/30 text-lg md:text-xl mt-6 italic">
              {clue.question}
            </p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="shrink-0 px-4 pb-4 md:px-8 md:pb-8">
        {!resolved ? (
          <div className="flex flex-col items-center gap-3">
            {clue.isDailyDouble && ddPlayer ? (
              <>
                <p className="text-blue-200 text-sm md:text-lg">
                  {ddPlayer.name} wagered ${effectiveValue.toLocaleString()}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCorrect(ddPlayer)}
                    className="px-5 py-3 bg-correct text-white font-bold rounded-lg text-lg hover:brightness-110 transition"
                  >
                    Correct +${effectiveValue.toLocaleString()}
                  </button>
                  <button
                    onClick={() => handleWrong(ddPlayer)}
                    className="px-5 py-3 bg-incorrect text-white font-bold rounded-lg text-lg hover:brightness-110 transition"
                  >
                    Wrong -${effectiveValue.toLocaleString()}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-blue-200 text-sm md:text-lg">
                  Who answered?
                </p>
                <div className="flex flex-wrap justify-center gap-2 md:gap-3">
                  {availablePlayers.map((player) => (
                    <div key={player.id} className="flex gap-1">
                      <button
                        onClick={() => handleCorrect(player)}
                        className="px-3 py-2 md:px-5 md:py-3 bg-correct text-white font-bold rounded-l-lg text-sm md:text-lg hover:brightness-110 transition"
                      >
                        {player.name} +${clue.value}
                      </button>
                      <button
                        onClick={() => handleWrong(player)}
                        className="px-2 py-2 md:px-3 md:py-3 bg-incorrect text-white font-bold rounded-r-lg text-sm md:text-lg hover:brightness-110 transition"
                      >
                        X
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="flex gap-3">
              <button
                onPointerDown={() => setPeeking(true)}
                onPointerUp={() => setPeeking(false)}
                onPointerLeave={() => setPeeking(false)}
                className={`px-4 py-2 text-sm md:text-base border rounded-lg transition-colors ${
                  peeking
                    ? "text-white/80 border-white/40 bg-white/10"
                    : "text-white/60 border-white/20 hover:bg-white/10"
                }`}
              >
                Peek Answer
              </button>
              {!(clue.isDailyDouble && ddPlayer) && (
                <button
                  onClick={resolve}
                  className="px-4 py-2 text-sm md:text-base text-white/60 border border-white/20 rounded-lg hover:bg-white/10 transition-colors"
                >
                  No one answered
                </button>
              )}
              {answeredWrong.size === 0 && (
                <button
                  onClick={onCancel}
                  className="px-4 py-2 text-sm md:text-base text-white/40 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
                >
                  Go Back
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={() => onClose(updatedPlayers, correctPlayerId)}
              className="px-8 py-3 md:px-10 md:py-4 bg-jeopardy-gold text-jeopardy-dark font-bold text-lg md:text-xl rounded-xl hover:bg-jeopardy-gold-light transition-colors"
            >
              Back to Board
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
