import { LeaderCard, MonsterCard, SpellCard } from '../types/card';

// 最初から入っているカードのデータ。
// カード作成画面で変更・追加したカードは cards.ts がこれと合わせて管理する。

// public/images/cards/ に置いたイラストの URL
export const cardImage = (fileName: string): string => `${process.env.PUBLIC_URL}/images/cards/${fileName}`;

const monster = (card: Omit<MonsterCard, 'type'>): MonsterCard => ({ type: 'Monster', ...card });
const spell = (card: Omit<SpellCard, 'type' | 'race'>): SpellCard => ({ type: 'Spell', race: 'スペル', ...card });

export const BUILTIN_MONSTER_CARDS: MonsterCard[] = [
  monster({
    id: 'm001', name: 'ゴブリンアタッカー', image: cardImage('goblin.svg'), race: 'ゴブリン',
    cost: 1, frontAttack: 2, backAttack: 2, cardHp: 6,
    description: '前衛でも後衛でも同じ力で戦える、身軽なゴブリン。',
  }),
  monster({
    id: 'm002', name: 'ストーンゴーレム', image: cardImage('stone-golem.svg'), race: 'ゴーレム',
    cost: 2, frontAttack: 3, backAttack: 0, cardHp: 13,
    description: '岩の体で攻撃を受け止める。後衛では攻撃できない。',
  }),
  monster({
    id: 'm003', name: 'プテ', image: cardImage('pute.svg'), race: 'ゴーレム',
    cost: 1, frontAttack: 4, backAttack: 0, cardHp: 5,
    description: '前衛で鋭く攻める。後衛では攻撃できない。',
  }),
  monster({
    id: 'm004', name: 'ハンター', image: cardImage('hunter.svg'), race: 'ゴーレム',
    cost: 1, frontAttack: 0, backAttack: 4, cardHp: 3,
    description: '後衛から獲物を狙い撃つ。前衛では攻撃できない。',
  }),
  monster({
    id: 'm005', name: '戦士', image: cardImage('warrior.svg'), race: 'ゴーレム',
    cost: 2, frontAttack: 5, backAttack: 0, cardHp: 7,
    description: '前衛で力を発揮する。後衛では攻撃できない。',
  }),
  monster({
    id: 'm006', name: '魔術師', image: cardImage('mage.svg'), race: 'ゴーレム',
    cost: 2, frontAttack: 0, backAttack: 5, cardHp: 6,
    description: '後衛から強力な魔術を放つ。前衛では攻撃できない。',
  }),
  monster({
    id: 'm007', name: 'バラン', image: cardImage('baran.svg'), race: 'ゴーレム',
    cost: 2, frontAttack: 3, backAttack: 3, cardHp: 9,
    description: '前衛でも後衛でも安定して戦える。',
  }),
  // --- 以下は仮のカード（デッキ40枚・同名3枚までを満たすために追加。差し替え可） ---
  monster({
    id: 'm008', name: 'スライム', image: cardImage('slime.svg'), race: 'スライム',
    cost: 1, frontAttack: 1, backAttack: 1, cardHp: 4,
    description: 'どこにでもいる小さなモンスター。どちらの列でも少しだけ戦える。',
  }),
  monster({
    id: 'm009', name: '妖精', image: cardImage('fairy.svg'), race: '妖精',
    cost: 1, frontAttack: 0, backAttack: 3, cardHp: 2,
    description: '後衛から光の矢を放つ。体はとても弱い。',
  }),
  monster({
    id: 'm010', name: 'オーク兵', image: cardImage('orc.svg'), race: 'オーク',
    cost: 2, frontAttack: 4, backAttack: 1, cardHp: 8,
    description: '前衛で斧を振るう荒くれ者。',
  }),
  monster({
    id: 'm011', name: '騎士', image: cardImage('knight.svg'), race: '人間',
    cost: 3, frontAttack: 5, backAttack: 2, cardHp: 14,
    description: '重い鎧で前線を守り抜く。',
  }),
  monster({
    id: 'm012', name: 'ドラゴン', image: cardImage('dragon.svg'), race: 'ドラゴン',
    cost: 3, frontAttack: 6, backAttack: 4, cardHp: 12,
    description: '前衛でも後衛でも強力な、竜の王。',
  }),
];

export const BUILTIN_SPELL_CARDS: SpellCard[] = [
  spell({
    id: 's001', name: '攻撃の呪文', image: cardImage('attack-spell.svg'),
    cost: 1, effect: { kind: 'buffFa', amount: 1 }, summary: 'FA +1',
    description: '味方モンスター1体のFAを、ターン終了まで1上げる。',
  }),
  // --- 以下は仮のカード ---
  spell({
    id: 's002', name: '回復の呪文', image: cardImage('heal-spell.svg'),
    cost: 1, effect: { kind: 'heal', amount: 3 }, summary: 'HP +3',
    description: '味方モンスター1体のHPを3回復する（最大HPまで）。',
  }),
  spell({
    id: 's003', name: '炎の呪文', image: cardImage('fire-spell.svg'),
    cost: 2, effect: { kind: 'damage', amount: 3 }, summary: '3ダメージ',
    description: '相手のモンスター1体に3ダメージを与える。',
  }),
];



// 大将カード（今は1種類。効果は今後追加予定）
export const BUILTIN_LEADER_CARDS: LeaderCard[] = [
  {
    id: 'l001',
    name: '大将',
    image: cardImage('leader.svg'),
    description: '大将固有の効果は未設定です。',
    maxHp: 42,
  },
];

// 選べるイラスト（public/images/cards/ のファイル）
export const BUILTIN_IMAGES = [
  'goblin.svg', 'stone-golem.svg', 'pute.svg', 'hunter.svg', 'warrior.svg', 'mage.svg', 'baran.svg',
  'slime.svg', 'fairy.svg', 'orc.svg', 'knight.svg', 'dragon.svg',
  'attack-spell.svg', 'heal-spell.svg', 'fire-spell.svg', 'blessing-spring.svg', 'leader.svg',
].map(fileName => ({ fileName, url: cardImage(fileName) }));
