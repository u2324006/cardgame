export type ImplementationStatus = '未実装' | '実装済み' | '効果なし';

// AI に渡すための情報（カード作成画面で作成・変更したカードに付く。最初から入っているカードにはない）
export interface CardNotes {
  effectText?: string; // 効果の文章（AI に実装してもらう内容）
  flavorText?: string; // 雰囲気の文（ルールには関係しない）
  illustrationPrompt?: string; // イラストのイメージ（AI に絵を描いてもらうための説明）
  implementation?: ImplementationStatus;
  memo?: string;
  updatedAt?: string; // 最後に保存・取り込みした日時（ISO 形式）。ブラウザの変更とプログラムのカードで新しい方を使う
}

interface BaseCard extends CardNotes {
  id: string;
  name: string;
  description: string;
  cost: number;
  race?: string;
  image?: string; // カードの絵の URL（未設定なら種族名を表示）
}

// モンスターの効果
export type MonsterAbility =
  | { kind: 'freeSpellOnSummon'; maxCost: number }; // 召喚したとき、手札のコスト maxCost 以下のスペルを1枚、コストを払わずに使える

export interface MonsterCard extends BaseCard {
  type: 'Monster';
  ability?: MonsterAbility; // 実装済みの効果（なければ効果なし、または未実装）
  frontAttack: number; // FA: 前衛にいるときの攻撃力
  backAttack: number; // BA: 後衛にいるときの攻撃力
  cardHp: number;
}

// スペルの効果
export type SpellEffect =
  | { kind: 'buffFa'; amount: number } // 味方モンスターのFAをターン終了まで上げる
  | { kind: 'heal'; amount: number } // 味方モンスターのHPを回復する（最大HPまで）
  | { kind: 'damage'; amount: number } // 相手のモンスターにダメージを与える
  | { kind: 'buffBa'; amount: number } // 味方モンスターのBAをターン終了まで上げる
  | { kind: 'drawDiscard'; amount: number } // カードを amount 枚引き、その後手札から amount 枚を選んで墓地に置く（対象なし）
  | { kind: 'disableLeader'; amount: number } // このターンの間、相手の大将カードの効果をなくす（amount は使わない。対象は相手の大将）
  | { kind: 'damageBack'; amount: number } // 相手の後衛のモンスターにダメージを与える
  | { kind: 'forceMove'; amount: number } // 相手のモンスターを反対の列へ移動させ、相手の次のターンは移動できなくする（amount は使わない）
  | { kind: 'catchUpEnergy'; amount: number } // 相手のモンスターが自分より多いぶん、エネルギーを増やす（amount は使わない。対象なし）
  | { kind: 'custom' }; // まだ実装されていない効果（effectText に文章で書く。対戦では使えない）

// スペルの対象（まだ実装されていない効果のときに指定する。実装済みの効果は効果の種類から決まる）
export type SpellTarget = 'allyMonster' | 'enemyMonster' | 'anyMonster' | 'allyLeader' | 'enemyLeader' | 'none';

export interface SpellCard extends BaseCard {
  type: 'Spell';
  effect: SpellEffect;
  target?: SpellTarget;
  summary?: string; // 手札の小さなカードに表示する効果の要約（例: 'FA +1'）
}

// 対象を選ばずに使うスペルか（相手の大将など、対象が1つに決まるものも含む）
export const isUntargetedSpell = (spell: SpellCard): boolean =>
  spell.effect.kind === 'drawDiscard' || spell.effect.kind === 'disableLeader' || spell.effect.kind === 'catchUpEnergy'
  || (spell.effect.kind === 'custom' && (spell.target ?? 'none') === 'none');

// 数値を使わない効果（カード作成画面で数値の欄を出さない）
export const effectHasAmount = (kind: SpellEffect['kind']): boolean =>
  !['disableLeader', 'forceMove', 'catchUpEnergy', 'custom'].includes(kind);

// スペルの対象が味方モンスターか相手のモンスターか
export const getSpellTargetSide = (spell: SpellCard): 'ally' | 'enemy' => {
  if (['damage', 'damageBack', 'forceMove'].includes(spell.effect.kind)) return 'enemy';
  if (spell.effect.kind === 'custom') return spell.target?.startsWith('enemy') ? 'enemy' : 'ally';
  return 'ally';
};

// スペルの対象（実装済みの効果は効果の種類から決まる。まだない効果は spell.target）
export const getSpellTarget = (spell: SpellCard): SpellTarget => {
  switch (spell.effect.kind) {
    case 'damage':
    case 'damageBack':
    case 'forceMove': return 'enemyMonster';
    case 'heal':
    case 'buffFa':
    case 'buffBa': return 'allyMonster';
    case 'drawDiscard':
    case 'catchUpEnergy': return 'none';
    case 'disableLeader': return 'enemyLeader';
    case 'custom': return spell.target ?? 'none';
  }
};

// 実装済みのスペルの効果の種類（JSON やチェックで使う）
export const IMPLEMENTED_EFFECT_KINDS: Exclude<SpellEffect['kind'], 'custom'>[] = [
  'damage', 'heal', 'buffFa', 'buffBa', 'drawDiscard', 'disableLeader', 'damageBack', 'forceMove', 'catchUpEnergy',
];

export const isImplementedEffect = (effect: SpellEffect): effect is Exclude<SpellEffect, { kind: 'custom' }> =>
  effect.kind !== 'custom';

// 大将カード：大将ゾーンに置かれ、HPが0になると負け
// 大将カードの効果
export type LeaderAbility =
  | { kind: 'raceHpBonus'; race: string; amount: number } // ずっと：種族が race の自分のモンスターの HP を amount 上げる
  | { kind: 'rallyEnergy'; hpThreshold: number; amount: number }; // 1回だけ：大将の HP が hpThreshold 以下のとき、使うとエネルギーを amount 増やす

export interface LeaderCard extends CardNotes {
  id: string;
  name: string;
  race?: string;
  ability?: LeaderAbility; // 実装済みの効果（なければ効果なし、または未実装）
  description: string;
  maxHp: number;
  image?: string;
}

export type Card = MonsterCard | SpellCard;
export type CardType = Card['type'];

export const isMonster = (card: Card): card is MonsterCard => card.type === 'Monster';
