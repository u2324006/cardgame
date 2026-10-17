interface BaseCard {
  id: string;
  name: string;
  description: string;
  cost: number;
  race?: string;
}

export interface MonsterCard extends BaseCard {
  type: 'Monster';
  frontAttack: number; // FA: 前衛にいるときの攻撃力
  backAttack: number; // BA: 後衛にいるときの攻撃力
  cardHp: number;
}

export interface SpellCard extends BaseCard {
  type: 'Spell';
}

export type Card = MonsterCard | SpellCard;
export type CardType = Card['type'];

export const isMonster = (card: Card): card is MonsterCard => card.type === 'Monster';
