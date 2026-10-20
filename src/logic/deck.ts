import { Card, MonsterCard, SpellEffect, isMonster } from '../types/card';
import { findBaseCard, findLeader, getBaseCards, getDefaultLeader, getLeaderCards } from './cards';
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

// 自動で作るデッキ（AI と、デッキを作っていないときに使う）：ランダムな種族のデッキ
export const createDefaultDeckList = (): DeckList => createRaceDeckList();

const pickRandom = <T,>(items: T[], count: number, random: () => number): T[] => {
  const pool = [...items];
  const picked: T[] = [];
  while (picked.length < count && pool.length > 0) picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  return picked;
};

const RACE_DECK_MONSTER_KINDS = 9; // 種族デッキに入れるモンスターの種類（3枚ずつ）
// 自動のデッキに入れないスペル（使いどころの少ないもの）
const EXCLUDED_AUTO_SPELLS: SpellEffect['kind'][] = ['custom', 'raiseMaxEnergy'];

// デッキを組める種族（モンスターが RACE_DECK_MONSTER_KINDS 種類以上いる種族）
export const getDeckRaces = (): string[] => {
  const counts = new Map<string, number>();
  getBaseCards().forEach(c => { if (isMonster(c) && c.race) counts.set(c.race, (counts.get(c.race) ?? 0) + 1); });
  return Array.from(counts.entries()).filter(([, n]) => n >= RACE_DECK_MONSTER_KINDS).map(([race]) => race);
};

// 種族デッキで、その種族と一緒に入れる仲間（協力し合う種族）
const RACE_PARTNERS: Record<string, string> = { ゴブリン: 'オーク', オーク: 'ゴブリン' };
const PARTNER_KINDS = 3; // 仲間の種族・前衛の戦士の種類

// 種族デッキ：その種族のモンスターを3枚ずつ（9種類、計27枚）と、ランダムな汎用スペルで40枚にする。
// - ゴブリン・オークは、お互いを2種類と、後衛型の戦士を2種類入れる（協力する効果があり、どちらも前衛向きのため）
// - 後衛向きの種族（BA の平均が FA より 1 以上高い）は、大将を攻撃できるよう前衛型の戦士を3種類入れる
// - 前衛向きの種族（FA の平均が BA より 1 以上高い）は、後衛を埋められるよう後衛型の戦士を3種類入れる
// 大将は、その種族を強くする大将がいればそれ、いなければ既定の大将
export const createRaceDeckList = (race?: string, random: () => number = Math.random): DeckList => {
  const races = getDeckRaces();
  const chosen = race ?? races[Math.floor(random() * races.length)];
  const cards = getBaseCards();
  const raceMonsters = cards.filter((c): c is MonsterCard => isMonster(c) && c.race === chosen);
  const average = (key: 'frontAttack' | 'backAttack') => raceMonsters.reduce((sum, c) => sum + c[key], 0) / Math.max(1, raceMonsters.length);
  const partnerRace = RACE_PARTNERS[chosen];
  // 基準カード（効果のない戦士）のうち、前衛型・後衛型
  const plainWarriors = (front: boolean) => cards.filter(c => isMonster(c) && c.race === '戦士' && !c.ability
    && (front ? c.frontAttack >= 2 && c.frontAttack > c.backAttack : c.backAttack >= 2 && c.backAttack > c.frontAttack));
  const leaning = average('backAttack') - average('frontAttack');
  const partners = partnerRace
    ? cards.filter(c => isMonster(c) && c.race === partnerRace)
    : chosen === '戦士' || Math.abs(leaning) < 1 ? [] : plainWarriors(leaning > 0);
  // 協力する種族も前衛向きなら、後衛型の戦士も2種類入れる（仲間2種類・自分の種族5種類）
  const partnerPicks = partnerRace
    ? [...pickRandom(partners, 2, random), ...pickRandom(plainWarriors(false), 2, random)]
    : pickRandom(partners, PARTNER_KINDS, random);
  const monsters = [...pickRandom(raceMonsters, RACE_DECK_MONSTER_KINDS - partnerPicks.length, random), ...partnerPicks];
  const spells = pickRandom(cards.filter(c => !isMonster(c) && !EXCLUDED_AUTO_SPELLS.includes(c.effect.kind)), cards.length, random);
  const raceLeader = getLeaderCards().find(l => l.ability?.kind === 'raceHpBonus' && l.ability.race === chosen);
  let deck: DeckList = { leaderId: (raceLeader ?? getDefaultLeader()).id, cards: {} };
  for (const card of [...monsters, ...spells]) {
    for (let i = 0; i < RULES.maxCopiesPerCard; i++) deck = addCard(deck, card.id);
  }
  return fillDeck(deck);
};

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
