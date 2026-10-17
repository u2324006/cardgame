import { MonsterCard, SpellCard } from '../types/card';
import { BUILTIN_CARD_SET } from './cards';
import {
  fromMonsterRecord,
  fromSpellRecord,
  imageFromRecord,
  imageToRecord,
  isLeaderRecord,
  isMonsterRecord,
  isSpellRecord,
  parseRecords,
  toLeaderRecord,
  toMonsterRecord,
  toRecords,
  toSpellRecord,
} from './cardData';
import monsters from '../data/cards/monsters.json';
import spells from '../data/cards/spells.json';
import leaders from '../data/cards/leaders.json';

const newMonster: MonsterCard = {
  id: 'cabc123', type: 'Monster', name: '炎の剣士', race: '人間', cost: 2, frontAttack: 6, backAttack: 1, cardHp: 8,
  description: '召喚したとき、相手の前衛に1ダメージ。 燃える剣で前線を切り開く。',
  effectText: '召喚したとき、相手の前衛に1ダメージ。', flavorText: '燃える剣で前線を切り開く。',
  illustrationPrompt: '炎をまとった剣を構える若い剣士', implementation: '未実装', memo: '',
  image: '/images/cards/warrior.svg',
};

const customSpell: SpellCard = {
  id: 'cspell1', type: 'Spell', name: '時止め', race: 'スペル', cost: 3, effect: { kind: 'custom' }, target: 'none',
  description: '相手は次のターン攻撃できない。', effectText: '相手は次のターン攻撃できない。', flavorText: '',
  illustrationPrompt: '砂時計が光っている', implementation: '未実装', memo: 'バランス注意', summary: '効果未実装',
};

describe('card records (JSON for AI)', () => {
  it('writes a monster with the agreed fields', () => {
    expect(toMonsterRecord(newMonster)).toEqual({
      id: 'cabc123',
      name: '炎の剣士',
      race: '人間',
      cost: 2,
      frontAttack: 6,
      backAttack: 1,
      hp: 8,
      effectText: '召喚したとき、相手の前衛に1ダメージ。',
      flavorText: '燃える剣で前線を切り開く。',
      illustration: { prompt: '炎をまとった剣を構える若い剣士', image: 'warrior.svg' },
      implementation: '未実装',
      memo: '',
    });
  });

  it('writes an unimplemented spell with its target and no effect', () => {
    expect(toSpellRecord(customSpell)).toMatchObject({ target: 'none', effect: null, implementation: '未実装' });
  });

  it('round-trips monsters and spells', () => {
    const monster = fromMonsterRecord(toMonsterRecord(newMonster));
    expect(monster).toMatchObject({ name: '炎の剣士', cardHp: 8, effectText: newMonster.effectText, description: newMonster.description });
    expect(monster.image).toContain('/images/cards/warrior.svg');
    expect(fromSpellRecord(toSpellRecord(customSpell))).toMatchObject({ effect: { kind: 'custom' }, target: 'none', summary: '効果未実装' });
  });

  it('describes built-in cards without notes sensibly', () => {
    const fire = BUILTIN_CARD_SET.cards.find(c => c.id === 's003') as SpellCard;
    expect(toSpellRecord(fire)).toMatchObject({ effectText: '相手のモンスター1体に3ダメージを与える。', target: 'enemyMonster', effect: { kind: 'damage', amount: 3 }, implementation: '実装済み' });
    expect(toLeaderRecord(BUILTIN_CARD_SET.leaders[0])).toMatchObject({ maxHp: 20, implementation: '効果なし' });
  });

  it('keeps uploaded images as data URLs and built-in images as file names', () => {
    expect(imageToRecord('data:image/jpeg;base64,xx')).toBe('data:image/jpeg;base64,xx');
    expect(imageToRecord(undefined)).toBe('');
    expect(imageFromRecord('')).toBeUndefined();
    expect(imageFromRecord('dragon.svg')).toContain('/images/cards/dragon.svg');
  });

  it('parses one category or all categories, and rejects anything else', () => {
    const all = toRecords([newMonster, customSpell], BUILTIN_CARD_SET.leaders);
    expect(parseRecords(JSON.stringify(all.monsters))?.monsters).toHaveLength(1);
    const parsed = parseRecords(JSON.stringify(all));
    expect([parsed?.monsters.length, parsed?.spells.length, parsed?.leaders.length]).toEqual([1, 1, 1]);
    expect(parseRecords('[{"id": "x"}]')).toBeNull();
    expect(parseRecords('[]')).toBeNull();
    expect(parseRecords('oops')).toBeNull();
  });

  it('keeps the card data files in the repository valid', () => {
    expect((monsters as unknown[]).every(isMonsterRecord)).toBe(true);
    expect((spells as unknown[]).every(isSpellRecord)).toBe(true);
    expect((leaders as unknown[]).every(isLeaderRecord)).toBe(true);
  });
});
