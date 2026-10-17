import {
  BUILTIN_CARD_SET,
  clearCardSetCache,
  findBaseCard,
  getCardSet,
  applyChanges,
  diffFromBuiltin,
  mergeById,
  resetCardSet,
  saveCardSet,
} from './cards';

describe('card set storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearCardSetCache();
  });
  afterAll(() => resetCardSet());

  it('uses the built-in cards until something is saved', () => {
    expect(getCardSet()).toBe(BUILTIN_CARD_SET);
  });

  it('applies saved changes immediately and after a reload', () => {
    const changed = { ...BUILTIN_CARD_SET, cards: BUILTIN_CARD_SET.cards.map(c => (c.id === 'm001' ? { ...c, name: '強いゴブリン' } : c)) };
    saveCardSet(changed);
    expect(findBaseCard('m001')?.name).toBe('強いゴブリン');
    clearCardSetCache(); // 再読み込みの代わり
    expect(findBaseCard('m001')?.name).toBe('強いゴブリン');
    resetCardSet();
    expect(findBaseCard('m001')?.name).toBe('ゴブリンアタッカー');
  });

  it('merges cards by id, replacing same ids and appending new ones', () => {
    const merged = mergeById([{ id: 'a', v: 1 }, { id: 'b', v: 1 }], [{ id: 'b', v: 2 }, { id: 'c', v: 2 }]);
    expect(merged).toEqual([{ id: 'a', v: 1 }, { id: 'b', v: 2 }, { id: 'c', v: 2 }]);
  });

  it('ignores broken saved data', () => {
    window.localStorage.setItem('cardgame.cards', JSON.stringify({ version: 1, cardSet: { cards: [{ id: 'bad-id' }], leaders: [] } }));
    expect(getCardSet()).toBe(BUILTIN_CARD_SET);
  });

  it('stores only the differences, so new program cards still appear', () => {
    const custom = { ...BUILTIN_CARD_SET.cards[0], id: 'cnew', name: '新カード' };
    const set = { cards: [...BUILTIN_CARD_SET.cards.filter(c => c.id !== 'm002'), custom], leaders: BUILTIN_CARD_SET.leaders };
    const diff = diffFromBuiltin(set);
    expect(diff.cards.map(c => c.id)).toEqual(['cnew']);
    expect(diff.deleted).toEqual(['m002']);

    const programAdded = { ...BUILTIN_CARD_SET, cards: [...BUILTIN_CARD_SET.cards, { ...custom, id: 'cprog', name: '後から追加' }] };
    const applied = applyChanges(diff, programAdded);
    expect(applied.cards.map(c => c.id)).toEqual(expect.arrayContaining(['cnew', 'cprog']));
    expect(applied.cards.some(c => c.id === 'm002')).toBe(false);
  });

  it('uses the newer version when a card exists both in the browser and in the program', () => {
    const local = { ...BUILTIN_CARD_SET.cards[0], id: 'cx', name: 'ブラウザ版' };
    const program = { ...BUILTIN_CARD_SET, cards: [...BUILTIN_CARD_SET.cards, { ...local, name: '取り込んだ版', updatedAt: '2026-10-17T10:00:00.000Z' }] };
    expect(applyChanges({ cards: [local], leaders: [], deleted: [] }, program).cards.find(c => c.id === 'cx')?.name).toBe('取り込んだ版');
    const newerLocal = { ...local, updatedAt: '2026-10-18T00:00:00.000Z' };
    expect(applyChanges({ cards: [newerLocal], leaders: [], deleted: [] }, program).cards.find(c => c.id === 'cx')?.name).toBe('ブラウザ版');
  });

  it('converts the old whole-set format', () => {
    const custom = { ...BUILTIN_CARD_SET.cards[0], id: 'cold', name: '古い保存' };
    window.localStorage.setItem('cardgame.cards', JSON.stringify({ version: 1, cardSet: { ...BUILTIN_CARD_SET, cards: [...BUILTIN_CARD_SET.cards, custom] } }));
    expect(findBaseCard('cold')?.name).toBe('古い保存');
  });
});
