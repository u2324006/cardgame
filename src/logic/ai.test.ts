import { GameState } from '../types/gameState';
import { runAiAttackPhase, runAiPlayPhase } from './ai';
import { emptyState, monster, spell, withField, withPlayer } from './testUtils';

const aiTurn = (state: GameState): GameState => ({ ...state, currentPlayer: 'player2' });

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
    expect(next.turnState.hasMoved).toBe(true);
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

describe('AI attack phase', () => {
  it('kills the most valuable monster it can and chips the rest', () => {
    let state = withField(aiTurn(emptyState()), 'player2', 'frontRow', [monster('x', { frontAttack: 5 }), monster('y', { frontAttack: 2 }), null]);
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
    let state = withField(aiTurn(emptyState()), 'player2', 'frontRow', [monster('big', { frontAttack: 9 }), monster('small', { frontAttack: 3 }), null]);
    state = withField(state, 'player1', 'frontRow', [monster('a', { cardHp: 3 }), null, null]);
    const next = runAiAttackPhase(state, 'player2');
    expect(next.players.player1.field.frontRow[0]).toBeNull();
    expect(next.players.player1.specialCardHp).toBe(20 - 9);
  });

  it('attacks the special card directly with every monster when the front row is empty', () => {
    let state = withField(aiTurn(emptyState()), 'player2', 'frontRow', [monster('x', { frontAttack: 4 }), null, null]);
    state = withField(state, 'player2', 'backRow', [monster('y', { backAttack: 2 }), null, null]);
    state = withField(state, 'player1', 'backRow', [monster('b'), null, null]);
    const next = runAiAttackPhase(state, 'player2');
    expect(next.players.player1.specialCardHp).toBe(20 - 6);
  });
});
