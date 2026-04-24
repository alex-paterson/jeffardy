"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";

interface Game {
  id: number;
  name: string;
  state: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const isTVMode = pathname.startsWith("/tv");

  // Extract current game ID from path
  const gameMatch = pathname.match(/(?:\/game|\/tv)\/(\d+)/);
  const currentGameId = gameMatch ? parseInt(gameMatch[1]) : null;

  const loadGames = useCallback(() => {
    fetch("/api/games")
      .then((r) => r.json())
      .then(setGames)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (open) loadGames();
  }, [open, loadGames]);

  // Close sidebar on navigation
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  async function createGame() {
    setCreating(true);
    const name = newName.trim() || `Game ${new Date().toLocaleDateString()}`;
    const res = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const game = await res.json();
    setNewName("");
    setCreating(false);
    window.location.href = `/game/${game.id}/setup`;
  }

  function goToGame(game: Game) {
    if (isTVMode) {
      window.location.href = `/tv/${game.id}`;
    } else if (game.state === "setup") {
      window.location.href = `/game/${game.id}/setup`;
    } else if (game.state === "playing") {
      window.location.href = `/game/${game.id}/board`;
    } else {
      window.location.href = `/game/${game.id}/final`;
    }
  }

  return (
    <>
      {/* Toggle Button — always visible */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-3 left-3 z-[60] w-10 h-10 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors"
        aria-label="Toggle menu"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 5h14M3 10h14M3 15h14" />
          </svg>
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-[55]"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar Panel */}
      <div
        className={`fixed top-0 left-0 h-full w-72 bg-jeopardy-dark border-r border-white/10 z-[60] transform transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } flex flex-col`}
      >
        {/* Header */}
        <div className="p-4 pt-16">
          <h2
            className="text-jeopardy-gold font-bold text-xl tracking-wide cursor-pointer hover:opacity-80"
            onClick={() => (window.location.href = isTVMode ? "/tv" : "/")}
          >
            JEFFARDY!
          </h2>
        </div>

        {/* New Game — host only */}
        {!isTVMode && (
          <div className="px-4 pb-4 border-b border-white/10">
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createGame()}
                placeholder="Game name"
                className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder-white/30 focus:outline-none focus:border-jeopardy-gold"
              />
              <button
                onClick={createGame}
                disabled={creating}
                className="px-3 py-2 bg-jeopardy-gold text-jeopardy-dark font-bold rounded-lg text-sm hover:bg-jeopardy-gold-light disabled:opacity-50 transition-colors shrink-0"
              >
                {creating ? "..." : "New"}
              </button>
            </div>
          </div>
        )}

        {/* Game List */}
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-xs uppercase tracking-widest text-white/40 mb-3">
            Games
          </p>
          {games.length === 0 && (
            <p className="text-white/30 text-sm">No games yet</p>
          )}
          <div className="space-y-1">
            {games.map((game) => {
              const isCurrent = game.id === currentGameId;
              return (
                <div key={game.id}>
                  <button
                    onClick={() => goToGame(game)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                      isCurrent
                        ? "bg-jeopardy-gold/20 text-jeopardy-gold border border-jeopardy-gold/30"
                        : "text-white hover:bg-white/10"
                    }`}
                  >
                    <span className="truncate font-medium">{game.name}</span>
                    <span
                      className={`text-xs capitalize shrink-0 ml-2 ${
                        isCurrent ? "text-jeopardy-gold/70" : "text-white/40"
                      }`}
                    >
                      {game.state}
                    </span>
                  </button>

                  {/* Quick actions for current game — host only */}
                  {isCurrent && game.state !== "setup" && !isTVMode && (
                    <div className="ml-3 mt-1 mb-2 flex flex-col gap-1">
                      <button
                        onClick={() =>
                          (window.location.href = `/game/${game.id}/setup`)
                        }
                        className="w-full text-left text-xs text-jeopardy-gold/80 hover:text-jeopardy-gold px-3 py-1.5 rounded-md border border-jeopardy-gold/20 hover:border-jeopardy-gold/40 hover:bg-jeopardy-gold/10 transition-colors"
                      >
                        Edit clues & players
                      </button>
                      {game.state === "finished" && (
                        <button
                          onClick={() =>
                            (window.location.href = `/game/${game.id}/board`)
                          }
                          className="w-full text-left text-xs text-jeopardy-gold/80 hover:text-jeopardy-gold px-3 py-1.5 rounded-md border border-jeopardy-gold/20 hover:border-jeopardy-gold/40 hover:bg-jeopardy-gold/10 transition-colors"
                        >
                          Review board
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => (window.location.href = isTVMode ? "/tv" : "/")}
            className="w-full text-left px-3 py-2 text-sm text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            Home
          </button>
        </div>
      </div>
    </>
  );
}
