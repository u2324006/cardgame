import { Card } from '../types/card';
import { findBaseCard, findLeader, getBaseCards, getDefaultLeader } from './cards';
import { RULES } from './rules';

// デッキの構成：大将カード1種類と、元カードのIDごとの枚数
export interface DeckList {
  leaderId: string;
  cards: Record<string, number>; // { [元カードID]: 枚数 }
}

export const countDeckCards = (deck: DeckList): number =>
  Object.values(deck.cards).reduce((sum, count) => sum + count, 0);

export const getCardCount = (deck: DeckList, baseId: string): number => deck.cards[baseId] ?? 0;

// デッキのルール違反を一覧で返す（空ならデッキとして使える）
export const validateDeck = (deck: DeckList): string[] => {
  const errors: string[] = [];
  if (!findLeader(deck.leaderId)) errors.push('大将カードを選んでください。');
  const total = countDeckCards(deck);
  if (total !== RULES.deckSize) errors.push(`デッキはちょうど${RULES.deckSize}枚にしてください（今は${total}枚）。`);
  for (const [baseId, count] of Object.entries(deck.cards)) {
    const card = findBaseCard(baseId);
    if (!card) errors.push(`存在しないカードが含まれています（${baseId}）。`);
    else if (count > RULES.maxCopiesPerCard) errors.push(`「${card.name}」は${RULES.maxCopiesPerCard}枚までです。`);
  }
  return errors;
};

export const isValidDeck = (deck: DeckList): boolean => validateDeck(deck).length === 0;

// カードを1枚足す。上限や40枚を超える場合は変更しない
export const addCard = (deck: DeckList, baseId: string): DeckList => {
  if (getCardCount(deck, baseId) >= RULES.maxCopiesPerCard || countDeckCards(deck) >= RULES.deckSize) return deck;
  return { ...deck, cards: { ...deck.cards, [baseId]: getCardCount(deck, baseId) + 1 } };
};

// カードを1枚外す
export const removeCard = (deck: DeckList, baseId: string): DeckList => {
  const count = getCardCount(deck, baseId);
  if (count === 0) return deck;
  const { [baseId]: _, ...rest } = deck.cards;
  return { ...deck, cards: count === 1 ? rest : { ...rest, [baseId]: count - 1 } };
};

// 空いている枠を、カード一覧の順に1枚ずつ配って埋める（全カードが上限ならそこで止まる）
export const fillDeck = (deck: DeckList, pool: Card[] = getBaseCards()): DeckList => {
  let current = deck;
  while (countDeckCards(current) < RULES.deckSize) {
    const before = countDeckCards(current);
    for (const card of pool) current = addCard(current, card.id);
    if (countDeckCards(current) === before) break;
  }
  return current;
};

// 自動で作るデッキ（AI と、デッキを作っていないときに使う）
export const createDefaultDeckList = (): DeckList =>
  fillDeck({ leaderId: getDefaultLeader().id, cards: {} });

// デッキの構成から、1枚ごとに個別IDを振ったカードの並びを作る（シャッフル前）
export const expandDeck = (deck: DeckList): Card[] =>
  getBaseCards().flatMap(card =>
    Array.from({ length: getCardCount(deck, card.id) }, (_, i) => ({ ...card, id: `${card.id}-${i}` })),
  );

// ルールに合わない部分を直したデッキを返す（存在しないカードを外し、上限を超えた枚数を減らし、大将がなければ既定の大将にする）
// 枚数が40枚に足りなくなることはあるので、デッキ作成画面で組み直してもらう
export const sanitizeDeck = (deck: DeckList): DeckList => {
  const cards: Record<string, number> = {};
  for (const [baseId, count] of Object.entries(deck.cards)) {
    if (findBaseCard(baseId) && count > 0) cards[baseId] = Math.min(count, RULES.maxCopiesPerCard);
  }
  let sanitized: DeckList = { leaderId: findLeader(deck.leaderId) ? deck.leaderId : getDefaultLeader().id, cards: {} };
  // 40枚を超えている場合は先頭のカードから入れられる分だけ入れる
  for (const card of getBaseCards()) {
    for (let i = 0; i < (cards[card.id] ?? 0); i++) sanitized = addCard(sanitized, card.id);
  }
  return sanitized;
};

// --- 保存（このブラウザの localStorage） ---

const STORAGE_KEY = 'cardgame.deck';

export const loadSavedDeck = (): DeckList | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const deck = JSON.parse(raw) as DeckList;
    return deck && typeof deck.leaderId === 'string' && typeof deck.cards === 'object' ? deck : null;
  } catch {
    return null;
  }
};

export const saveDeck = (deck: DeckList): boolean => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(deck));
    return true;
  } catch {
    return false;
  }
};
