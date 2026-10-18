import {
  Card,
  ImplementationStatus,
  LeaderCard,
  MonsterCard,
  SpellCard,
  SpellEffect,
  SpellTarget,
  getSpellTarget,
  isImplementedEffect,
  isMonster,
} from '../types/card';
import { BUILTIN_CARD_SET, CardSet, createCardId } from './cards';
import { describeEffect, summarizeEffect } from './spellEffects';
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
  effectTextLength: 120,
  flavorTextLength: 60,
  illustrationPromptLength: 300,
  memoLength: 300,
  cost: { min: 0, max: 10 },
  attack: { min: 0, max: 20 },
  hp: { min: 1, max: 99 },
  effectAmount: { min: 1, max: 10 },
};

export const EFFECT_OPTIONS: { kind: SpellEffect['kind']; label: string }[] = [
  { kind: 'damage', label: '相手のモンスターにダメージ' },
  { kind: 'heal', label: '味方のモンスターを回復' },
  { kind: 'buffFa', label: '味方のモンスターの FA を上げる' },
  { kind: 'buffBa', label: '味方のモンスターの BA を上げる' },
  { kind: 'drawDiscard', label: '引いて同じ枚数を捨てる' },
  { kind: 'disableLeader', label: '相手の大将の効果をなくす' },
  { kind: 'damageBack', label: '相手の後衛のモンスターにダメージ' },
  { kind: 'forceMove', label: '相手のモンスターを移動させる' },
  { kind: 'catchUpEnergy', label: 'モンスターの数の差だけエネルギーを増やす' },
  { kind: 'damageFrontAll', label: '相手の前衛すべてにダメージ' },
  { kind: 'volley', label: '自分の後衛の数だけ相手の前衛にダメージ' },
  { kind: 'retreat', label: '自分の前衛を後衛へ下げて回復' },
  { kind: 'swapColumn', label: '自分の前衛と後衛を入れ替える' },
  { kind: 'pullForward', label: '相手の後衛を前衛へ移動させる' },
  { kind: 'lastStand', label: '劣勢のとき全員の攻撃力を上げる' },
  { kind: 'guardLeader', label: '自分の大将が受けるダメージを減らす' },
  { kind: 'freeSummon', label: '手札のモンスターを無料で前衛に召喚' },
  { kind: 'spellDiscount', label: '次に使うスペルのコストを下げる' },
  { kind: 'summonDiscount', label: '劣勢のとき次の召喚のコストを下げる' },
  { kind: 'sacrificeSummon', label: '自分のモンスターを墓地に置いて無料召喚' },
  { kind: 'delayedEnergy', label: '次のターンにエネルギーを増やす' },
  { kind: 'discardForEnergy', label: '手札を捨ててエネルギーを増やす' },
  { kind: 'raiseMaxEnergy', label: 'エネルギーの上限を上げる' },
  { kind: 'drainEnergy', label: '相手のエネルギーを減らす' },
  { kind: 'lifeToEnergy', label: '大将の HP をエネルギーに変える' },
  { kind: 'sacrificeForEnergy', label: '自分のモンスターをエネルギーに変える' },
  { kind: 'draw', label: 'カードを引く' },
  { kind: 'supplyLine', label: '後衛のモンスターを墓地に送って引く' },
  { kind: 'spoils', label: '相手を倒したら引く' },
  { kind: 'graveRob', label: '墓地のモンスターを手札に戻す' },
  { kind: 'discardDraw', label: '1枚捨てて引く' },
  { kind: 'randomDiscard', label: '相手の手札をランダムに捨てさせる' },
  { kind: 'firebomb', label: '手札を捨ててダメージ' },
  { kind: 'reveal', label: '相手の手札を見て捨てさせる' },
  { kind: 'reshuffle', label: '手札を引き直す' },
  { kind: 'custom', label: 'まだない効果' },
];

export const TARGET_OPTIONS: { target: SpellTarget; label: string }[] = [
  { target: 'enemyMonster', label: '相手のモンスター' },
  { target: 'allyMonster', label: '味方のモンスター' },
  { target: 'anyMonster', label: 'どちらかのモンスター' },
  { target: 'enemyLeader', label: '相手の大将' },
  { target: 'allyLeader', label: '自分の大将' },
  { target: 'none', label: '対象なし' },
];

export { describeEffect, summarizeEffect };

export { getSpellTarget };

// --- 白紙のカード ---

const blankNotes = { effectText: '', flavorText: '', illustrationPrompt: '', memo: '' };

export const createBlankDraft = (kind: EditorKind): Draft => {
  switch (kind) {
    case 'Monster':
      return {
        kind,
        card: { id: createCardId('c'), type: 'Monster', name: '', race: '', description: '', cost: 1, frontAttack: 0, backAttack: 0, cardHp: 1, ...blankNotes },
      };
    case 'Spell': {
      const effect: SpellEffect = { kind: 'damage', amount: 1 };
      return {
        kind,
        card: {
          id: createCardId('c'), type: 'Spell', name: '', race: 'スペル', description: '', cost: 1, effect,
          ...blankNotes, effectText: describeEffect(effect),
        },
      };
    }
    case 'Leader':
      return { kind, card: { id: createCardId('l'), name: '', description: '', maxHp: 20, ...blankNotes } };
  }
};

