import { Card, LeaderCard, MonsterCard, SpellEffect } from '../types/card';
import { BUILTIN_LEADER_CARDS, BUILTIN_MONSTER_CARDS, BUILTIN_SPELL_CARDS } from './builtinCards';
import { CardRecords, isLeaderRecord, isMonsterRecord, isSpellRecord, recordsToCards } from './cardData';
import monsterRecords from '../data/cards/monsters.json';
import spellRecords from '../data/cards/spells.json';
import leaderRecords from '../data/cards/leaders.json';

// 今使っているカードの一覧（カードセット）。
// 最初から入っているカード（builtinCards.ts と src/data/cards/*.json）に、カード作成画面で変更・追加した内容を反映したもの。
// 変更はこのブラウザの localStorage に保存する。
// デッキ作成時には、カードの ID に `-番号` を付けて1枚ごとの個別IDにする（例: 'm001-2'）。

export interface CardSet {
  cards: Card[]; // モンスターとスペル
  leaders: LeaderCard[];
}

// 同じ ID のカードは後のもので置き換え、新しい ID のカードは後ろに足す
export const mergeById = <T extends { id: string }>(base: T[], extra: T[]): T[] => {
  const extraById = new Map(extra.map(item => [item.id, item]));
  const merged = base.map(item => extraById.get(item.id) ?? item);
  const baseIds = new Set(base.map(item => item.id));
  return [...merged, ...extra.filter(item => !baseIds.has(item.id))];
};

// src/data/cards/*.json（カード作成で作ったカードを取り込んだもの）。形が正しくないものは読み込まない
const dataRecords: CardRecords = {
  monsters: (monsterRecords as unknown[]).filter(isMonsterRecord),
  spells: (spellRecords as unknown[]).filter(isSpellRecord),
  leaders: (leaderRecords as unknown[]).filter(isLeaderRecord),
};
const dataCards = recordsToCards(dataRecords);

export const BUILTIN_CARD_SET: CardSet = {
  cards: mergeById([...BUILTIN_MONSTER_CARDS, ...BUILTIN_SPELL_CARDS], dataCards.cards),
  leaders: mergeById(BUILTIN_LEADER_CARDS, dataCards.leaders),
};

const STORAGE_KEY = 'cardgame.cards';
const VERSION = 1;

// --- 形のチェック（保存データや読み込んだ文字列が壊れていないか） ---

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isText = (value: unknown): value is string => typeof value === 'string';
const isValidId = (id: unknown): id is string => isText(id) && /^[A-Za-z0-9_]+$/.test(id);

const isSpellEffect = (effect: unknown): effect is SpellEffect => {
  const e = effect as SpellEffect;
  if (!e) return false;
  if (e.kind === 'custom') return true;
  return ['buffFa', 'heal', 'damage'].includes(e.kind) && isNumber(e.amount);
};

const isCard = (value: unknown): value is Card => {
  const card = value as Card;
  if (!card || !isValidId(card.id) || !isText(card.name) || !isText(card.description) || !isNumber(card.cost)) return false;
  if (card.type === 'Monster') return isNumber(card.frontAttack) && isNumber(card.backAttack) && isNumber(card.cardHp);
  if (card.type === 'Spell') return isSpellEffect(card.effect);
  return false;
};

const isLeader = (value: unknown): value is LeaderCard => {
  const leader = value as LeaderCard;
  return !!leader && isValidId(leader.id) && isText(leader.name) && isText(leader.description) && isNumber(leader.maxHp);
};

const hasUniqueIds = (set: CardSet) => {
  const ids = [...set.cards, ...set.leaders].map(c => c.id);
  return new Set(ids).size === ids.length;
};

export const isCardSet = (value: unknown): value is CardSet => {
  const set = value as CardSet;
  return !!set && Array.isArray(set.cards) && Array.isArray(set.leaders)
    && set.cards.every(isCard) && set.leaders.every(isLeader)
    && set.leaders.length > 0 && hasUniqueIds(set);
};

// --- 読み込み・保存 ---

const loadStoredCardSet = (): CardSet | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    return saved?.version === VERSION && isCardSet(saved.cardSet) ? saved.cardSet : null;
  } catch {
    return null;
  }
};

let current: CardSet | null = null;

export const getCardSet = (): CardSet => {
  if (!current) current = loadStoredCardSet() ?? BUILTIN_CARD_SET;
  return current;
};

// カードセットを保存して、すぐにゲーム全体へ反映する
export const saveCardSet = (set: CardSet): boolean => {
  current = set;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, cardSet: set }));
    return true;
  } catch {
    return false;
  }
};

// 変更をすべて捨てて、最初から入っているカードに戻す
export const resetCardSet = (): void => {
  current = BUILTIN_CARD_SET;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 何もしない
  }
};

// テスト用：次に読むときに保存データを読み直す
export const clearCardSetCache = (): void => {
  current = null;
};

// --- カードを引く ---

export const getBaseCards = (): Card[] => getCardSet().cards;
export const getLeaderCards = (): LeaderCard[] => getCardSet().leaders;
export const getDefaultLeader = (): LeaderCard => getLeaderCards()[0];

export const findBaseCard = (baseId: string): Card | undefined => getBaseCards().find(c => c.id === baseId);
export const findLeader = (leaderId: string): LeaderCard | undefined => getLeaderCards().find(l => l.id === leaderId);

// 個別IDから元カードのIDを取り出す（例: 's001-12' → 's001'）
export const getBaseCardId = (card: Card): string => card.id.split('-')[0];

// ダメージなどで変化したカードを、個別IDはそのままに元の能力値へ戻す（墓地へ送るときに使う）
export const toOriginalCard = <T extends Card>(card: T): T => {
  const base = findBaseCard(getBaseCardId(card));
  return base && base.type === card.type ? ({ ...base, id: card.id } as T) : card;
};

// ダメージを受ける前の最大HP（元のカードが見つからなければ今のHP）
export const getMaxHp = (card: MonsterCard): number => {
  const original = toOriginalCard(card);
  return Math.max(original.cardHp, card.cardHp);
};

// 新しいカードのID（'-' は個別IDの区切りに使うので含めない）
export const createCardId = (prefix: 'c' | 'l'): string =>
  `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
