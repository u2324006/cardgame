import { GameState, PlayerState } from '../types/gameState';
import { Card } from '../types/card';

// --- Sample Cards ---
const allCardsData = [
    { id: 'm001', name: 'Goblin Attacker', type: 'Monster', description: 'A standard goblin warrior.', frontAttack: 2, backAttack: 2, cardHp: 6, race: 'Goblin', cost: 1 },
    { id: 'm002', name: 'Stone Golem', type: 'Monster', description: 'A creature made of living rock.', frontAttack: 3, backAttack: 0, cardHp: 13, race: 'Golem', cost: 2 },
    { id: 'm003', name: 'pute', type: 'Monster', description: 'A creature made of living rock.', frontAttack: 4, backAttack: 0, cardHp: 5, race: 'Golem', cost: 1 },
    { id: 'm004', name: 'hanta-', type: 'Monster', description: 'A creature made of living rock.', frontAttack: 0, backAttack: 4, cardHp: 3, race: 'Golem', cost: 1 },
    { id: 'm005', name: 'sennsi', type: 'Monster', description: 'A creature made of living rock.', frontAttack: 5, backAttack: 0, cardHp: 7, race: 'Golem', cost: 2 },
    { id: 'm006', name: 'majutu', type: 'Monster', description: 'A creature made of living rock.', frontAttack: 0, backAttack: 5, cardHp: 6, race: 'Golem', cost: 2 },
    { id: 'm007', name: 'baran', type: 'Monster', description: 'A creature made of living rock.', frontAttack: 3, backAttack: 3, cardHp: 9, race: 'Golem', cost: 2 },
    { id: 'm008', name: 'deka', type: 'Monster', description: 'A creature made of living rock.', frontAttack: 8, backAttack: 0, cardHp: 12, race: 'Golem', cost: 3 },
    { id: 'm009', name: 'tyu', type: 'Monster', description: 'A creature made of living rock.', frontAttack: 4, backAttack: 4, cardHp: 15, race: 'Golem', cost: 3 },
    { id: 'm010', name: 'sibi', type: 'Monster', description: 'A creature made of living rock.', frontAttack: 0, backAttack: 8, cardHp: 10, race: 'Golem', cost: 3 },
    { id: 'm011', name: 'hohei', type: 'Monster', description: 'A creature made of living rock.', frontAttack: 2, backAttack: 0, cardHp: 2, race: 'Golem', cost: 0 },
    { id: 'm012', name: 'garu', type: 'Monster', description: 'A creature made of living rock.', frontAttack: 1, backAttack: 1, cardHp: 3, race: 'Golem', cost: 0 },
    { id: 'm013', name: 'tebu', type: 'Monster', description: 'A creature made of living rock.', frontAttack: 0, backAttack: 1, cardHp: 1, race: 'Golem', cost: 0 },
    { id: 'm014', name: '僧侶', type: 'Monster', description: '1ターンに1度自分のモンスター1体のHPを1回復する。', frontAttack: 0, backAttack: 1, cardHp: 2, race: 'Golem', cost: 1 },
    { id: 's001', name: '攻撃の呪文', type: 'Spell', description: '味方モンスター1体のFAを、ターン終了まで1上げる。', race: 'Spell', cost: 1 },
] as const;

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
            playerDeck = createRandomDeck(allCardsData);
        }
        // Clean up the storage item
        localStorage.removeItem('deckForBattle');
    } catch (error) {
        console.error("Failed to parse saved deck, using default random deck:", error);
        playerDeck = createRandomDeck(allCardsData);
    }
} else {
    // If no deck in storage, create a random one
    playerDeck = createRandomDeck(allCardsData);
}

const opponentDeck = createRandomDeck(allCardsData);

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
