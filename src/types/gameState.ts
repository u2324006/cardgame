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
  delayedEnergy: DelayedEnergy[]; // 次の自分のターン開始時に増えるエネルギー
}

// 次の自分のターン開始時に増えるエネルギー（cardId があれば、そのモンスターが場に残っているときだけ）
export interface DelayedEnergy {
  amount: number;
  cardId?: string;
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
  spellDiscount: number; // 次に使うスペルのコストが下がる量（魔導書・伝令官）
  summonDiscount: number; // 次に召喚するモンスターのコストが下がる量（援軍要請）
  spoilsDraw: number; // 戦利品：このターン最初に相手のモンスターを倒したら引く枚数（0 なら効果なし）
  spellEnergyUsed: boolean; // 大魔導師の効果をこのターン使ったか
  movedIds: string[]; // このターンに移動したモンスター（スペルや効果での移動を含む）
  boostedIds: string[]; // このターンに力を溜めた（selfBoost）モンスター
}

// 「カードを引いてその後手札から墓地に置く」効果などで、捨てるカードを選んでいるところ
export interface PendingDiscard {
  player: PlayerId;
  count: number;
  then?: DiscardFollowUp; // 捨てたあとの効果
}

// 捨てたあとの効果（火炎瓶：捨てたカードのコスト + bonus のダメージ、錬成：カードを引く）
export type DiscardFollowUp =
  | { kind: 'damage'; target: FieldPosition; bonus: number }
  | { kind: 'draw'; amount: number };

// モンスターの効果やスペルで、モンスターをコストなしで召喚するところ（召喚するか、しないかを選ぶ）
export interface PendingFreeSummon {
  player: PlayerId;
  maxCost: number;
  row?: Row; // 召喚できる列（なければどちらでも）
  source: string;
}

// 墓地や相手の手札からカードを選ぶところ（墓荒らし・情報戦）
export interface PendingPick {
  player: PlayerId;
  kind: 'graveyard' | 'opponentHand' | 'graveyardSummon'; // graveyardSummon：墓地のモンスターをコストなしで場に出す
  source: string;
  maxCost?: number; // graveyardSummon で選べるコストの上限
  race?: string; // graveyardSummon で選べる種族
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

// 相手の効果で手札から捨てられたカードの効果を、持ち主が選ぶところ
// （怨霊：ダメージを与える相手のモンスター、幻影兵：出る空きスロット）
export interface PendingReaction {
  player: PlayerId; // 捨てられたカードの持ち主（選ぶ人）
  card: MonsterCard;
  kind: 'damage' | 'summon' | 'heal' | 'debuff'; // damage：相手にダメージ、summon：空きスロットに出す、heal：味方を回復、debuff：相手の FA・BA を下げる
  amount: number;
  row?: Row; // 選べる列（なければどちらでも）
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
  pendingFreeSummon: PendingFreeSummon | null; // コストなしで召喚するモンスターを選んでいる途中
  pendingPick: PendingPick | null; // 墓地や相手の手札からカードを選んでいる途中
  pendingReaction: PendingReaction | null; // 捨てられたカードの効果の対象を、持ち主が選んでいる途中
  moveLocks: MoveLock[];
  leaderGuards: LeaderGuard[]; // 大将が受けるダメージを減らす効果（籠城）
}

export type AttackTarget =
  | { type: 'monster'; position: FieldPosition }
  | { type: 'player' };
