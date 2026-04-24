"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";

interface ClueData {
  id: number;
  categoryId: number;
  value: number;
  answer: string;
  question: string;
  isDailyDouble: boolean;
  pun: string;
}

interface CategoryData {
  id: number;
  name: string;
  clues: ClueData[];
}

interface GameData {
  id: number;
  name: string;
  state: string;
  categories: CategoryData[];
  players: { id: number; name: string; score: number }[];
}

export default function SetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [game, setGame] = useState<GameData | null>(null);
  const [categoryInputs, setCategoryInputs] = useState<{ name: string; description: string }[]>([
    { name: "", description: "" },
    { name: "", description: "" },
    { name: "", description: "" },
    { name: "", description: "" },
    { name: "", description: "" },
    { name: "", description: "" },
  ]);
  const [playerInputs, setPlayerInputs] = useState<{ name: string; score: number }[]>([
    { name: "", score: 0 },
    { name: "", score: 0 },
    { name: "", score: 0 },
  ]);
  const [generating, setGenerating] = useState(false);
  const [generatedClues, setGeneratedClues] = useState<CategoryData[]>([]);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  async function deleteGame() {
    await fetch(`/api/games/${id}`, { method: "DELETE" });
    window.location.href = "/";
  }

  async function resetGame() {
    await fetch(`/api/games/${id}/reset`, { method: "POST" });
    setConfirmReset(false);
    window.location.href = `/game/${id}/board`;
  }

  useEffect(() => {
    fetch(`/api/games/${id}`)
      .then((r) => r.json())
      .then((data: GameData) => {
        setGame(data);
        if (data.categories.length > 0) {
          setCategoryInputs(
            data.categories
              .map((c) => ({ name: c.name, description: (c as any).description ?? "" }))
              .concat(
                Array(Math.max(0, 6 - data.categories.length)).fill({ name: "", description: "" })
              )
          );
          if (data.categories.some((c) => c.clues.length > 0)) {
            setGeneratedClues(
              data.categories.filter((c) => c.clues.length > 0)
            );
          }
        }
        if (data.players.length > 0) {
          setPlayerInputs(
            data.players
              .map((p) => ({ name: p.name, score: p.score }))
              .concat(
                Array(Math.max(0, 3 - data.players.length)).fill({ name: "", score: 0 })
              )
          );
        }
      });
  }, [id]);

  const hasClues = generatedClues.length > 0;

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  function updateCategoryName(index: number, value: string) {
    const next = [...categoryInputs];
    next[index] = { ...next[index], name: value };
    setCategoryInputs(next);
  }

  function updateCategoryDescription(index: number, value: string) {
    const next = [...categoryInputs];
    next[index] = { ...next[index], description: value };
    setCategoryInputs(next);
  }

  function addCategory() {
    setCategoryInputs([...categoryInputs, { name: "", description: "" }]);
  }

  function removeCategory(index: number) {
    if (categoryInputs.length <= 1) return;
    setCategoryInputs(categoryInputs.filter((_, i) => i !== index));
  }

  function updatePlayerName(index: number, value: string) {
    const next = [...playerInputs];
    next[index] = { ...next[index], name: value };
    setPlayerInputs(next);
  }

  function updatePlayerScore(index: number, value: number) {
    const next = [...playerInputs];
    next[index] = { ...next[index], score: value };
    setPlayerInputs(next);
  }

  function addPlayer() {
    setPlayerInputs([...playerInputs, { name: "", score: 0 }]);
  }

  function removePlayer(index: number) {
    if (playerInputs.length <= 2) return;
    setPlayerInputs(playerInputs.filter((_, i) => i !== index));
  }

  function updateClueField(
    catIndex: number,
    clueIndex: number,
    field: "answer" | "question",
    value: string
  ) {
    setGeneratedClues((prev) =>
      prev.map((cat, ci) =>
        ci === catIndex
          ? {
              ...cat,
              clues: cat.clues.map((clue, cli) =>
                cli === clueIndex ? { ...clue, [field]: value } : clue
              ),
            }
          : cat
      )
    );
  }

  function toggleDailyDouble(catIndex: number, clueIndex: number) {
    setGeneratedClues((prev) => {
      const targetClue = prev[catIndex].clues[clueIndex];
      const newValue = !targetClue.isDailyDouble;
      // If turning on, turn off all others first
      return prev.map((cat, ci) => ({
        ...cat,
        clues: cat.clues.map((clue, cli) => ({
          ...clue,
          isDailyDouble:
            ci === catIndex && cli === clueIndex ? newValue : false,
        })),
      }));
    });
  }

  async function generateClues() {
    const validCats = categoryInputs.filter((c) => c.name.trim());
    if (validCats.length === 0) {
      setError("Add at least one category");
      return;
    }

    setGenerating(true);
    setError("");

    try {
      await fetch(`/api/games/${id}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categories: validCats.map((c) => ({
            name: c.name.trim(),
            description: c.description.trim(),
          })),
        }),
      });

      const res = await fetch(`/api/games/${id}/generate`, { method: "POST" });
      if (!res.ok) {
        let msg = "Generation failed — try again";
        try {
          const data = await res.json();
          msg = data.error || msg;
        } catch {}
        throw new Error(msg);
      }

      // Reload game data to get the generated clues
      const gameRes = await fetch(`/api/games/${id}`);
      const gameData: GameData = await gameRes.json();
      setGame(gameData);
      setGeneratedClues(
        gameData.categories.filter((c) => c.clues.length > 0)
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function startGame() {
    const validPlayers = playerInputs.filter((p) => p.name.trim());
    if (validPlayers.length < 2) {
      setError("Add at least 2 players");
      return;
    }

    setStarting(true);
    setError("");

    try {
      // Save any clue edits
      await Promise.all(
        generatedClues.flatMap((cat) =>
          cat.clues.map((clue) =>
            fetch(`/api/clues/${clue.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                answer: clue.answer,
                question: clue.question,
                isDailyDouble: clue.isDailyDouble,
              }),
            })
          )
        )
      );

      // Save players with their scores
      await fetch(`/api/games/${id}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          players: validPlayers.map((p) => ({
            name: p.name.trim(),
            score: p.score,
          })),
        }),
      });

      // Start game
      await fetch(`/api/games/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: "playing" }),
      });

      window.location.href = `/game/${id}/board`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStarting(false);
    }
  }

  if (!game) {
    return (
      <div className="flex-1 flex items-center justify-center text-2xl text-blue-200">
        Loading...
      </div>
    );
  }

  return (
    <main className="flex-1 flex flex-col items-center p-4 pt-14 md:p-8 md:pt-14 max-w-5xl mx-auto w-full">
      <div className="w-full flex items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-jeopardy-gold mb-1">
            {game.name}
          </h1>
          <p className="text-blue-200">Game Setup</p>
        </div>
        <div className="flex flex-col gap-2 items-end">
          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              className="px-3 py-2 text-sm text-white/40 hover:text-jeopardy-gold border border-white/10 hover:border-jeopardy-gold/50 rounded-lg transition-colors"
            >
              Reset Game
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={resetGame}
                className="px-3 py-2 text-sm text-jeopardy-dark bg-jeopardy-gold hover:bg-jeopardy-gold-light rounded-lg font-bold transition-colors"
              >
                Confirm Reset
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="px-3 py-2 text-sm text-white/60 border border-white/20 rounded-lg hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-3 py-2 text-sm text-white/40 hover:text-red-400 border border-white/10 hover:border-red-400/50 rounded-lg transition-colors"
            >
              Delete Game
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={deleteGame}
                className="px-3 py-2 text-sm text-white bg-red-600 hover:bg-red-500 rounded-lg font-bold transition-colors"
              >
                Confirm Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-2 text-sm text-white/60 border border-white/20 rounded-lg hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="w-full bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Categories */}
      <section className="w-full mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Categories</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {categoryInputs.map((cat, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="relative">
                <input
                  type="text"
                  value={cat.name}
                  onChange={(e) => updateCategoryName(i, e.target.value)}
                  placeholder={`Category ${i + 1}`}
                  disabled={generating}
                  className="w-full px-3 py-2 pr-8 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-jeopardy-gold disabled:opacity-50"
                />
                {categoryInputs.length > 1 && !generating && (
                  <button
                    onClick={() => removeCategory(i)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-white/30 hover:text-red-400 hover:bg-white/10 text-xs transition-colors"
                  >
                    x
                  </button>
                )}
              </div>
              <input
                type="text"
                value={cat.description}
                onChange={(e) => updateCategoryDescription(i, e.target.value)}
                placeholder="Hint for AI (e.g. focus on 90s sitcoms)"
                disabled={generating}
                className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 placeholder-white/20 text-xs focus:outline-none focus:border-jeopardy-gold disabled:opacity-50"
              />
            </div>
          ))}
        </div>
        <button
          onClick={addCategory}
          disabled={generating}
          className="mt-3 px-4 py-2 text-sm border border-white/20 rounded-lg hover:bg-white/10 disabled:opacity-50 transition-colors"
        >
          + Add Category
        </button>
      </section>

      {/* Players */}
      <section className="w-full mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Players</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {playerInputs.map((player, i) => (
            <div key={i} className="flex gap-2 items-center">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={player.name}
                  onChange={(e) => updatePlayerName(i, e.target.value)}
                  placeholder={`Player ${i + 1}`}
                  className="w-full px-3 py-2 pr-8 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-jeopardy-gold"
                />
                {playerInputs.length > 2 && (
                  <button
                    onClick={() => removePlayer(i)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-white/30 hover:text-red-400 hover:bg-white/10 text-xs transition-colors"
                  >
                    x
                  </button>
                )}
              </div>
              <div className="relative w-24 shrink-0">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
                <input
                  type="number"
                  value={player.score}
                  onChange={(e) => updatePlayerScore(i, parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 pl-6 rounded-lg bg-white/10 border border-white/20 text-white text-sm text-right focus:outline-none focus:border-jeopardy-gold"
                />
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={addPlayer}
          className="mt-3 px-4 py-2 text-sm border border-white/20 rounded-lg hover:bg-white/10 transition-colors"
        >
          + Add Player
        </button>
      </section>

      {/* Generate or Clue Review */}
      {!hasClues ? (
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={generateClues}
            disabled={generating}
            className="px-10 py-4 bg-jeopardy-gold text-jeopardy-dark font-bold text-2xl rounded-xl hover:bg-jeopardy-gold-light disabled:opacity-50 transition-colors"
          >
            {generating ? "Generating clues..." : "Generate Clues"}
          </button>
          {generating && (
            <p className="text-blue-200 text-sm animate-pulse">
              AI is crafting your clues... this takes a few seconds per
              category.
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Editable Clues */}
          <section className="w-full mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">
                Review & Edit Clues
              </h2>
              <button
                onClick={generateClues}
                disabled={generating}
                className="px-4 py-2 text-sm border border-white/20 rounded-lg hover:bg-white/10 disabled:opacity-50 transition-colors"
              >
                {generating ? "Regenerating..." : "Regenerate All"}
              </button>
            </div>

            <div className="space-y-6">
              {generatedClues.map((cat, catIndex) => (
                <div
                  key={cat.id}
                  className="bg-white/5 border border-white/10 rounded-xl p-4"
                >
                  <h3 className="text-lg font-bold text-jeopardy-gold mb-3 uppercase tracking-wide">
                    {cat.name}
                  </h3>
                  <div className="space-y-3">
                    {cat.clues
                      .sort((a, b) => a.value - b.value)
                      .map((clue, clueIndex) => (
                        <div
                          key={clue.id}
                          className={`rounded-lg p-3 ${
                            clue.isDailyDouble
                              ? "bg-jeopardy-gold/10 border border-jeopardy-gold/30"
                              : "bg-white/5"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-jeopardy-gold font-bold text-sm">
                              ${clue.value}
                            </span>
                            <button
                              onClick={() =>
                                toggleDailyDouble(catIndex, clueIndex)
                              }
                              className={`px-2 py-1 text-xs rounded-md font-bold transition-colors ${
                                clue.isDailyDouble
                                  ? "bg-jeopardy-gold text-jeopardy-dark"
                                  : "text-white/30 border border-white/10 hover:border-jeopardy-gold/50 hover:text-jeopardy-gold"
                              }`}
                            >
                              {clue.isDailyDouble ? "DAILY DOUBLE" : "DD"}
                            </button>
                          </div>
                          <div className="space-y-2">
                            <div>
                              <label className="text-white/50 text-xs uppercase tracking-wide">
                                Clue
                              </label>
                              <textarea
                                value={clue.answer}
                                onChange={(e) => {
                                  updateClueField(
                                    catIndex,
                                    clueIndex,
                                    "answer",
                                    e.target.value
                                  );
                                  autoGrow(e.target);
                                }}
                                ref={(el) => {
                                  if (el) autoGrow(el);
                                }}
                                rows={1}
                                className="w-full mt-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:border-jeopardy-gold resize-none overflow-hidden"
                              />
                            </div>
                            <div>
                              <label className="text-white/50 text-xs uppercase tracking-wide">
                                Answer
                              </label>
                              <input
                                type="text"
                                value={clue.question}
                                onChange={(e) =>
                                  updateClueField(
                                    catIndex,
                                    clueIndex,
                                    "question",
                                    e.target.value
                                  )
                                }
                                className="w-full mt-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:border-jeopardy-gold"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Start Game */}
          <button
            onClick={startGame}
            disabled={starting}
            className="px-10 py-4 bg-jeopardy-gold text-jeopardy-dark font-bold text-2xl rounded-xl hover:bg-jeopardy-gold-light disabled:opacity-50 transition-colors mb-8"
          >
            {starting ? "Starting..." : "Start Game!"}
          </button>
        </>
      )}
    </main>
  );
}
