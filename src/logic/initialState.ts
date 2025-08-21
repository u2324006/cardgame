import { GameState, PlayerState } from '../types/gameState';
import { Card } from '../types/card';

// --- Sample Cards ---
const monsterCard1: Card = {
  id: 'm001',
  name: 'Goblin Attacker',
  type: 'Monster',
  description: 'A standard goblin warrior.',
  attack: 500,
  defense: 400,
  cost: 3,
};

const monsterCard2: Card = {
  id: 'm002',
  name: 'Stone Golem',
  type: 'Monster',
  description: 'A creature made of living rock.',
  attack: 300,
  defense: 800,
  cost: 4,
};

const spellCard1: Card = {
    id: 's001',
    name: 'Fireball',
    type: 'Spell',
    description: 'Deals 600 damage to a target monster.',
    cost: 4,
}

// --- Initial Player State ---
const createInitialPlayerState = (deck: Card[]): PlayerState => ({
  hp: 2000,
  specialCardHp: 100,
  currentEnergy: 0,
  maxEnergy: 10,
  deck: deck,
  hand: [],
  graveyard: [],
  field: {
    frontRow: [null, null, null],
    backRow: [null, null, null],
  },
});

// --- Create Decks ---
const deck1: Card[] = [monsterCard1, monsterCard2, spellCard1, monsterCard1, monsterCard2];
const deck2: Card[] = [monsterCard1, monsterCard2, spellCard1, monsterCard1, monsterCard2];

// --- Initial Game State ---
export const initialGameState: GameState = {
  players: {
    player1: createInitialPlayerState(deck1),
    player2: createInitialPlayerState(deck2),
  },
  currentPlayer: 'player1',
  turn: 1,
  phase: 'Draw',
};
