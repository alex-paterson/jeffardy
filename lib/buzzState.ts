interface BuzzState {
  buzzedPlayerId: number | null;
  buzzedPlayerName: string | null;
  lockedOut: Set<number>;
}

const globalForBuzz = globalThis as unknown as {
  buzzStates: Map<string, BuzzState>;
};
export const buzzStates =
  globalForBuzz.buzzStates ?? new Map<string, BuzzState>();
globalForBuzz.buzzStates = buzzStates;

export function getBuzzState(gameId: string): BuzzState {
  if (!buzzStates.has(gameId)) {
    buzzStates.set(gameId, {
      buzzedPlayerId: null,
      buzzedPlayerName: null,
      lockedOut: new Set(),
    });
  }
  return buzzStates.get(gameId)!;
}

export function clearBuzzState(gameId: string) {
  buzzStates.set(gameId, {
    buzzedPlayerId: null,
    buzzedPlayerName: null,
    lockedOut: new Set(),
  });
}
