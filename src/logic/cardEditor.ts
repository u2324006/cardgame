import { Card, LeaderCard, MonsterCard, SpellCard, SpellEffect, isMonster } from '../types/card';
import { BUILTIN_CARD_SET, CardSet, createCardId } from './cards';
import { RULES } from './rules';

// カード作成画面で使う、カードの作成・チェック・強さの目安などの処理

export type EditorKind = 'Monster' | 'Spell' | 'Leader';

export type Draft =
  | { kind: 'Monster'; card: MonsterCard }
  | { kind: 'Spell'; card: SpellCard }
  | { kind: 'Leader'; card: LeaderCard };

export const LIMITS = {
  nameLength: 20,
  raceLength: 10,
  descriptionLength: 80,
  cost: { min: 0, max: 10 },
  attack: { min: 0, max: 20 },
  hp: { min: 1, max: 99 },
  effectAmount: { min: 1, max: 10 },
};

export const EFFECT_OPTIONS: { kind: SpellEffect['kind']; label: string }[] = [
  { kind: 'damage', label: '相手のモンスターにダメージ' },
  { kind: 'heal', label: '味方のモンスターを回復' },
  { kind: 'buffFa', label: '味方のモンスターの FA を上げる' },
];

// 効果の説明文（カードに表示し、対戦でもこのとおりに動く）
export const describeEffect = (effect: SpellEffect): string => {
  switch (effect.kind) {
    case 'damage': return `相手のモンスター1体に${effect.amount}ダメージを与える。`;
    case 'heal': return `味方モンスター1体のHPを${effect.amount}回復する（最大HPまで）。`;
    case 'buffFa': return `味方モンスター1体のFAを、ターン終了まで${effect.amount}上げる。`;
  }
};

// 手札の小さいカードに出す効果の要約
export const summarizeEffect = (effect: SpellEffect): string => {
  switch (effect.kind) {
    case 'damage': return `${effect.amount}ダメージ`;
    case 'heal': return `HP +${effect.amount}`;
    case 'buffFa': return `FA +${effect.amount}`;
  }
};

// --- 白紙のカード ---

export const createBlankDraft = (kind: EditorKind): Draft => {
  switch (kind) {
    case 'Monster':
      return {
        kind,
        card: { id: createCardId('c'), type: 'Monster', name: '', race: '', description: '', cost: 1, frontAttack: 0, backAttack: 0, cardHp: 1 },
      };
    case 'Spell': {
      const effect: SpellEffect = { kind: 'damage', amount: 1 };
      return {
        kind,
        card: { id: createCardId('c'), type: 'Spell', name: '', race: 'スペル', description: describeEffect(effect), cost: 1, effect, summary: summarizeEffect(effect) },
      };
    }
    case 'Leader':
      return { kind, card: { id: createCardId('l'), name: '', description: '', maxHp: 20 } };
  }
};

// モンスターとスペルを切り替える（名前・コスト・説明・絵は引き継ぐ）
export const changeCardType = (draft: Draft, kind: 'Monster' | 'Spell'): Draft => {
  if (draft.kind === kind || draft.kind === 'Leader') return draft;
  const { id, name, cost, image } = draft.card;
  const blank = createBlankDraft(kind);
  if (blank.kind === 'Leader') return blank;
  return { ...blank, card: { ...blank.card, id, name, cost, image } } as Draft;
};

export const draftFromCard = (card: Card): Draft =>
  isMonster(card) ? { kind: 'Monster', card } : { kind: 'Spell', card };

export const draftFromLeader = (card: LeaderCard): Draft => ({ kind: 'Leader', card });

// --- チェック ---

const inRange = (value: number, range: { min: number; max: number }) =>
  Number.isInteger(value) && value >= range.min && value <= range.max;

export const validateDraft = (draft: Draft): string[] => {
  const errors: string[] = [];
  const { card } = draft;
  const name = card.name.trim();
  if (!name) errors.push('カード名を入力してください。');
  if (name.length > LIMITS.nameLength) errors.push(`カード名は${LIMITS.nameLength}文字以内にしてください。`);
  if (card.description.length > LIMITS.descriptionLength) errors.push(`説明は${LIMITS.descriptionLength}文字以内にしてください。`);

  if (draft.kind === 'Leader') {
    if (!inRange(draft.card.maxHp, LIMITS.hp)) errors.push(`HPは${LIMITS.hp.min}〜${LIMITS.hp.max}の整数にしてください。`);
    return errors;
  }

  if (!inRange(draft.card.cost, LIMITS.cost)) errors.push(`コストは${LIMITS.cost.min}〜${LIMITS.cost.max}の整数にしてください。`);
  if ((draft.card.race ?? '').length > LIMITS.raceLength) errors.push(`種族は${LIMITS.raceLength}文字以内にしてください。`);

  if (draft.kind === 'Monster') {
    const { frontAttack, backAttack, cardHp } = draft.card;
    if (!inRange(frontAttack, LIMITS.attack)) errors.push(`FAは${LIMITS.attack.min}〜${LIMITS.attack.max}の整数にしてください。`);
    if (!inRange(backAttack, LIMITS.attack)) errors.push(`BAは${LIMITS.attack.min}〜${LIMITS.attack.max}の整数にしてください。`);
    if (!inRange(cardHp, LIMITS.hp)) errors.push(`HPは${LIMITS.hp.min}〜${LIMITS.hp.max}の整数にしてください。`);
  } else if (!inRange(draft.card.effect.amount, LIMITS.effectAmount)) {
    errors.push(`効果の数値は${LIMITS.effectAmount.min}〜${LIMITS.effectAmount.max}の整数にしてください。`);
  }
  return errors;
};

