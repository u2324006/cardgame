interface BaseCard {
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
  | { kind: 'damage'; amount: number }; // 相手のモンスターにダメージを与える

export interface SpellCard extends BaseCard {
  type: 'Spell';
  effect: SpellEffect;
  summary?: string; // 手札の小さなカードに表示する効果の要約（例: 'FA +1'）
}

// スペルの対象が味方モンスターか相手のモンスターか
export const getSpellTargetSide = (spell: SpellCard): 'ally' | 'enemy' =>
  spell.effect.kind === 'damage' ? 'enemy' : 'ally';

// 大将カード：大将ゾーンに置かれ、HPが0になると負け
export interface LeaderCard {
  id: string;
  name: string;
  description: string;
  maxHp: number;
  image?: string;
}

export type Card = MonsterCard | SpellCard;
export type CardType = Card['type'];

export const isMonster = (card: Card): card is MonsterCard => card.type === 'Monster';
