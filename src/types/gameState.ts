import { Card } from './card';

export type PlayerId = 'player1' | 'player2';
export type Row = 'frontRow' | 'backRow';
export type Phase = 'Draw' | 'Play' | 'Attack';

export interface FieldPosition {
  row: Row;
  index: number;
}

export interface PlayerState {
  specialCardHp: number;
  currentEnergy: number;
  maxEnergy: number;
  deck: Card[];
  hand: Card[];
  graveyard: Card[];
  field: Record<Row, (Card | null)[]>;
}

// ターン終了時にリセットされる状態
export interface TurnState {
  attackedMonsterIds: string[];
  summonedThisTurnIds: string[];
  hasMoved: boolean;
  attackBuffs: Record<string, number>; // { [cardId]: FA上昇値 }
}

export interface GameState {
  players: Record<PlayerId, PlayerState>;
  currentPlayer: PlayerId;
  turn: number;
  phase: Phase;
  turnState: TurnState;
  winner: PlayerId | null;
}

export type AttackTarget =
  | { type: 'monster'; position: FieldPosition }
  | { type: 'player' };
