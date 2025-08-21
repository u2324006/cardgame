import { Card } from './card';

export interface PlayerState {
  hp: number;
  specialCardHp: number;
  currentEnergy: number;
  maxEnergy: number;
  deck: Card[];
  hand: Card[];
  graveyard: Card[];
  field: {
    frontRow: (Card | null)[];
    backRow: (Card | null)[];
  };
}

export interface GameState {
  players: {
    player1: PlayerState;
    player2: PlayerState;
  };
  currentPlayer: 'player1' | 'player2';
  turn: number;
  phase: 'Draw' | 'Standby' | 'Main1' | 'Battle' | 'Main2' | 'End';
}
