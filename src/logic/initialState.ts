import { GameState, PlayerState, TurnState } from '../types/gameState';
import { Card } from '../types/card';
import { BASE_CARDS } from './cards';
import { RULES } from './rules';

// Helper to create a shuffled deck
const createDeck = (baseCards: Card[]): Card[] => {
  const deck: Card[] = [];
  // Duplicate base cards to reach the deck size
  while (deck.length < RULES.deckSize) {
    baseCards.forEach(card => {
      if (deck.length < RULES.deckSize) {
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
  const emptyRow = () => Array<Card | null>(RULES.slotsPerRow).fill(null);
  return {
    hp: 2000,
    specialCardHp: RULES.initialSpecialCardHp,
    currentEnergy: 0,
    maxEnergy: RULES.maxEnergy,
    // 山札の先頭から初期手札を引く
    deck: fullDeck.slice(RULES.initialHandSize),
    hand: fullDeck.slice(0, RULES.initialHandSize),
    graveyard: [],
    field: {
      frontRow: emptyRow(),
      backRow: emptyRow(),
    },
  };
};

export const createInitialTurnState = (): TurnState => ({
  attackedMonsterIds: [],
  summonedThisTurnIds: [],
  hasMoved: false,
  attackBuffs: {},
});

// --- Initial Game State ---
// 呼び出すたびに新しいデッキでゲームを作成する（リスタート用）
export const createInitialGameState = (): GameState => ({
  players: {
    player1: createInitialPlayerState(createDeck(BASE_CARDS)),
    player2: createInitialPlayerState(createDeck(BASE_CARDS)),
  },
  currentPlayer: 'player1',
  turn: 1,
  phase: 'Draw',
  turnState: createInitialTurnState(),
  winner: null,
});
