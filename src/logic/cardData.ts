import {
  Card, IMPLEMENTED_EFFECT_KINDS, ImplementationStatus, LeaderAbility, LeaderCard, MONSTER_ABILITY_KINDS, MonsterAbility, MonsterCard, SpellCard, SpellEffect, SpellTarget,
  getSpellTarget,
} from '../types/card';
import { cardImage } from './builtinCards';
import { summarizeEffect } from './spellEffects';

// カードを、カテゴリ（モンスター・スペル・大将）ごとの JSON の形（レコード）に変換する。
// この JSON を AI に渡して、効果の実装やイラストの作成をしてもらう。
// 取り込んだ JSON は src/data/cards/ に置き、最初から入っているカードとして読み込む。

export interface Illustration {
  prompt: string; // イラストのイメージ（文章）
  image: string; // 今使っている画像（用意されたイラストはファイル名、アップロードした画像は data URL、なければ空）
}

interface RecordBase {
  id: string;
  name: string;
  race: string;
  effectText: string;
  flavorText: string;
  illustration: Illustration;
  implementation: ImplementationStatus;
  memo: string;
  updatedAt?: string; // 最後に保存・取り込みした日時（新しい方が使われる）
}

export interface MonsterRecord extends RecordBase {
  cost: number;
  frontAttack: number;
  backAttack: number;
  hp: number;
  effect?: MonsterAbility | null; // 実装済みの効果（まだなければ null）
}

export interface SpellRecord extends RecordBase {
  cost: number;
  target: SpellTarget;
  effect: { kind: Exclude<SpellEffect['kind'], 'custom'>; amount: number } | null; // 実装済みの効果（まだなければ null）
}

export interface LeaderRecord extends RecordBase {
  maxHp: number;
  effect?: LeaderAbility | null; // 実装済みの効果（まだなければ null）
}

export interface CardRecords {
  monsters: MonsterRecord[];
  spells: SpellRecord[];
  leaders: LeaderRecord[];
}

// --- 画像の表し方 ---

const IMAGE_DIR = '/images/cards/';

// 用意されたイラストの URL はファイル名だけにする（どこに公開しても読めるように）
export const imageToRecord = (image?: string): string => {
  if (!image) return '';
  const index = image.indexOf(IMAGE_DIR);
  return index >= 0 && !image.startsWith('data:') ? image.slice(index + IMAGE_DIR.length) : image;
};

export const imageFromRecord = (image: string): string | undefined => {
  if (!image) return undefined;
  if (image.startsWith('data:') || image.includes('/')) return image;
  return cardImage(image);
};

// --- カード → レコード ---

const notesToRecord = (card: Card | LeaderCard) => ({
  id: card.id,
  name: card.name,
  race: card.race ?? '',
  effectText: card.effectText ?? '',
  flavorText: card.flavorText ?? card.description,
  illustration: { prompt: card.illustrationPrompt ?? '', image: imageToRecord(card.image) },
  implementation: card.implementation ?? (card.effectText ? '未実装' : '効果なし'),
  memo: card.memo ?? '',
  ...(card.updatedAt ? { updatedAt: card.updatedAt } : {}),
});

export const toMonsterRecord = (card: MonsterCard): MonsterRecord => ({
  ...notesToRecord(card),
  cost: card.cost,
  frontAttack: card.frontAttack,
  backAttack: card.backAttack,
  hp: card.cardHp,
  ...(card.ability ? { effect: card.ability } : {}),
});

export const toSpellRecord = (card: SpellCard): SpellRecord => {
  const { effect } = card;
  const implemented = effect.kind !== 'custom';
  return {
    ...notesToRecord(card),
    // 最初から入っているスペルは説明文が効果の文章
    effectText: card.effectText ?? (implemented ? card.description : ''),
    flavorText: card.flavorText ?? '',
    implementation: card.implementation ?? (implemented ? '実装済み' : '未実装'),
    cost: card.cost,
    target: getSpellTarget(card),
    effect: effect.kind === 'custom' ? null : { kind: effect.kind, amount: effect.amount },
  };
};

export const toLeaderRecord = (card: LeaderCard): LeaderRecord => ({
  ...notesToRecord(card),
  maxHp: card.maxHp,
  effect: card.ability ?? null,
});

export const toRecords = (cards: Card[], leaders: LeaderCard[]): CardRecords => ({
  monsters: cards.filter((c): c is MonsterCard => c.type === 'Monster').map(toMonsterRecord),
  spells: cards.filter((c): c is SpellCard => c.type === 'Spell').map(toSpellRecord),
  leaders: leaders.map(toLeaderRecord),
});

// --- レコード → カード ---

const describe = (effectText: string, flavorText: string) => [effectText.trim(), flavorText.trim()].filter(Boolean).join(' ');

const notesFromRecord = (record: RecordBase) => ({
  id: record.id,
  name: record.name,
  race: record.race || undefined,
  description: describe(record.effectText, record.flavorText),
  image: imageFromRecord(record.illustration.image),
  effectText: record.effectText,
  flavorText: record.flavorText,
  illustrationPrompt: record.illustration.prompt,
  implementation: record.implementation,
  memo: record.memo,
  ...(record.updatedAt ? { updatedAt: record.updatedAt } : {}),
});

