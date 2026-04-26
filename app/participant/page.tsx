"use client";

import { useEffect } from "react";

export default function ParticipantHome() {
  useEffect(() => {
    fetch("/api/games")
      .then((r) => r.json())
      .then((games) => {
        const playing = games.find((g: { state: string }) => g.state === "playing");
        if (playing) {
          window.location.href = `/participant/${playing.id}`;
        }
      });
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center h-screen no-select">
      <h1 className="text-6xl font-bold text-jeopardy-gold mb-4 tracking-wide">
        JEFFARDY!
      </h1>
      <p className="text-2xl text-blue-200">Waiting for game to start...</p>
    </div>
  );
}
