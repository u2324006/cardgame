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
  leaderAbilityUsed: boolean; // 1回だけ使える大将の効果を使ったか
}

// ターン終了時にリセットされる状態
export interface TurnState {
  attackedMonsterIds: string[];
  summonedThisTurnIds: string[];
  movedMonsterId: string | null; // このターンに移動したモンスター（移動は1ターンに1回）
  attackBuffs: Record<string, number>; // { [cardId]: FA上昇値 }
  backAttackBuffs: Record<string, number>; // { [cardId]: BA上昇値 }
  disabledLeaders: PlayerId[]; // このターンの間、大将カードの効果がなくなっているプレイヤー
  movedToFrontIds: string[]; // このターンに後衛から前衛へ移動したモンスター（突撃兵の効果）
  commandUsedIds: string[]; // このターンに指揮した指揮官
}

// 「カードを引いてその後手札から墓地に置く」効果などで、捨てるカードを選んでいるところ
export interface PendingDiscard {
  player: PlayerId;
  count: number;
}

// モンスターの効果で、手札のスペルをコストを払わずに使えるところ（使うか、使わないを選ぶ）
export interface PendingFreeSpell {
  player: PlayerId;
  maxCost: number;
  source: string; // 効果を出したカードの名前
}

// 移動できなくなっているモンスター（player の次のターンが終わるまで）
export interface MoveLock {
  player: PlayerId;
  cardId: string;
}

// player の大将が受けるダメージを1回につき amount 減らす（player の相手のターンが終わるまで）
export interface LeaderGuard {
  player: PlayerId;
  amount: number;
}

export interface GameState {
  players: Record<PlayerId, PlayerState>;
  currentPlayer: PlayerId;
  turn: number;
  phase: Phase;
  turnState: TurnState;
  winner: PlayerId | null;
  pendingDiscard: PendingDiscard | null; // 手札から墓地に置くカードを選んでいる途中（その間はほかの行動ができない）
  pendingFreeSpell: PendingFreeSpell | null; // コストなしで使うスペルを選んでいる途中（その間はほかの行動ができない）
  moveLocks: MoveLock[];
  leaderGuards: LeaderGuard[]; // 大将が受けるダメージを減らす効果（籠城）
}

export type AttackTarget =
  | { type: 'monster'; position: FieldPosition }
  | { type: 'player' };
