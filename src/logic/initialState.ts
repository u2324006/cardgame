import { GameState, PlayerState } from '../types/gameState';
import { Card } from '../types/card';

// --- Sample Cards ---
const monsterCard1: Card = {
  id: 'm001',
  name: 'Goblin Attacker',
  type: 'Monster',
  description: 'A standard goblin warrior.',
  frontAttack: 5,
  backAttack: 4,
  cardHp: 10,
  race: 'Goblin',
  cost: 1,
};

const monsterCard2: Card = {
  id: 'm002',
  name: 'Stone Golem',
  type: 'Monster',
  description: 'A creature made of living rock.',
  frontAttack: 3,
  backAttack: 4,
  cardHp: 8,
  race: 'Golem',
  cost: 2,
};

const spellCard1: Card = {
    id: 's001',
    name: 'Fireball',
    type: 'Spell',
    description: 'Deals 600 damage to a target monster.',
    cardHp: 0, /* Spells typically don't have HP */
    race: 'Spell',
    cost: 4,
}

// Helper to create a shuffled deck of 40 cards
const createDeck = (baseCards: Card[]): Card[] => {
  const deck: Card[] = [];
  // Duplicate base cards to reach 40
  while (deck.length < 40) {
    baseCards.forEach(card => {
      if (deck.length < 40) {
        // Assign a new unique ID to each duplicated card
        deck.push({ ...card, id: `${card.id}-${deck.length}` });
      }
    });
  }
  // Shuffle the deck (simple shuffle for now)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

// --- Initial Player State ---
const createInitialPlayerState = (fullDeck: Card[]): PlayerState => {
  const hand: Card[] = [];
  const deck = [...fullDeck]; // Create a mutable copy of the full deck

  // Draw initial 5 cards
  for (let i = 0; i < 5; i++) {
    if (deck.length > 0) {
      const drawnCard = deck.shift(); // Remove from the beginning of the deck
      if (drawnCard) {
        hand.push(drawnCard);
      }
    }
  }

  return {
    hp: 2000,
    specialCardHp: 20,
    currentEnergy: 0,
    maxEnergy: 10,
    deck: deck,
    hand: hand,
    graveyard: [],
    field: {
      frontRow: [null, null, null],
      backRow: [null, null, null],
    },
  };
};

// --- Create Decks ---
const baseCards = [monsterCard1, monsterCard2, spellCard1]; // Cards to duplicate
const fullDeck1 = createDeck(baseCards);
const fullDeck2 = createDeck(baseCards);

// --- Initial Game State ---
export const initialGameState: GameState = {
  players: {
    player1: createInitialPlayerState(fullDeck1),
    player2: createInitialPlayerState(fullDeck2),
  },
  currentPlayer: 'player1',
  turn: 1,
  phase: 'Draw',
};
