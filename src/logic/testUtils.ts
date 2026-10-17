import { Card } from '../types/card';
import { GameState, PlayerId, PlayerState } from '../types/gameState';
import { ActionResult } from './gameLogic';
import { createInitialGameState } from './initialState';

// テスト用のカード・盤面を作るヘルパー

export const monster = (id: string, overrides: Partial<Card> = {}): Card => ({
  id,
  name: id,
  type: 'Monster',
  description: '',
  frontAttack: 3,
  backAttack: 1,
  cardHp: 5,
  cost: 1,
  ...overrides,
});

export const spell: Card = { id: 's001-0', name: '攻撃の呪文', type: 'Spell', description: '', cost: 1 };

// 両プレイヤーの手札・フィールドを空にした、テスト用の状態を作る
export const emptyState = (): GameState => {
  const base = createInitialGameState();
  const clear = (player: PlayerId) => ({
    ...base.players[player],
    hand: [],
    currentEnergy: 5,
    field: { frontRow: [null, null, null], backRow: [null, null, null] },
  });
  return { ...base, phase: 'Play', players: { player1: clear('player1'), player2: clear('player2') } };
};

export const withField = (state: GameState, player: PlayerId, row: 'frontRow' | 'backRow', cards: (Card | null)[]): GameState => ({
  ...state,
  players: {
    ...state.players,
    [player]: { ...state.players[player], field: { ...state.players[player].field, [row]: cards } },
  },
});

export const withPlayer = (state: GameState, player: PlayerId, changes: Partial<PlayerState>): GameState => ({
  ...state,
  players: { ...state.players, [player]: { ...state.players[player], ...changes } },
});

export const unwrap = (result: ActionResult): GameState => {
  if (!result.ok) throw new Error(result.error);
  return result.state;
};
