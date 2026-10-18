import { GameState, Phase } from '../types/gameState';
import { runAiAttackPhase, runAiPlayPhase } from './ai';
import { backSpell, disableSpell, drawSpell, emptyState, fireSpell, healSpell, inPhase, monster, spell, withField, withGolemLeader, withPlayer } from './testUtils';

const aiTurn = (state: GameState, phase: Phase = 'Play'): GameState => inPhase(state, phase, 'player2');

describe('AI play phase', () => {
  it('summons the strongest affordable monsters into their preferred row', () => {
    const state = withPlayer(aiTurn(emptyState()), 'player2', {
      currentEnergy: 3,
      hand: [
        monster('weak', { frontAttack: 1, cardHp: 2 }),
        monster('big', { frontAttack: 5, cardHp: 9, cost: 2 }),
        monster('back', { frontAttack: 0, backAttack: 4 }),
        monster('pricey', { frontAttack: 9, cost: 4 }),
      ],
    });
    const next = runAiPlayPhase(state, 'player2');
    expect(next.players.player2.field.frontRow[0]?.id).toBe('big');
    expect(next.players.player2.field.backRow[0]?.id).toBe('back');
    expect(next.players.player2.hand.map(c => c.id)).toEqual(['weak', 'pricey']);
    expect(next.players.player2.currentEnergy).toBe(0);
  });

  it('falls back to the other row when the preferred row is full', () => {
    let state = withField(aiTurn(emptyState()), 'player2', 'frontRow', [monster('a'), monster('b'), monster('c')]);
    state = withPlayer(state, 'player2', { currentEnergy: 1, hand: [monster('d', { frontAttack: 3, backAttack: 1 })] });
    const next = runAiPlayPhase(state, 'player2');
    expect(next.players.player2.field.backRow[0]?.id).toBe('d');
  });

  it('does not summon into a row where the monster has no attack', () => {
    let state = withField(aiTurn(emptyState()), 'player2', 'frontRow', [monster('a'), monster('b'), monster('c')]);
    state = withPlayer(state, 'player2', { currentEnergy: 1, hand: [monster('d', { frontAttack: 3, backAttack: 0 })] });
    expect(runAiPlayPhase(state, 'player2').players.player2.hand.map(c => c.id)).toEqual(['d']);
  });

  it('moves a monster to the row where it attacks harder', () => {
    const state = withField(aiTurn(emptyState()), 'player2', 'frontRow', [monster('mage', { frontAttack: 0, backAttack: 5 }), null, null]);
    const next = runAiPlayPhase(state, 'player2');
    expect(next.players.player2.field.backRow[0]?.id).toBe('mage');
    expect(next.turnState.movedMonsterId).toBe('mage');
  });

  it('casts the attack spell only when the +1 enables a kill', () => {
    let state = withField(aiTurn(emptyState()), 'player2', 'frontRow', [monster('x', { frontAttack: 3 }), null, null]);
    state = withPlayer(state, 'player2', { currentEnergy: 1, hand: [spell] });

    const noKill = withField(state, 'player1', 'frontRow', [monster('a', { cardHp: 9 }), null, null]);
    expect(runAiPlayPhase(noKill, 'player2').players.player2.hand).toHaveLength(1);

    const kill = withField(state, 'player1', 'frontRow', [monster('a', { cardHp: 4 }), null, null]);
    const next = runAiPlayPhase(kill, 'player2');
    expect(next.players.player2.hand).toHaveLength(0);
    expect(next.turnState.attackBuffs['x']).toBe(1);
  });
});

describe('AI spells', () => {
  it('uses the fire spell only when it can destroy a monster', () => {
    let state = withPlayer(aiTurn(emptyState()), 'player2', { currentEnergy: 2, hand: [fireSpell] });
    const tough = withField(state, 'player1', 'frontRow', [monster('a', { cardHp: 9 }), null, null]);
    expect(runAiPlayPhase(tough, 'player2').players.player2.hand).toHaveLength(1);

    state = withField(state, 'player1', 'backRow', [monster('weak', { cardHp: 2 }), null, null]);
    const next = runAiPlayPhase(state, 'player2');
    expect(next.players.player1.field.backRow[0]).toBeNull();
  });

  it('heals a damaged ally', () => {
    let state = withField(aiTurn(emptyState()), 'player2', 'frontRow', [{ ...monster('m002-0'), cardHp: 7 }, null, null]);
    state = withPlayer(state, 'player2', { currentEnergy: 1, hand: [healSpell] });
    expect(runAiPlayPhase(state, 'player2').players.player2.field.frontRow[0]?.cardHp).toBe(10);
  });
});

describe('AI with unimplemented spells', () => {
  it('keeps them in hand', () => {
    const custom = { ...spell, id: 'cx-0', effect: { kind: 'custom' as const }, target: 'enemyMonster' as const };
    let state = withPlayer(aiTurn(emptyState()), 'player2', { currentEnergy: 5, hand: [custom] });
    state = withField(state, 'player1', 'frontRow', [monster('a', { cardHp: 1 }), null, null]);
    expect(runAiPlayPhase(state, 'player2').players.player2.hand).toHaveLength(1);
  });
});

