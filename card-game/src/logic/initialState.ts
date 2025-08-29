import { GameState, PlayerState } from '../types/gameState';
import { Card } from '../types/card';

import { allCardsData } from '../data/cards';

// Helper to create a shuffled deck of 40 cards from the master list
const createRandomDeck = (cards: readonly Card[]): Card[] => {
    const deck: Card[] = [];
    while (deck.length < 40) {
        const randomIndex = Math.floor(Math.random() * cards.length);
        deck.push(cards[randomIndex]);
    }
    // Assign unique IDs and shuffle
    const deckWithUniqueIds = deck.map((card, index) => ({ ...card, id: `${card.id}-${index}` }));
    for (let i = deckWithUniqueIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deckWithUniqueIds[i], deckWithUniqueIds[j]] = [deckWithUniqueIds[j], deckWithUniqueIds[i]];
    }
    return deckWithUniqueIds;
};

// --- Initial Player State ---
const createInitialPlayerState = (fullDeck: Card[]): PlayerState => {
  const hand: Card[] = [];
  const deck = [...fullDeck]; // Create a mutable copy

  // Draw initial 5 cards
  for (let i = 0; i < 5; i++) {
    if (deck.length > 0) {
      const drawnCard = deck.shift();
      if (drawnCard) hand.push(drawnCard);
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
let playerDeck: Card[];
const savedDeckJSON = localStorage.getItem('deckForBattle');

if (savedDeckJSON) {
    try {
        const savedDeck = JSON.parse(savedDeckJSON);
        // Ensure the loaded deck is a valid Card array and has cards
        if (Array.isArray(savedDeck) && savedDeck.length > 0) {
            // Create a new deck with unique IDs for the game instance and shuffle it
            const deckWithUniqueIds = savedDeck.map((card: Card, index: number) => ({ ...card, id: `${card.id}-instance-${index}` }));
            for (let i = deckWithUniqueIds.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [deckWithUniqueIds[i], deckWithUniqueIds[j]] = [deckWithUniqueIds[j], deckWithUniqueIds[i]];
            }
            playerDeck = deckWithUniqueIds;
        } else {
            // If saved deck is empty or invalid, create a random one
            playerDeck = createRandomDeck(allCardsData as readonly Card[]);
        }
        // Clean up the storage item
        localStorage.removeItem('deckForBattle');
    } catch (error) {
        console.error("Failed to parse saved deck, using default random deck:", error);
        playerDeck = createRandomDeck(allCardsData as readonly Card[]);
    }
} else {
    // If no deck in storage, create a random one
    playerDeck = createRandomDeck(allCardsData as readonly Card[]);
}

const opponentDeck = createRandomDeck(allCardsData as readonly Card[]);

// --- Initial Game State ---
export const initialGameState: GameState = {
  players: {
    player1: createInitialPlayerState(playerDeck),
    player2: createInitialPlayerState(opponentDeck),
  },
  currentPlayer: 'player1',
  turn: 1,
  phase: 'Draw',
};