// 保存する形に整える（名前の前後の空白を取り、スペルの要約を効果から作り直す）
export const finalizeDraft = (draft: Draft): Draft => {
  if (draft.kind === 'Spell') {
    return { ...draft, card: { ...draft.card, name: draft.card.name.trim(), summary: summarizeEffect(draft.card.effect) } };
  }
  return { ...draft, card: { ...draft.card, name: draft.card.name.trim() } } as Draft;
};

// --- カードセットの更新 ---

export const upsertDraft = (set: CardSet, draft: Draft): CardSet => {
  if (draft.kind === 'Leader') {
    const exists = set.leaders.some(l => l.id === draft.card.id);
    return { ...set, leaders: exists ? set.leaders.map(l => (l.id === draft.card.id ? draft.card : l)) : [...set.leaders, draft.card] };
  }
  const exists = set.cards.some(c => c.id === draft.card.id);
  return { ...set, cards: exists ? set.cards.map(c => (c.id === draft.card.id ? draft.card : c)) : [...set.cards, draft.card] };
};

// 削除できないときは理由を返す
export const deleteFromSet = (set: CardSet, id: string): { set: CardSet } | { error: string } => {
  if (set.leaders.some(l => l.id === id)) {
    if (set.leaders.length <= 1) return { error: '大将カードは最低1枚必要なので削除できません。' };
    return { set: { ...set, leaders: set.leaders.filter(l => l.id !== id) } };
  }
  return { set: { ...set, cards: set.cards.filter(c => c.id !== id) } };
};

// 同じ内容の新しいカードを作る（名前に「のコピー」を付ける）
export const duplicateDraft = (draft: Draft): Draft => ({
  ...draft,
  card: { ...draft.card, id: createCardId(draft.kind === 'Leader' ? 'l' : 'c'), name: `${draft.card.name}のコピー`.slice(0, LIMITS.nameLength) },
} as Draft);

// --- 最初から入っているカードとの比較 ---

export const findBuiltin = (id: string): Card | LeaderCard | undefined =>
  [...BUILTIN_CARD_SET.cards, ...BUILTIN_CARD_SET.leaders].find(c => c.id === id);

export type CardStatus = 'builtin' | 'modified' | 'new';

export const getCardStatus = (card: Card | LeaderCard): CardStatus => {
  const builtin = findBuiltin(card.id);
  if (!builtin) return 'new';
  return JSON.stringify(builtin) === JSON.stringify(card) ? 'builtin' : 'modified';
};

// デッキを40枚組めるだけのカードの種類があるか
export const minimumKinds = Math.ceil(RULES.deckSize / RULES.maxCopiesPerCard);
export const hasEnoughKinds = (set: CardSet): boolean => set.cards.length >= minimumKinds;

// --- 強さの目安（モンスターのみ） ---
// 能力値の合計（FA + BA + HP の半分）を、同じコストのほかのモンスターの平均と比べる。
// あくまで目安で、効果や前衛・後衛の向き不向きは考えていない。

export const monsterPower = (card: MonsterCard): number => card.frontAttack + card.backAttack + card.cardHp / 2;

export interface Balance {
  power: number;
  average: number | null; // 同じコストのほかのモンスターの平均（比べる相手がいなければ null）
  ratio: number | null;
  label: '強め' | '弱め' | '標準' | '比較なし';
}

const STRONG_RATIO = 1.2;
const WEAK_RATIO = 0.8;

export const getBalance = (card: MonsterCard, set: CardSet): Balance => {
  const power = monsterPower(card);
  const peers = set.cards.filter((c): c is MonsterCard => isMonster(c) && c.cost === card.cost && c.id !== card.id);
  if (peers.length === 0) return { power, average: null, ratio: null, label: '比較なし' };
  const average = peers.reduce((sum, c) => sum + monsterPower(c), 0) / peers.length;
  const ratio = average > 0 ? power / average : null;
  const label = ratio === null ? '比較なし' : ratio >= STRONG_RATIO ? '強め' : ratio <= WEAK_RATIO ? '弱め' : '標準';
  return { power, average, ratio, label };
};
