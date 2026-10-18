import { GameState } from '../types/gameState';

// 対戦の途中経過をこのブラウザに保存し、再読み込み後に続きから遊べるようにする。
// GameState の形を変えたときは VERSION を上げる（古い保存データは読み込まない）。
const STORAGE_KEY = 'cardgame.battle';
const VERSION = 6;

interface SavedBattle {
  version: number;
  state: GameState;
}

const looksLikeGameState = (value: unknown): value is GameState => {
  const state = value as GameState;
  return !!state
    && typeof state.turn === 'number'
    && !!state.players?.player1?.field
    && !!state.players?.player2?.field
    && !!state.turnState;
};

export const loadSavedBattle = (): GameState | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedBattle;
    if (saved?.version !== VERSION || !looksLikeGameState(saved.state) || saved.state.winner) return null;
    return saved.state;
  } catch {
    return null;
  }
};

export const saveBattle = (state: GameState): void => {
  try {
    if (state.winner) {
      window.localStorage.removeItem(STORAGE_KEY); // 決着した対戦は続きから遊べないので消す
    } else {
      const saved: SavedBattle = { version: VERSION, state };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    }
  } catch {
    // 保存できない環境（プライベートモードなど）では、続きから遊べないだけで対戦はそのまま続ける
  }
};

export const clearSavedBattle = (): void => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 何もしない
  }
};
