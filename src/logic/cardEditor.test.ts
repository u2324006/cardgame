import { MonsterCard } from '../types/card';
import { BUILTIN_CARD_SET } from './cards';
import {
  Draft,
  changeCardType,
  createBlankDraft,
  deleteFromSet,
  describeEffect,
  duplicateDraft,
  finalizeDraft,
  getBalance,
  getCardStatus,
  hasEnoughKinds,
  upsertDraft,
  validateDraft,
} from './cardEditor';

const dragon = BUILTIN_CARD_SET.cards.find(c => c.id === 'm012') as MonsterCard;

const blankMonster = (changes: Partial<MonsterCard> = {}): Draft => {
  const draft = createBlankDraft('Monster');
  if (draft.kind !== 'Monster') throw new Error('monster expected');
  return { kind: 'Monster', card: { ...draft.card, ...changes } };
};

describe('card editor', () => {
  it('starts from a blank card that only needs a name', () => {
    const draft = createBlankDraft('Monster');
    expect(validateDraft(draft)).toEqual(['カード名を入力してください。']);
    expect(draft.card.id).not.toContain('-'); // '-' は1枚ごとの個別IDの区切り
  });

  it('rejects out-of-range or empty numbers', () => {
    const bad = blankMonster({ name: 'テスト', cost: 11, frontAttack: NaN, cardHp: 0 });
    expect(validateDraft(bad)).toEqual([
      'コストは0〜10の整数にしてください。',
      'FAは0〜20の整数にしてください。',
      'HPは1〜99の整数にしてください。',
    ]);
  });

  it('keeps name, cost and art when switching between monster and spell', () => {
    const named = blankMonster({ name: '火の玉', cost: 2, image: 'x.svg' });
    const spell = changeCardType(named, 'Spell');
    expect(spell.kind).toBe('Spell');
    expect(spell.card).toMatchObject({ id: named.card.id, name: '火の玉', cost: 2, image: 'x.svg' });
  });

  it('writes the spell summary from its effect when saving', () => {
    const spell = createBlankDraft('Spell');
    if (spell.kind !== 'Spell') throw new Error('spell expected');
    const edited = { ...spell, card: { ...spell.card, name: '雷', effect: { kind: 'damage' as const, amount: 4 } } };
    const saved = finalizeDraft(edited);
    expect(saved.card).toMatchObject({ summary: '4ダメージ' });
    expect(describeEffect({ kind: 'heal', amount: 2 })).toBe('味方モンスター1体のHPを2回復する（最大HPまで）。');
  });

  it('adds, updates and deletes cards in a card set', () => {
    const draft = blankMonster({ name: '新カード' });
    const added = upsertDraft(BUILTIN_CARD_SET, draft);
    expect(added.cards).toHaveLength(BUILTIN_CARD_SET.cards.length + 1);
    expect(getCardStatus(draft.card)).toBe('new');

    const weaker = { ...dragon, frontAttack: 3 };
    const updated = upsertDraft(added, { kind: 'Monster', card: weaker });
    expect(updated.cards.find(c => c.id === 'm012')).toMatchObject({ frontAttack: 3 });
    expect(getCardStatus(weaker)).toBe('modified');
    expect(getCardStatus(dragon)).toBe('builtin');

    const result = deleteFromSet(updated, 'm012');
    expect('set' in result && result.set.cards.some(c => c.id === 'm012')).toBe(false);
  });

  it('refuses to delete the last leader', () => {
    expect(deleteFromSet(BUILTIN_CARD_SET, 'l001')).toEqual({ error: '大将カードは最低1枚必要なので削除できません。' });
  });

  it('duplicates a card under a new id', () => {
    const copy = duplicateDraft({ kind: 'Monster', card: dragon });
    expect(copy.card.id).not.toBe(dragon.id);
    expect(copy.card.name).toBe('ドラゴンのコピー');
  });

  it('flags a monster much stronger than others of the same cost', () => {
    expect(getBalance(dragon, BUILTIN_CARD_SET).label).toBe('標準');
    const overpowered = { ...dragon, frontAttack: 12 };
    expect(getBalance(overpowered, BUILTIN_CARD_SET).label).toBe('強め');
  });

  it('warns when there are not enough kinds of cards for a 40-card deck', () => {
    expect(hasEnoughKinds(BUILTIN_CARD_SET)).toBe(true);
    expect(hasEnoughKinds({ ...BUILTIN_CARD_SET, cards: BUILTIN_CARD_SET.cards.slice(0, 13) })).toBe(false);
  });
});
