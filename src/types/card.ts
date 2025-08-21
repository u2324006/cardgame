export type CardType = 'Monster' | 'Spell';

export interface Card {
  id: string;
  name: string;
  type: CardType;
  description: string;
  attack?: number;
  defense?: number;
  cost: number;
}
