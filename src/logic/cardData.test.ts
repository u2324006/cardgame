import { MonsterCard, SpellCard } from '../types/card';
import { BUILTIN_CARD_SET } from './cards';
import { BUILTIN_LEADER_CARDS } from './builtinCards';
import {
  fromLeaderRecord,
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
    expect(toSpellRecord(fire)).toMatchObject({ effectText: '相手のモンスター1体に6ダメージを与える。', target: 'enemyMonster', effect: { kind: 'damage', amount: 6 }, implementation: '実装済み' });
    expect(toLeaderRecord(BUILTIN_LEADER_CARDS[0])).toMatchObject({ maxHp: 42, implementation: '効果なし' });
  });

  it('keeps uploaded images as data URLs and built-in images as file names', () => {
    expect(imageToRecord('data:image/jpeg;base64,xx')).toBe('data:image/jpeg;base64,xx');
    expect(imageToRecord(undefined)).toBe('');
    expect(imageFromRecord('')).toBeUndefined();
    expect(imageFromRecord('dragon.svg')).toContain('/images/cards/dragon.svg');
  });

  it('parses one category or all categories, and rejects anything else', () => {
    const all = toRecords([newMonster, customSpell], BUILTIN_CARD_SET.leaders.slice(0, 1));
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

  it('loads 恵の泉 from spells.json as an implemented spell', () => {
    const spring = BUILTIN_CARD_SET.cards.find(c => c.id === 'cmvcejw05kll9') as SpellCard;
    expect(spring).toMatchObject({ name: '恵の泉', cost: 2, effect: { kind: 'drawDiscard', amount: 2 }, implementation: '実装済み' });
    expect(spring.image).toContain('/images/cards/blessing-spring.svg');
  });

  it('loads the imported spells, races and leader with their effects', () => {
    const find = (id: string) => BUILTIN_CARD_SET.cards.find(c => c.id === id);
    expect(find('s001')).toMatchObject({ name: '前衛支援', effect: { kind: 'buffFa', amount: 1 } });
    expect(find('s003')).toMatchObject({ cost: 1, effect: { kind: 'damage', amount: 6 } });
    expect(find('cmvcf4e4u3szf')).toMatchObject({ name: '指揮低下', effect: { kind: 'disableLeader', amount: 1 } });
    expect(find('cmvcf6svl19jp')).toMatchObject({ name: '後衛支援', effect: { kind: 'buffBa', amount: 1 } });
    expect([find('m003')?.race, find('m011')?.race]).toEqual(['恐竜', '戦士']);
    const golem = BUILTIN_CARD_SET.leaders.find(l => l.id === 'lmvcf1jj9pvni');
    expect(golem).toMatchObject({ maxHp: 45, ability: { kind: 'raceHpBonus', race: 'ゴーレム', amount: 3 } });
  });

  it('round-trips a leader effect', () => {
    const golem = BUILTIN_CARD_SET.leaders.find(l => l.id === 'lmvcf1jj9pvni')!;
    const record = toLeaderRecord(golem);
    expect(record.effect).toEqual({ kind: 'raceHpBonus', race: 'ゴーレム', amount: 3 });
    expect(isLeaderRecord({ ...record, effect: { kind: 'raceHpBonus', race: 'ゴーレム' } })).toBe(false);
    expect(fromLeaderRecord(record).ability).toEqual(record.effect);
  });

  it('loads the second batch: summon effect, new spells and the leader ability', () => {
    const find = (id: string) => BUILTIN_CARD_SET.cards.find(c => c.id === id);
    expect(find('cmvde9cnvtqso')).toMatchObject({ name: '見習い魔導士', ability: { kind: 'freeSpellOnSummon', maxCost: 1 } });
    expect(find('cmvde4e0w32ku')).toMatchObject({ effect: { kind: 'catchUpEnergy' } });
    expect(find('cmvdecarqav9w')).toMatchObject({ effect: { kind: 'damageBack', amount: 6 } });
    expect(find('cmvdedg1ew8k5')).toMatchObject({ effect: { kind: 'forceMove' } });
    const leader = BUILTIN_CARD_SET.leaders.find(l => l.id === 'l001');
    expect(leader).toMatchObject({ ability: { kind: 'rallyEnergy', hpRatio: 0.5, amount: 3 } });
    const record = toMonsterRecord(find('cmvde9cnvtqso') as MonsterCard);
    expect(record.effect).toEqual({ kind: 'freeSpellOnSummon', maxCost: 1 });
    expect(isMonsterRecord({ ...record, effect: { kind: 'freeSpellOnSummon' } })).toBe(false);
    expect(fromMonsterRecord(record).ability).toEqual(record.effect);
  });
});
