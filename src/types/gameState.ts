import { Card, LeaderCard, MonsterCard } from './card';

export type PlayerId = 'player1' | 'player2';
export type Row = 'frontRow' | 'backRow';
export type Phase = 'Draw' | 'Play' | 'Attack';

export interface FieldPosition {
  row: Row;
  index: number;
}

export interface PlayerState {
  leader: LeaderCard;
  specialCardHp: number; // 大将カードの現在のHP
  currentEnergy: number;
  maxEnergy: number;
  deck: Card[];
  hand: Card[];
  graveyard: Card[];
  field: Record<Row, (MonsterCard | null)[]>; // 場に出せるのはモンスターのみ
}

// ターン終了時にリセットされる状態
export interface TurnState {
  attackedMonsterIds: string[];
  summonedThisTurnIds: string[];
  movedMonsterId: string | null; // このターンに移動したモンスター（移動は1ターンに1回）
  attackBuffs: Record<string, number>; // { [cardId]: FA上昇値 }
  backAttackBuffs: Record<string, number>; // { [cardId]: BA上昇値 }
  disabledLeaders: PlayerId[]; // このターンの間、大将カードの効果がなくなっているプレイヤー
}

// 「カードを引いてその後手札から墓地に置く」効果などで、捨てるカードを選んでいるところ
export interface PendingDiscard {
  player: PlayerId;
  count: number;
}

export interface GameState {
  players: Record<PlayerId, PlayerState>;
  currentPlayer: PlayerId;
  turn: number;
  phase: Phase;
  turnState: TurnState;
  winner: PlayerId | null;
  pendingDiscard: PendingDiscard | null; // 手札から墓地に置くカードを選んでいる途中（その間はほかの行動ができない）
}

export type AttackTarget =
  | { type: 'monster'; position: FieldPosition }
  | { type: 'player' };
