import { Card, MonsterCard, SpellCard } from '../types/card';

// デッキに入るカードの元データ。デッキ作成時に `${id}-${番号}` の形で個別IDが振られる。
export const ATTACK_SPELL_ID = 's001';

const monsterCard1: MonsterCard = {
  id: 'm001',
  name: 'Goblin Attacker',
  type: 'Monster',
  description: 'A standard goblin warrior.',
  frontAttack: 2,
  backAttack: 2,
  cardHp: 6,
  race: 'Goblin',
  cost: 1,
};

const monsterCard2: MonsterCard = {
  id: 'm002',
  name: 'Stone Golem',
  type: 'Monster',
  description: 'A creature made of living rock.',
  frontAttack: 3,
  backAttack: 0,
  cardHp: 13,
  race: 'Golem',
  cost: 2,
};

const monsterCard3: MonsterCard = {
  id: 'm003',
  name: 'pute',
  type: 'Monster',
  description: 'A creature made of living rock.',
  frontAttack: 4,
  backAttack: 0,
  cardHp: 5,
  race: 'Golem',
  cost: 1,
};

const monsterCard4: MonsterCard = {
  id: 'm004',
  name: 'hanta-',
  type: 'Monster',
  description: 'A creature made of living rock.',
  frontAttack: 0,
  backAttack: 4,
  cardHp: 3,
  race: 'Golem',
  cost: 1,
};

const monsterCard5: MonsterCard = {
  id: 'm005',
  name: 'sennsi',
  type: 'Monster',
  description: 'A creature made of living rock.',
  frontAttack: 5,
  backAttack: 0,
  cardHp: 7,
  race: 'Golem',
  cost: 2,
};

const monsterCard6: MonsterCard = {
  id: 'm006',
  name: 'majutu',
  type: 'Monster',
  description: 'A creature made of living rock.',
  frontAttack: 0,
  backAttack: 5,
  cardHp: 6,
  race: 'Golem',
  cost: 2,
};

const monsterCard7: MonsterCard = {
  id: 'm007',
  name: 'baran',
  type: 'Monster',
  description: 'A creature made of living rock.',
  frontAttack: 3,
  backAttack: 3,
  cardHp: 9,
  race: 'Golem',
  cost: 2,
};

const attackSpell: SpellCard = {
  id: ATTACK_SPELL_ID,
  name: '攻撃の呪文',
  type: 'Spell',
  description: '味方モンスター1体のFAを、ターン終了まで1上げる。',
  race: 'Spell',
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
