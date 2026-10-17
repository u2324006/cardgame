import { Card, MonsterCard, SpellCard } from '../types/card';

// デッキに入るカードの元データ。デッキ作成時に `${id}-${番号}` の形で個別IDが振られる。
export const ATTACK_SPELL_ID = 's001';

const monsterCard1: MonsterCard = {
  id: 'm001',
  name: 'ゴブリンアタッカー',
  type: 'Monster',
  description: '前衛でも後衛でも同じ力で戦える、身軽なゴブリン。',
  frontAttack: 2,
  backAttack: 2,
  cardHp: 6,
  race: 'ゴブリン',
  cost: 1,
};

const monsterCard2: MonsterCard = {
  id: 'm002',
  name: 'ストーンゴーレム',
  type: 'Monster',
  description: '岩の体で攻撃を受け止める。後衛では攻撃できない。',
  frontAttack: 3,
  backAttack: 0,
  cardHp: 13,
  race: 'ゴーレム',
  cost: 2,
};

const monsterCard3: MonsterCard = {
  id: 'm003',
  name: 'プテ',
  type: 'Monster',
  description: '前衛で鋭く攻める。後衛では攻撃できない。',
  frontAttack: 4,
  backAttack: 0,
  cardHp: 5,
  race: 'ゴーレム',
  cost: 1,
};

const monsterCard4: MonsterCard = {
  id: 'm004',
  name: 'ハンター',
  type: 'Monster',
  description: '後衛から獲物を狙い撃つ。前衛では攻撃できない。',
  frontAttack: 0,
  backAttack: 4,
  cardHp: 3,
  race: 'ゴーレム',
  cost: 1,
};

const monsterCard5: MonsterCard = {
  id: 'm005',
  name: '戦士',
  type: 'Monster',
  description: '前衛で力を発揮する。後衛では攻撃できない。',
  frontAttack: 5,
  backAttack: 0,
  cardHp: 7,
  race: 'ゴーレム',
  cost: 2,
};

const monsterCard6: MonsterCard = {
  id: 'm006',
  name: '魔術師',
  type: 'Monster',
  description: '後衛から強力な魔術を放つ。前衛では攻撃できない。',
  frontAttack: 0,
  backAttack: 5,
  cardHp: 6,
  race: 'ゴーレム',
  cost: 2,
};

const monsterCard7: MonsterCard = {
  id: 'm007',
  name: 'バラン',
  type: 'Monster',
  description: '前衛でも後衛でも安定して戦える。',
  frontAttack: 3,
  backAttack: 3,
  cardHp: 9,
  race: 'ゴーレム',
  cost: 2,
};

const attackSpell: SpellCard = {
  id: ATTACK_SPELL_ID,
  name: '攻撃の呪文',
  type: 'Spell',
  description: '味方モンスター1体のFAを、ターン終了まで1上げる。',
  race: 'スペル',
  cost: 1,
};

export const BASE_CARDS: Card[] = [monsterCard1, monsterCard2, monsterCard3, monsterCard4, monsterCard5, monsterCard6, monsterCard7, attackSpell];

// 個別IDから元カードのIDを取り出す（例: 's001-12' → 's001'）
export const getBaseCardId = (card: Card): string => card.id.split('-')[0];

// ダメージなどで変化したカードを、個別IDはそのままに元の能力値へ戻す（墓地へ送るときに使う）
export const toOriginalCard = <T extends Card>(card: T): T => {
  const base = BASE_CARDS.find(c => c.id === getBaseCardId(card));
  return base ? ({ ...base, id: card.id } as T) : card;
};
