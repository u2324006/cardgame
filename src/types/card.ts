export type ImplementationStatus = '未実装' | '実装済み' | '効果なし';

// AI に渡すための情報（カード作成画面で作成・変更したカードに付く。最初から入っているカードにはない）
export interface CardNotes {
  effectText?: string; // 効果の文章（AI に実装してもらう内容）
  flavorText?: string; // 雰囲気の文（ルールには関係しない）
  illustrationPrompt?: string; // イラストのイメージ（AI に絵を描いてもらうための説明）
  implementation?: ImplementationStatus;
  memo?: string;
}

interface BaseCard extends CardNotes {
  id: string;
  name: string;
  description: string;
  cost: number;
  race?: string;
  image?: string; // カードの絵の URL（未設定なら種族名を表示）
}

export interface MonsterCard extends BaseCard {
  type: 'Monster';
  frontAttack: number; // FA: 前衛にいるときの攻撃力
  backAttack: number; // BA: 後衛にいるときの攻撃力
  cardHp: number;
}

// スペルの効果
export type SpellEffect =
  | { kind: 'buffFa'; amount: number } // 味方モンスターのFAをターン終了まで上げる
  | { kind: 'heal'; amount: number } // 味方モンスターのHPを回復する（最大HPまで）
  | { kind: 'damage'; amount: number } // 相手のモンスターにダメージを与える
  | { kind: 'custom' }; // まだ実装されていない効果（effectText に文章で書く。対戦では使えない）

// スペルの対象（まだ実装されていない効果のときに指定する。実装済みの効果は効果の種類から決まる）
export type SpellTarget = 'allyMonster' | 'enemyMonster' | 'anyMonster' | 'allyLeader' | 'enemyLeader' | 'none';

export interface SpellCard extends BaseCard {
  type: 'Spell';
  effect: SpellEffect;
  target?: SpellTarget;
  summary?: string; // 手札の小さなカードに表示する効果の要約（例: 'FA +1'）
}

// スペルの対象が味方モンスターか相手のモンスターか
export const getSpellTargetSide = (spell: SpellCard): 'ally' | 'enemy' => {
  if (spell.effect.kind === 'damage') return 'enemy';
  if (spell.effect.kind === 'custom') return spell.target?.startsWith('enemy') ? 'enemy' : 'ally';
  return 'ally';
};

export const isImplementedEffect = (effect: SpellEffect): effect is Exclude<SpellEffect, { kind: 'custom' }> =>
  effect.kind !== 'custom';

// 大将カード：大将ゾーンに置かれ、HPが0になると負け
export interface LeaderCard extends CardNotes {
  id: string;
  name: string;
  race?: string;
  description: string;
  maxHp: number;
  image?: string;
}

export type Card = MonsterCard | SpellCard;
export type CardType = Card['type'];

export const isMonster = (card: Card): card is MonsterCard => card.type === 'Monster';
