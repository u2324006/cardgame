import { MonsterCard, SpellCard } from '../types/card';
import { GameState, Phase, PlayerId, PlayerState } from '../types/gameState';
import { ActionResult } from './gameLogic';
import { createInitialGameState } from './initialState';

// テスト用のカード・盤面を作るヘルパー

export const monster = (id: string, overrides: Partial<MonsterCard> = {}): MonsterCard => ({
  id,
  name: id,
  type: 'Monster',
  description: '',
  frontAttack: 3,
  backAttack: 1,
  cardHp: 5,
  cost: 1,
  ...overrides,
});

export const spell: SpellCard = {
  id: 's001-0', name: '攻撃の呪文', type: 'Spell', description: '', cost: 1, effect: { kind: 'buffFa', amount: 1 },
};
export const healSpell: SpellCard = {
  id: 's002-0', name: '回復の呪文', type: 'Spell', description: '', cost: 1, effect: { kind: 'heal', amount: 3 },
};
export const drawSpell: SpellCard = {
  id: 'cmvcejw05kll9-0', name: '恵の泉', type: 'Spell', description: '', cost: 1, effect: { kind: 'drawDiscard', amount: 2 },
};
export const fireSpell: SpellCard = {
  id: 's003-0', name: '炎の呪文', type: 'Spell', description: '', cost: 2, effect: { kind: 'damage', amount: 3 },
};

export const backSpell: SpellCard = {
  id: 'cmvcf6svl19jp-0', name: '後衛支援', type: 'Spell', description: '', cost: 1, effect: { kind: 'buffBa', amount: 1 }, target: 'allyMonster',
};
export const disableSpell: SpellCard = {
  id: 'cmvcf4e4u3szf-0', name: '指揮低下', type: 'Spell', description: '', cost: 1, effect: { kind: 'disableLeader', amount: 1 }, target: 'enemyLeader',
};

export const throwSpell: SpellCard = {
  id: 'cmvdecarqav9w-0', name: '投擲', type: 'Spell', description: '', cost: 1, effect: { kind: 'damageBack', amount: 3 },
};
export const forceMoveSpell: SpellCard = {
  id: 'cmvdedg1ew8k5-0', name: '強制移動', type: 'Spell', description: '', cost: 1, effect: { kind: 'forceMove', amount: 1 },
};
export const catchUpSpell: SpellCard = {
  id: 'cmvde4e0w32ku-0', name: '逆転の兆し', type: 'Spell', description: '', cost: 1, effect: { kind: 'catchUpEnergy', amount: 1 },
};
// 召喚したとき、コスト1以下のスペルをコストなしで使える（見習い魔導士）
export const apprentice = (id = 'cmvde9cnvtqso-0'): MonsterCard => ({
  ...monster(id, { name: '見習い魔導士', frontAttack: 0, backAttack: 1, cardHp: 3 }),
  ability: { kind: 'freeSpellOnSummon', maxCost: 1 },
});

// HP 10 以下で1回だけエネルギーを3増やす大将（大将）を持たせる
export const withRallyLeader = (state: GameState, player: PlayerId): GameState => ({
  ...state,
  players: {
    ...state.players,
    [player]: {
      ...state.players[player],
      leader: { ...state.players[player].leader, ability: { kind: 'rallyEnergy', hpThreshold: 10, amount: 3 } },
    },
  },
});

// 種族ゴーレムの HP を +1 する大将（マウンテンゴーレム）を持たせる
export const withGolemLeader = (state: GameState, player: PlayerId): GameState => ({
  ...state,
  players: {
    ...state.players,
    [player]: {
      ...state.players[player],
      leader: { ...state.players[player].leader, ability: { kind: 'raceHpBonus', race: 'ゴーレム', amount: 1 } },
    },
  },
});

// 両プレイヤーの手札・フィールドを空にした、テスト用の状態を作る（先手1ターン目の制限がかからないよう3ターン目）
export const emptyState = (): GameState => {
  const base = createInitialGameState();
  const clear = (player: PlayerId) => ({
    ...base.players[player],
    hand: [],
    currentEnergy: 5,
    field: { frontRow: [null, null, null], backRow: [null, null, null] },
  });
  return { ...base, turn: 3, phase: 'Play', players: { player1: clear('player1'), player2: clear('player2') } };
};

export const withField = (state: GameState, player: PlayerId, row: 'frontRow' | 'backRow', cards: (MonsterCard | null)[]): GameState => ({
  ...state,
  players: {
    ...state.players,
    [player]: { ...state.players[player], field: { ...state.players[player].field, [row]: cards } },
  },
});

export const withPlayer = (state: GameState, player: PlayerId, changes: Partial<PlayerState>): GameState => ({
  ...state,
  players: { ...state.players, [player]: { ...state.players[player], ...changes } },
});

export const unwrap = (result: ActionResult): GameState => {
  if (!result.ok) throw new Error(result.error);
  return result.state;
};

// 指定プレイヤーのターンの指定フェイズにする
export const inPhase = (state: GameState, phase: Phase, player: PlayerId = 'player1'): GameState => ({
  ...state,
  phase,
  currentPlayer: player,
});