export const fromMonsterRecord = (record: MonsterRecord): MonsterCard => ({
  type: 'Monster',
  ...notesFromRecord(record),
  cost: record.cost,
  frontAttack: record.frontAttack,
  backAttack: record.backAttack,
  cardHp: record.hp,
  ...(record.effect ? { ability: record.effect } : {}),
});

export const fromSpellRecord = (record: SpellRecord): SpellCard => {
  const effect = (record.effect ? { kind: record.effect.kind, amount: record.effect.amount } : { kind: 'custom' }) as SpellEffect;
  return {
    type: 'Spell',
    ...notesFromRecord(record),
    race: record.race || 'スペル',
    cost: record.cost,
    effect,
    ...(record.effect ? {} : { target: record.target }),
    summary: summarizeEffect(effect),
  };
};

export const fromLeaderRecord = (record: LeaderRecord): LeaderCard => ({
  ...notesFromRecord(record),
  maxHp: record.maxHp,
  ...(record.effect ? { ability: record.effect } : {}),
});

// --- 形のチェック ---

const IMPLEMENTATION: ImplementationStatus[] = ['未実装', '実装済み', '効果なし'];
const TARGETS: SpellTarget[] = ['allyMonster', 'enemyMonster', 'anyMonster', 'allyLeader', 'enemyLeader', 'none'];
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isText = (v: unknown): v is string => typeof v === 'string';

const isRecordBase = (r: RecordBase): boolean =>
  !!r && isText(r.id) && /^[A-Za-z0-9_]+$/.test(r.id) && isText(r.name) && isText(r.race)
  && isText(r.effectText) && isText(r.flavorText) && isText(r.memo)
  && !!r.illustration && isText(r.illustration.prompt) && isText(r.illustration.image)
  && IMPLEMENTATION.includes(r.implementation)
  && (r.updatedAt === undefined || isText(r.updatedAt));

export const isMonsterRecord = (r: unknown): r is MonsterRecord => {
  const m = r as MonsterRecord;
  return isRecordBase(m) && isNumber(m.cost) && isNumber(m.frontAttack) && isNumber(m.backAttack) && isNumber(m.hp)
    && (m.effect === undefined || m.effect === null || isMonsterAbility(m.effect));
};

export const isSpellRecord = (r: unknown): r is SpellRecord => {
  const s = r as SpellRecord;
  const effectOk = s?.effect === null
    || (!!s?.effect && IMPLEMENTED_EFFECT_KINDS.includes(s.effect.kind) && isNumber(s.effect.amount));
  return isRecordBase(s) && isNumber(s.cost) && TARGETS.includes(s.target) && effectOk;
};

const isLeaderAbility = (effect: unknown): effect is LeaderAbility => {
  const e = effect as LeaderAbility;
  if (!e) return false;
  switch (e.kind) {
    case 'raceHpBonus': return isText(e.race) && isNumber(e.amount);
    case 'rallyEnergy': return isNumber(e.hpThreshold) && isNumber(e.amount);
    case 'healOnMove': return isNumber(e.amount);
    case 'backRowBaBonus': return isNumber(e.amount) && (e.hpRatio === undefined || isNumber(e.hpRatio));
    case 'extraDrawWhenBehind': return isNumber(e.margin) && isNumber(e.amount);
    case 'spellEnergy': return isNumber(e.amount);
    case 'extraDrawWhenFewCards': return isNumber(e.handSize) && isNumber(e.amount);
    default: return false;
  }
};

const isMonsterAbility = (effect: unknown): effect is MonsterAbility => {
  const e = effect as MonsterAbility;
  if (!e || !MONSTER_ABILITY_KINDS.includes(e.kind)) return false;
  switch (e.kind) {
    case 'freeSpellOnSummon':
    case 'freeSummonOnSummon': return isNumber(e.maxCost);
    case 'drawIfLowEnergy': return isNumber(e.amount) && isNumber(e.threshold);
    case 'sniper':
    case 'summonWhenDiscarded': return true;
    default: return isNumber(e.amount);
  }
};

export const isLeaderRecord = (r: unknown): r is LeaderRecord => {
  const l = r as LeaderRecord;
  return isRecordBase(l) && isNumber(l.maxHp) && (l.effect === undefined || l.effect === null || isLeaderAbility(l.effect));
};

// 貼り付けられた JSON を読む。カテゴリごとの配列（monsters.json など）か、3つをまとめたものを受け付ける
export const parseRecords = (text: string): CardRecords | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const records: CardRecords = { monsters: [], spells: [], leaders: [] };
  const items: unknown[] = Array.isArray(parsed)
    ? parsed
    : [...((parsed as CardRecords)?.monsters ?? []), ...((parsed as CardRecords)?.spells ?? []), ...((parsed as CardRecords)?.leaders ?? [])];
  if (items.length === 0) return null;
  for (const item of items) {
    if (isMonsterRecord(item)) records.monsters.push(item);
    else if (isSpellRecord(item)) records.spells.push(item);
    else if (isLeaderRecord(item)) records.leaders.push(item);
    else return null;
  }
  return records;
};

export const recordsToCards = (records: CardRecords): { cards: Card[]; leaders: LeaderCard[] } => ({
  cards: [...records.monsters.map(fromMonsterRecord), ...records.spells.map(fromSpellRecord)],
  leaders: records.leaders.map(fromLeaderRecord),
});
