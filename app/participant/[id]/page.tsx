"use client";

import { useState, useEffect, useRef, use } from "react";

interface Player {
  id: number;
  name: string;
  score: number;
}

interface GameData {
  id: number;
  name: string;
  state: string;
  players: Player[];
}

type BuzzerStatus =
  | "waiting"       // no clue active
  | "ready"         // clue active, can buzz
  | "buzzed"        // this player buzzed first
  | "too_late"      // another player buzzed first
  | "locked_out";   // this player was marked wrong for this clue

export default function ParticipantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [game, setGame] = useState<GameData | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [status, setStatus] = useState<BuzzerStatus>("waiting");
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    fetch(`/api/games/${id}`)
      .then((r) => r.json())
      .then((data: GameData) => setGame(data))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!selectedPlayer) return;

    const es = new EventSource(`/api/games/${id}/events`);
    es.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "buzz") {
        if (data.playerId === selectedPlayer.id) {
          setStatus("buzzed");
        } else {
          setStatus((prev) =>
            prev === "locked_out" ? "locked_out" : "too_late"
          );
        }
      } else if (data.type === "buzz-clear") {
        if (data.lockedOutPlayerId === selectedPlayer.id) {
          setStatus("locked_out");
        } else {
          // Someone else was marked wrong — re-enable buzzer unless this player is already locked out
          setStatus((prev) => (prev === "locked_out" ? "locked_out" : "ready"));
        }
      } else if (data.screen === "clue" || data.screen === "daily-double") {
        // Daily double clues (either the splash or after wager locked in) disable buzzers
        setStatus(data.screen === "daily-double" || data.dailyDouble ? "waiting" : "ready");
      } else if (
        data.screen === "board" ||
        data.screen === "answer" ||
        data.screen === "final"
      ) {
        setStatus("waiting");
      }
    };
    eventSourceRef.current = es;

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [id, selectedPlayer]);

  async function handleBuzz() {
    if (!selectedPlayer || status !== "ready") return;

    // Play sound immediately on tap — user interaction means no autoplay block
    new Audio("/buzzer.mp3").play().catch(() => {});

    // Optimistically mark as buzzed to reduce perceived latency
    setStatus("buzzed");

    const res = await fetch(`/api/games/${id}/buzz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId: selectedPlayer.id,
        playerName: selectedPlayer.name,
      }),
    })
      .then((r) => r.json())
      .catch(() => ({ ok: false, reason: "error" }));

    if (!res.ok) {
      if (res.reason === "locked_out") {
        setStatus("locked_out");
      } else if (res.reason === "already_buzzed") {
        setStatus("too_late");
      } else {
        // Network error — revert
        setStatus("ready");
      }
    }
    // On success, SSE will confirm with a buzz event
  }

  if (!game) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-2xl text-blue-200 animate-pulse">Loading...</p>
      </div>
    );
  }

  // Player selection screen
  if (!selectedPlayer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-8 py-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-jeopardy-gold tracking-wide">
            JEFFARDY!
          </h1>
          <p className="text-white/60 mt-1">{game.name}</p>
        </div>
        <p className="text-white text-xl">Who are you?</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {game.players.map((player) => (
            <button
              key={player.id}
              onClick={() => setSelectedPlayer(player)}
              className="w-full py-5 text-2xl font-bold bg-jeopardy-blue border-2 border-jeopardy-gold text-jeopardy-gold rounded-2xl hover:bg-jeopardy-gold hover:text-jeopardy-dark active:scale-95 transition-all"
            >
              {player.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Buzzer screen
  const canBuzz = status === "ready";

  const buttonLabel =
    status === "buzzed"
      ? "BUZZED!"
      : status === "ready"
      ? "BUZZ!"
      : status === "too_late"
      ? "TOO LATE"
      : status === "locked_out"
      ? "LOCKED OUT"
      : "WAIT";

  const buttonClass = canBuzz
    ? "bg-red-600 text-white shadow-[0_10px_0_0_#7f1d1d] active:shadow-[0_3px_0_0_#7f1d1d] active:translate-y-[7px] hover:bg-red-500"
    : status === "buzzed"
    ? "bg-jeopardy-gold text-jeopardy-dark shadow-[0_10px_0_0_#92400e]"
    : "bg-white/10 text-white/30 shadow-[0_10px_0_0_rgba(0,0,0,0.3)]";

  const statusText =
    status === "waiting"
      ? "Waiting for next question..."
      : status === "ready"
      ? "QUESTION ACTIVE — BUZZ IN!"
      : status === "buzzed"
      ? "You buzzed in! Waiting on host..."
      : status === "too_late"
      ? "Someone else buzzed first"
      : "Wrong answer — wait for next question";

  const statusColor =
    status === "ready"
      ? "text-white animate-pulse"
      : status === "buzzed"
      ? "text-jeopardy-gold font-bold"
      : status === "locked_out"
      ? "text-red-400"
      : "text-white/50";

  return (
    <div className="flex flex-col items-center justify-between min-h-screen px-6 py-10 no-select">
      {/* Header */}
      <div className="text-center">
        <p className="text-jeopardy-gold font-bold text-2xl tracking-wide">
          {selectedPlayer.name}
        </p>
        <p className="text-white/40 text-sm mt-0.5">{game.name}</p>
      </div>

      {/* Status */}
      <p className={`text-lg text-center px-4 ${statusColor}`}>{statusText}</p>

      {/* Buzzer Button */}
      <button
        onClick={handleBuzz}
        disabled={!canBuzz}
        className={`w-64 h-64 rounded-full text-3xl font-black tracking-wider transition-all duration-75 select-none touch-none ${buttonClass}`}
      >
        {buttonLabel}
      </button>

      {/* Change player */}
      <button
        onClick={() => {
          setSelectedPlayer(null);
          setStatus("waiting");
          eventSourceRef.current?.close();
        }}
        className="text-white/30 text-sm hover:text-white/60 transition-colors"
      >
        Not {selectedPlayer.name}? Switch
      </button>
    </div>
  );
}