// 最初から入っているカードなど、効果の文章・雰囲気の文がまだないカードを編集できる形にする
// （スペルは効果の説明を「効果」に、それ以外は今の説明文を「雰囲気の文」に入れる）
const withNotes = <T extends Card | LeaderCard>(card: T, isSpell: boolean): T => {
  if (card.effectText !== undefined || card.flavorText !== undefined) return { ...blankNotes, ...card };
  return isSpell
    ? { ...blankNotes, ...card, effectText: card.description }
    : { ...blankNotes, ...card, flavorText: card.description };
};

export const draftFromCard = (card: Card): Draft =>
  isMonster(card) ? { kind: 'Monster', card: withNotes(card, false) } : { kind: 'Spell', card: withNotes(card, true) };

export const draftFromLeader = (card: LeaderCard): Draft => ({ kind: 'Leader', card: withNotes(card, false) });

// モンスターとスペルを切り替える（名前・コスト・絵・AI に渡す情報は引き継ぐ）
export const changeCardType = (draft: Draft, kind: 'Monster' | 'Spell'): Draft => {
  if (draft.kind === kind || draft.kind === 'Leader') return draft;
  const { id, name, cost, image, flavorText, illustrationPrompt, memo } = draft.card;
  const blank = createBlankDraft(kind);
  if (blank.kind === 'Leader') return blank;
  return { ...blank, card: { ...blank.card, id, name, cost, image, flavorText, illustrationPrompt, memo } } as Draft;
};

// --- チェック ---

const inRange = (value: number, range: { min: number; max: number }) =>
  Number.isInteger(value) && value >= range.min && value <= range.max;

export const validateDraft = (draft: Draft): string[] => {
  const errors: string[] = [];
  const { card } = draft;
  const name = card.name.trim();
  if (!name) errors.push('カード名を入力してください。');
  if (name.length > LIMITS.nameLength) errors.push(`カード名は${LIMITS.nameLength}文字以内にしてください。`);
  if ((card.effectText ?? '').length > LIMITS.effectTextLength) errors.push(`効果は${LIMITS.effectTextLength}文字以内にしてください。`);
  if ((card.flavorText ?? '').length > LIMITS.flavorTextLength) errors.push(`雰囲気の文は${LIMITS.flavorTextLength}文字以内にしてください。`);
  if ((card.illustrationPrompt ?? '').length > LIMITS.illustrationPromptLength) {
    errors.push(`イラストのイメージは${LIMITS.illustrationPromptLength}文字以内にしてください。`);
  }
  if ((card.memo ?? '').length > LIMITS.memoLength) errors.push(`メモは${LIMITS.memoLength}文字以内にしてください。`);

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
  } else if (isImplementedEffect(draft.card.effect)) {
    if (!inRange(draft.card.effect.amount, LIMITS.effectAmount)) {
      errors.push(`効果の数値は${LIMITS.effectAmount.min}〜${LIMITS.effectAmount.max}の整数にしてください。`);
    }
  } else if (!(draft.card.effectText ?? '').trim()) {
    errors.push('まだない効果のスペルは、効果を文章で書いてください。');
  }
  return errors;
};

// --- 保存する形に整える ---

// 効果の実装状況：実装済みの効果のスペルは「実装済み」、効果の文章がなければ「効果なし」、
// それ以外は、前に保存したときと効果の文章が同じなら前の状態を引き継ぎ、変わっていれば「未実装」
export const getImplementationStatus = (draft: Draft, previous?: Card | LeaderCard): ImplementationStatus => {
  if (draft.kind === 'Spell' && isImplementedEffect(draft.card.effect)) return '実装済み';
  const effectText = (draft.card.effectText ?? '').trim();
  if (!effectText) return '効果なし';
  if (previous?.implementation && (previous.effectText ?? '').trim() === effectText) return previous.implementation;
  return '未実装';
};

// カードに表示する説明文：効果の文章と雰囲気の文をつなげる
export const composeDescription = (effectText = '', flavorText = ''): string =>
  [effectText.trim(), flavorText.trim()].filter(Boolean).join(' ');

export const finalizeDraft = (draft: Draft, previous?: Card | LeaderCard): Draft => {
  const implementation = getImplementationStatus(draft, previous);
  const common = {
    name: draft.card.name.trim(),
    effectText: (draft.card.effectText ?? '').trim(),
    flavorText: (draft.card.flavorText ?? '').trim(),
    illustrationPrompt: (draft.card.illustrationPrompt ?? '').trim(),
    memo: (draft.card.memo ?? '').trim(),
    implementation,
    updatedAt: new Date().toISOString(),
  };
  const description = composeDescription(common.effectText, common.flavorText);
  if (draft.kind === 'Spell') {
    const { effect } = draft.card;
    const card: SpellCard = { ...draft.card, ...common, description, summary: summarizeEffect(effect) };
    if (isImplementedEffect(effect)) delete card.target;
    else card.target = draft.card.target ?? 'none';
    return { kind: 'Spell', card };
  }
  return { ...draft, card: { ...draft.card, ...common, description } } as Draft;
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
