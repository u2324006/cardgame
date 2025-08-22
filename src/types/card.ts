export type CardType = 'Monster' | 'Spell';

export interface Card {
  id: string;
  name: string;
  type: CardType;
  description: string;
  frontAttack?: number;
  backAttack?: number;
  cardHp?: number;
  race?: string;
  cost: number;
}