describe('AI with draw-then-discard spells', () => {
  it('casts it when the deck has enough cards and discards unusable cards first', () => {
    const custom = { ...spell, id: 'cx-0', effect: { kind: 'custom' as const } };
    const state = withPlayer(aiTurn(emptyState()), 'player2', {
      currentEnergy: 1,
      hand: [drawSpell, custom, monster('strong', { frontAttack: 6, cardHp: 12, cost: 9 })],
      deck: [monster('weak', { frontAttack: 0, backAttack: 0, cardHp: 1, cost: 9 }), monster('ok', { cost: 9 }), monster('rest')],
    });
    const next = runAiPlayPhase(state, 'player2');
    expect(next.pendingDiscard).toBeNull();
    expect(next.players.player2.hand.map(c => c.id).sort()).toEqual(['ok', 'strong']);
    expect(next.players.player2.graveyard.map(c => c.id)).toEqual(expect.arrayContaining([drawSpell.id, 'cx-0', 'weak']));
  });

  it('keeps it when the deck is too small', () => {
    const state = withPlayer(aiTurn(emptyState()), 'player2', { currentEnergy: 1, hand: [drawSpell], deck: [monster('only')] });
    expect(runAiPlayPhase(state, 'player2').players.player2.hand.map(c => c.id)).toEqual([drawSpell.id]);
  });
});

describe('AI attack phase', () => {
  it('kills the most valuable monster it can and chips the rest', () => {
    let state = withField(aiTurn(emptyState(), 'Attack'), 'player2', 'frontRow', [monster('x', { frontAttack: 5 }), monster('y', { frontAttack: 2 }), null]);
    state = withField(state, 'player1', 'frontRow', [
      monster('weak', { frontAttack: 1, cardHp: 3 }),
      monster('strong', { frontAttack: 6, cardHp: 5 }),
      monster('tank', { cardHp: 20 }),
    ]);
    const next = runAiAttackPhase(state, 'player2');
    const front = next.players.player1.field.frontRow;
    expect(front[1]).toBeNull(); // x(5) が strong を倒す
    expect(front[0]?.cardHp).toBe(1); // y(2) は倒せないので一番HPの低い weak を削る
    expect(front[2]?.cardHp).toBe(20);
  });

  it('uses the attacker with the least overkill and attacks directly once the front row is clear', () => {
    let state = withField(aiTurn(emptyState(), 'Attack'), 'player2', 'frontRow', [monster('big', { frontAttack: 9 }), monster('small', { frontAttack: 3 }), null]);
    state = withField(state, 'player1', 'frontRow', [monster('a', { cardHp: 3 }), null, null]);
    const next = runAiAttackPhase(state, 'player2');
    expect(next.players.player1.field.frontRow[0]).toBeNull();
    expect(next.players.player1.specialCardHp).toBe(20 - 9);
  });

  it('attacks the special card with front-row monsters and the back row with back-row monsters', () => {
    let state = withField(aiTurn(emptyState(), 'Attack'), 'player2', 'frontRow', [monster('x', { frontAttack: 4 }), null, null]);
    state = withField(state, 'player2', 'backRow', [monster('y', { backAttack: 2 }), null, null]);
    state = withField(state, 'player1', 'backRow', [monster('b'), null, null]);
    const next = runAiAttackPhase(state, 'player2');
    expect(next.players.player1.specialCardHp).toBe(20 - 4); // 後衛の y は大将を攻撃できない
    expect(next.players.player1.field.backRow[0]?.cardHp).toBe(5 - 2);
  });

  it('does not attack with the back row when nothing but the special card is left', () => {
    const state = withField(aiTurn(emptyState(), 'Attack'), 'player2', 'backRow', [monster('y', { backAttack: 2 }), null, null]);
    const next = runAiAttackPhase(state, 'player2');
    expect(next.players.player1.specialCardHp).toBe(20);
    expect(next.turnState.attackedMonsterIds).toEqual([]);
  });
});

describe('AI with leader-related spells', () => {
  it('casts 指揮低下 only when the opponent leader is boosting a monster', () => {
    let state = withPlayer(aiTurn(emptyState()), 'player2', { currentEnergy: 1, hand: [disableSpell] });
    state = withField(state, 'player1', 'frontRow', [monster('g', { race: 'ゴーレム', cardHp: 0 }), null, null]);
    expect(runAiPlayPhase(state, 'player2').players.player2.hand).toHaveLength(1);
    const next = runAiPlayPhase(withGolemLeader(state, 'player1'), 'player2');
    expect(next.players.player2.hand).toHaveLength(0);
    expect(next.players.player1.field.frontRow[0]).toBeNull();
  });

  it('casts 後衛支援 on a back-row attacker', () => {
    let state = withPlayer(aiTurn(emptyState()), 'player2', { currentEnergy: 1, hand: [backSpell] });
    state = withField(state, 'player2', 'backRow', [monster('archer', { frontAttack: 0, backAttack: 3 }), null, null]);
    const next = runAiPlayPhase(state, 'player2');
    expect(next.turnState.backAttackBuffs).toEqual({ archer: 1 });
  });
});

