import {
  BUILTIN_CARD_SET,
  clearCardSetCache,
  exportCardSet,
  findBaseCard,
  getCardSet,
  parseCardSet,
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

  it('exports and imports a card set as text', () => {
    expect(parseCardSet(exportCardSet(BUILTIN_CARD_SET))).toEqual(BUILTIN_CARD_SET);
    expect(parseCardSet('{"cards": [], "leaders": []}')).toBeNull(); // 大将がいない
    expect(parseCardSet('not json')).toBeNull();
  });

  it('ignores broken saved data', () => {
    window.localStorage.setItem('cardgame.cards', JSON.stringify({ version: 1, cardSet: { cards: [{ id: 'bad-id' }], leaders: [] } }));
    expect(getCardSet()).toBe(BUILTIN_CARD_SET);
  });
});
