import { Card } from '../types/card';
import { GameState, PlayerId } from '../types/gameState';
import { createInitialGameState } from './initialState';
import {
  attack,
  castSpell,
  endTurn,
  moveMonster,
  nextPhase,
  playCard,
  runAiAttackPhase,
  runAiPlayPhase,
} from './gameLogic';

const monster = (id: string, overrides: Partial<Card> = {}): Card => ({
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

const spell: Card = { id: 's001-0', name: '攻撃の呪文', type: 'Spell', description: '', cost: 1 };

// 両プレイヤーの手札・フィールドを空にした、テスト用の状態を作る
const emptyState = (): GameState => {
  const base = createInitialGameState();
  const clear = (player: PlayerId) => ({
    ...base.players[player],
    hand: [],
    currentEnergy: 5,
    field: { frontRow: [null, null, null], backRow: [null, null, null] },
  });
  return { ...base, phase: 'Play', players: { player1: clear('player1'), player2: clear('player2') } };
};

const withField = (state: GameState, player: PlayerId, row: 'frontRow' | 'backRow', cards: (Card | null)[]): GameState => ({
  ...state,
  players: {
    ...state.players,
    [player]: { ...state.players[player], field: { ...state.players[player].field, [row]: cards } },
  },
});

const unwrap = (result: ReturnType<typeof attack>): GameState => {
  if (!result.ok) throw new Error(result.error);
  return result.state;
};

describe('phase progression', () => {
  it('draws a card and gains energy in the draw phase', () => {
    const state = { ...createInitialGameState(), phase: 'Draw' as const };
    const next = nextPhase(state);
    expect(next.phase).toBe('Play');
    expect(next.players.player1.hand).toHaveLength(6);
    expect(next.players.player1.deck).toHaveLength(34);
    expect(next.players.player1.currentEnergy).toBe(1);
  });

  it('ends the turn and resets turn state', () => {
    const state = unwrap(playCard(
      { ...emptyState(), players: { ...emptyState().players, player1: { ...emptyState().players.player1, hand: [monster('a')] } } },
      'player1', 0, { row: 'frontRow', index: 0 },
    ));
    const next = endTurn(state);
    expect(next.currentPlayer).toBe('player2');
    expect(next.phase).toBe('Draw');
    expect(next.turnState.summonedThisTurnIds).toEqual([]);
  });
});

describe('playCard', () => {
  it('places a monster and spends energy without mutating the original state', () => {
    const base = emptyState();
    const state = { ...base, players: { ...base.players, player1: { ...base.players.player1, hand: [monster('a', { cost: 2 })] } } };
    const next = unwrap(playCard(state, 'player1', 0, { row: 'frontRow', index: 1 }));
    expect(next.players.player1.field.frontRow[1]?.id).toBe('a');
    expect(next.players.player1.currentEnergy).toBe(3);
    expect(state.players.player1.field.frontRow[1]).toBeNull();
  });

  it('refuses to place a spell on the field', () => {
    const base = emptyState();
    const state = { ...base, players: { ...base.players, player1: { ...base.players.player1, hand: [spell] } } };
    expect(playCard(state, 'player1', 0, { row: 'frontRow', index: 0 }).ok).toBe(false);
  });
});

describe('castSpell', () => {
  it('raises the target FA by 1 until the end of the turn', () => {
    const base = withField(emptyState(), 'player1', 'frontRow', [monster('a'), null, null]);
    const state = { ...base, players: { ...base.players, player1: { ...base.players.player1, hand: [spell] } } };
    let next = unwrap(castSpell(state, 'player1', 0, { row: 'frontRow', index: 0 }));
    expect(next.players.player1.graveyard).toContainEqual(spell);

    next = unwrap(attack({ ...next, phase: 'Attack' }, 'player1', { row: 'frontRow', index: 0 }, { type: 'player' }));
    expect(next.players.player2.specialCardHp).toBe(20 - 4);
  });
});

describe('moveMonster', () => {
  it('moves once per turn between rows', () => {
    const state = withField(emptyState(), 'player1', 'frontRow', [monster('a'), monster('b'), null]);
    const next = unwrap(moveMonster(state, 'player1', { row: 'frontRow', index: 0 }, { row: 'backRow', index: 2 }));
    expect(next.players.player1.field.backRow[2]?.id).toBe('a');
    expect(next.players.player1.field.frontRow[0]).toBeNull();
    expect(moveMonster(next, 'player1', { row: 'frontRow', index: 1 }, { row: 'backRow', index: 0 }).ok).toBe(false);
  });
});

describe('attack', () => {
  it('destroys a monster whose HP drops to 0', () => {
    let state = withField(emptyState(), 'player1', 'frontRow', [monster('a', { frontAttack: 5 }), null, null]);
    state = withField(state, 'player2', 'frontRow', [monster('b', { cardHp: 5 }), null, null]);
    const next = unwrap(attack(state, 'player1', { row: 'frontRow', index: 0 }, { type: 'monster', position: { row: 'frontRow', index: 0 } }));
    expect(next.players.player2.field.frontRow[0]).toBeNull();
    expect(next.players.player2.graveyard.map(c => c.id)).toEqual(['b']);
  });

  it('prevents attacking twice, attacking the back row, or direct attacks while the front row is occupied', () => {
    let state = withField(emptyState(), 'player1', 'frontRow', [monster('a', { frontAttack: 1 }), null, null]);
    state = withField(state, 'player2', 'frontRow', [monster('b'), null, null]);
    state = withField(state, 'player2', 'backRow', [monster('c'), null, null]);
    const attacker = { row: 'frontRow' as const, index: 0 };
    expect(attack(state, 'player1', attacker, { type: 'player' }).ok).toBe(false);
    expect(attack(state, 'player1', attacker, { type: 'monster', position: { row: 'backRow', index: 0 } }).ok).toBe(false);
    const next = unwrap(attack(state, 'player1', attacker, { type: 'monster', position: { row: 'frontRow', index: 0 } }));
    expect(attack(next, 'player1', attacker, { type: 'monster', position: { row: 'frontRow', index: 0 } }).ok).toBe(false);
  });

  it('declares a winner when the special card HP reaches 0', () => {
    const state = withField(emptyState(), 'player1', 'frontRow', [monster('a', { frontAttack: 20 }), null, null]);
    const next = unwrap(attack(state, 'player1', { row: 'frontRow', index: 0 }, { type: 'player' }));
    expect(next.winner).toBe('player1');
  });
});

describe('AI', () => {
  it('plays affordable monsters into their preferred row', () => {
    const base = emptyState();
    const state = {
      ...base,
      players: {
        ...base.players,
        player2: { ...base.players.player2, currentEnergy: 2, hand: [spell, monster('front'), monster('back', { frontAttack: 0, backAttack: 4 }), monster('extra')] },
      },
    };
    const next = runAiPlayPhase(state, 'player2');
    expect(next.players.player2.field.frontRow[0]?.id).toBe('front');
    expect(next.players.player2.field.backRow[0]?.id).toBe('back');
    expect(next.players.player2.hand.map(c => c.id)).toEqual(['s001-0', 'extra']);
    expect(next.players.player2.currentEnergy).toBe(0);
  });

  it('attacks with every monster, retargeting after a kill', () => {
    let state = withField(emptyState(), 'player2', 'frontRow', [monster('x', { frontAttack: 5 }), monster('y', { frontAttack: 2 }), null]);
    state = withField(state, 'player1', 'frontRow', [monster('a', { cardHp: 5 }), monster('b', { cardHp: 9 }), null]);
    const next = runAiAttackPhase({ ...state, currentPlayer: 'player2' }, 'player2');
    expect(next.players.player1.field.frontRow[0]).toBeNull();
    expect(next.players.player1.field.frontRow[1]?.cardHp).toBe(7);
  });
});
