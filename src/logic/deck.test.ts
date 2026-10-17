import { getBaseCards, getDefaultLeader } from './cards';
import {
  DeckList,
  addCard,
  countDeckCards,
  createDefaultDeckList,
  expandDeck,
  fillDeck,
  removeCard,
  sanitizeDeck,
  validateDeck,
} from './deck';
import { createInitialGameState } from './initialState';

const emptyDeck = (): DeckList => ({ leaderId: getDefaultLeader().id, cards: {} });

describe('deck rules', () => {
  it('has enough kinds of cards to build a 40-card deck with 3 copies each', () => {
    expect(getBaseCards().length * 3).toBeGreaterThanOrEqual(40);
  });

  it('builds a legal default deck', () => {
    const deck = createDefaultDeckList();
    expect(countDeckCards(deck)).toBe(40);
    expect(validateDeck(deck)).toEqual([]);
    expect(Math.max(...Object.values(deck.cards))).toBeLessThanOrEqual(3);
  });

  it('limits each card to 3 copies and the deck to 40 cards', () => {
    let deck = emptyDeck();
    for (let i = 0; i < 5; i++) deck = addCard(deck, 'm001');
    expect(deck.cards.m001).toBe(3);

    const full = fillDeck(emptyDeck());
    expect(countDeckCards(addCard(full, 'm001'))).toBe(40);
  });

  it('removes cards and drops the entry at zero', () => {
    const deck = removeCard(addCard(emptyDeck(), 'm002'), 'm002');
    expect(deck.cards).toEqual({});
    expect(removeCard(deck, 'm002')).toBe(deck);
  });

  it('reports every rule violation', () => {
    const errors = validateDeck({ leaderId: 'none', cards: { m001: 4, x999: 1 } });
    expect(errors).toEqual(expect.arrayContaining([
      '大将カードを選んでください。',
      'デッキはちょうど40枚にしてください（今は5枚）。',
      '「ゴブリンアタッカー」は3枚までです。',
      '存在しないカードが含まれています（x999）。',
    ]));
  });

  it('expands a deck list into cards with unique ids', () => {
    const cards = expandDeck(createDefaultDeckList());
    expect(cards).toHaveLength(40);
    expect(new Set(cards.map(c => c.id)).size).toBe(40);
  });

  it('starts a game with the chosen deck for the player', () => {
    let deck = emptyDeck();
    for (const card of getBaseCards().slice(0, 14)) for (let i = 0; i < 3; i++) deck = addCard(deck, card.id);
    const usedIds = new Set(getBaseCards().slice(0, 14).map(c => c.id));
    const state = createInitialGameState(deck);
    const player = state.players.player1;
    expect(player.deck.length + player.hand.length).toBe(40);
    expect([...player.deck, ...player.hand].every(c => usedIds.has(c.id.split('-')[0]))).toBe(true);
  });

  it('sanitizes a saved deck that no longer follows the rules', () => {
    const fixed = sanitizeDeck({ leaderId: 'gone', cards: { m001: 5, x999: 2, m002: 2 } });
    expect(fixed).toEqual({ leaderId: getDefaultLeader().id, cards: { m001: 3, m002: 2 } });
  });
});
