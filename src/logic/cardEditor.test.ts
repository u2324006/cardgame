import { MonsterCard } from '../types/card';
import { BUILTIN_CARD_SET } from './cards';
import {
  Draft,
  changeCardType,
  createBlankDraft,
  deleteFromSet,
  describeEffect,
  duplicateDraft,
  draftFromCard,
  finalizeDraft,
  getBalance,
  getImplementationStatus,
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
    const onlyOne = { ...BUILTIN_CARD_SET, leaders: BUILTIN_CARD_SET.leaders.filter(l => l.id === 'l001') };
    expect(deleteFromSet(onlyOne, 'l001')).toEqual({ error: '大将カードは最低1枚必要なので削除できません。' });
  });

  it('duplicates a card under a new id', () => {
    const copy = duplicateDraft({ kind: 'Monster', card: dragon });
    expect(copy.card.id).not.toBe(dragon.id);
    expect(copy.card.name).toBe('ドラゴンのコピー');
  });

  it('flags a monster much stronger than others of the same cost', () => {
    // 比べる相手はコスト3の騎士とドラゴンだけにする（指揮官・召喚士は効果持ちで能力値が低い）
    const set = { ...BUILTIN_CARD_SET, cards: BUILTIN_CARD_SET.cards.filter(c => !['m017', 'm021'].includes(c.id)) };
    expect(getBalance(dragon, set).label).toBe('標準');
    const overpowered = { ...dragon, frontAttack: 12 };
    expect(getBalance(overpowered, set).label).toBe('強め');
  });

  it('warns when there are not enough kinds of cards for a 40-card deck', () => {
    expect(hasEnoughKinds(BUILTIN_CARD_SET)).toBe(true);
    expect(hasEnoughKinds({ ...BUILTIN_CARD_SET, cards: BUILTIN_CARD_SET.cards.slice(0, 13) })).toBe(false);
  });

  it('requires an effect text for a spell whose effect does not exist yet', () => {
    const spell = createBlankDraft('Spell');
    if (spell.kind !== 'Spell') throw new Error('spell expected');
    const custom: Draft = { kind: 'Spell', card: { ...spell.card, name: '時止め', effect: { kind: 'custom' }, effectText: '' } };
    expect(validateDraft(custom)).toEqual(['まだない効果のスペルは、効果を文章で書いてください。']);
  });

  it('tracks whether the written effect has been implemented', () => {
    const plain = blankMonster({ name: 'A' });
    expect(getImplementationStatus(plain)).toBe('効果なし');
    const withEffect = blankMonster({ name: 'A', effectText: '召喚時に1枚引く。' });
    expect(getImplementationStatus(withEffect)).toBe('未実装');
    const implemented = { ...withEffect.card, implementation: '実装済み' as const };
    expect(getImplementationStatus(withEffect, implemented)).toBe('実装済み');
    const changed = blankMonster({ name: 'A', effectText: '召喚時に2枚引く。' });
    expect(getImplementationStatus(changed, implemented)).toBe('未実装');
  });

  it('builds the card text from the effect and flavor text when saving', () => {
    const saved = finalizeDraft(blankMonster({ name: '剣士', effectText: ' 召喚時に1ダメージ。 ', flavorText: '勇敢な剣士。' }));
    expect(saved.card).toMatchObject({ description: '召喚時に1ダメージ。 勇敢な剣士。', effectText: '召喚時に1ダメージ。', implementation: '未実装' });
  });

  it('opens built-in cards with their text in the right field', () => {
    expect(draftFromCard(dragon).card).toMatchObject({ flavorText: dragon.description, effectText: '' });
    const fire = BUILTIN_CARD_SET.cards.find(c => c.id === 's003')!;
    expect(draftFromCard(fire).card).toMatchObject({ effectText: fire.description, flavorText: '' });
  });
});
