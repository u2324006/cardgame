import { Card } from '../types/card';
import { GameState } from '../types/gameState';
import { createInitialGameState } from './initialState';
import {
  attack,
  castSpell,
  discardCards,
  endTurn,
  moveMonster,
  nextPhase,
  playCard,
} from './gameLogic';
import { drawSpell, emptyState, fireSpell, healSpell, inPhase, monster, spell, unwrap, withField, withPlayer } from './testUtils';

describe('phase progression', () => {
  it('does not draw on the first player\'s first turn, but still gains energy', () => {
    const state = { ...createInitialGameState(), phase: 'Draw' as const };
    const next = nextPhase(state);
    expect(next.phase).toBe('Play');
    expect(next.players.player1.hand).toHaveLength(5);
    expect(next.players.player1.deck).toHaveLength(35);
    expect(next.players.player1.currentEnergy).toBe(1);
  });

  it('draws a card and gains energy from the second turn on', () => {
    const state = { ...createInitialGameState(), turn: 2, currentPlayer: 'player2' as const, phase: 'Draw' as const };
    const next = nextPhase(state);
    expect(next.players.player2.hand).toHaveLength(6);
    expect(next.players.player2.deck).toHaveLength(34);
    expect(next.players.player2.currentEnergy).toBe(1);
  });

  it('ends the turn and resets turn state', () => {
    const state = unwrap(playCard(withPlayer(emptyState(), 'player1', { hand: [monster('a')] }), 'player1', 0, { row: 'frontRow', index: 0 }));
    const next = endTurn(state);
    expect(next.currentPlayer).toBe('player2');
    expect(next.phase).toBe('Draw');
    expect(next.turnState.summonedThisTurnIds).toEqual([]);
  });
});

describe('deck out', () => {
  // player1 のドローフェイズから、1周回って再び player1 のドローフェイズが終わるまで進める
  const playRound = (state: GameState): GameState => nextPhase(endTurn(endTurn(state)));
  const drawState = (deck: Card[]): GameState =>
    withPlayer({ ...emptyState(), phase: 'Draw' }, 'player1', { deck });

  it('does not damage the special card on the turn the last card is drawn', () => {
    const next = nextPhase(drawState([monster('last')]));
    expect(next.players.player1.deck).toHaveLength(0);
    expect(next.players.player1.hand.map(c => c.id)).toEqual(['last']);
    expect(next.players.player1.specialCardHp).toBe(20);
  });

  it('damages the special card by 1 on each following turn while the deck stays empty', () => {
    let state = nextPhase(drawState([monster('last')]));
    state = playRound(state);
    expect(state.players.player1.specialCardHp).toBe(19);
    state = playRound(state);
    expect(state.players.player1.specialCardHp).toBe(18);
    expect(state.players.player2.specialCardHp).toBe(20);
  });

  it('skips the damage when the deck was refilled during the turn the last card was drawn', () => {
    let state = nextPhase(drawState([monster('last')]));
    state = withPlayer(state, 'player1', { deck: [monster('refill')] });
    state = playRound(state);
    expect(state.players.player1.specialCardHp).toBe(20);
    expect(state.players.player1.hand.map(c => c.id)).toEqual(['last', 'refill']);
  });

  it('loses the game when deck-out damage reduces the special card HP to 0', () => {
    const state = withPlayer(drawState([]), 'player1', { specialCardHp: 1 });
    expect(nextPhase(state).winner).toBe('player2');
  });
});

describe('playCard', () => {
  it('places a monster and spends energy without mutating the original state', () => {
    const state = withPlayer(emptyState(), 'player1', { hand: [monster('a', { cost: 2 })] });
    const next = unwrap(playCard(state, 'player1', 0, { row: 'frontRow', index: 1 }));
    expect(next.players.player1.field.frontRow[1]?.id).toBe('a');
    expect(next.players.player1.currentEnergy).toBe(3);
    expect(state.players.player1.field.frontRow[1]).toBeNull();
  });

  it('refuses to place a spell on the field', () => {
    const state = withPlayer(emptyState(), 'player1', { hand: [spell] });
    expect(playCard(state, 'player1', 0, { row: 'frontRow', index: 0 }).ok).toBe(false);
  });
});

describe('castSpell', () => {
  it('raises the target FA by 1 until the end of the turn', () => {
    const state = withPlayer(withField(emptyState(), 'player1', 'frontRow', [monster('a'), null, null]), 'player1', { hand: [spell] });
    let next = unwrap(castSpell(state, 'player1', 0, { row: 'frontRow', index: 0 }));
    expect(next.players.player1.graveyard).toContainEqual(spell);

    next = unwrap(attack(inPhase(next, 'Attack'), 'player1', { row: 'frontRow', index: 0 }, { type: 'player' }));
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
    const next = unwrap(attack(inPhase(state, 'Attack'), 'player1', { row: 'frontRow', index: 0 }, { type: 'monster', position: { row: 'frontRow', index: 0 } }));
    expect(next.players.player2.field.frontRow[0]).toBeNull();
    expect(next.players.player2.graveyard.map(c => c.id)).toEqual(['b']);
  });

  it('prevents attacking twice, attacking the back row, or direct attacks while the front row is occupied', () => {
    let state = withField(emptyState(), 'player1', 'frontRow', [monster('a', { frontAttack: 1 }), null, null]);
    state = withField(state, 'player2', 'frontRow', [monster('b'), null, null]);
    state = withField(state, 'player2', 'backRow', [monster('c'), null, null]);
    const attacker = { row: 'frontRow' as const, index: 0 };
    expect(attack(inPhase(state, 'Attack'), 'player1', attacker, { type: 'player' }).ok).toBe(false);
    expect(attack(inPhase(state, 'Attack'), 'player1', attacker, { type: 'monster', position: { row: 'backRow', index: 0 } }).ok).toBe(false);
    const next = unwrap(attack(inPhase(state, 'Attack'), 'player1', attacker, { type: 'monster', position: { row: 'frontRow', index: 0 } }));
    expect(attack(next, 'player1', attacker, { type: 'monster', position: { row: 'frontRow', index: 0 } }).ok).toBe(false);
  });

  it('declares a winner when the special card HP reaches 0', () => {
    const state = withField(emptyState(), 'player1', 'frontRow', [monster('a', { frontAttack: 20 }), null, null]);
    const next = unwrap(attack(inPhase(state, 'Attack'), 'player1', { row: 'frontRow', index: 0 }, { type: 'player' }));
    expect(next.winner).toBe('player1');
  });
});

describe('turn and phase checks', () => {
  it('rejects actions outside the player\'s own turn or the right phase', () => {
    const state = withField(withPlayer(emptyState(), 'player1', { hand: [monster('a')] }), 'player1', 'frontRow', [monster('b'), null, null]);
    const slot = { row: 'frontRow' as const, index: 1 };
    expect(playCard(state, 'player2', 0, slot).ok).toBe(false);
    expect(playCard(inPhase(state, 'Attack'), 'player1', 0, slot).ok).toBe(false);
    expect(attack(state, 'player1', { row: 'frontRow', index: 0 }, { type: 'player' }).ok).toBe(false);
  });

  it('returns a destroyed monster to the graveyard with its original stats', () => {
    let state = withField(emptyState(), 'player1', 'frontRow', [monster('a', { frontAttack: 5 }), null, null]);
    state = withField(state, 'player2', 'frontRow', [{ ...monster('m001-3'), name: 'ゴブリンアタッカー', cardHp: 2 }, null, null]);
    const next = unwrap(attack(inPhase(state, 'Attack'), 'player1', { row: 'frontRow', index: 0 }, { type: 'monster', position: { row: 'frontRow', index: 0 } }));
    expect(next.players.player2.graveyard[0]).toMatchObject({ id: 'm001-3', cardHp: 6 });
  });
});

describe('spell effects', () => {
  it('heals an ally up to its max HP and rejects an undamaged target', () => {
    const damaged = { ...monster('m001-0'), cardHp: 2 }; // ゴブリンアタッカー（最大HP 6）
    let state = withField(emptyState(), 'player1', 'frontRow', [damaged, monster('m001-1', { cardHp: 6 }), null]);
    state = withPlayer(state, 'player1', { hand: [healSpell, healSpell] });
    const next = unwrap(castSpell(state, 'player1', 0, { row: 'frontRow', index: 0 }));
    expect(next.players.player1.field.frontRow[0]?.cardHp).toBe(5);
    const full = unwrap(castSpell(next, 'player1', 0, { row: 'frontRow', index: 0 }));
    expect(full.players.player1.field.frontRow[0]?.cardHp).toBe(6);
    expect(castSpell(state, 'player1', 0, { row: 'frontRow', index: 1 }).ok).toBe(false);
  });

  it('damages an enemy monster, destroying it at 0 HP', () => {
    let state = withField(emptyState(), 'player2', 'backRow', [monster('a', { cardHp: 3 }), monster('b', { cardHp: 9 }), null]);
    state = withPlayer(state, 'player1', { hand: [fireSpell, fireSpell] });
    let next = unwrap(castSpell(state, 'player1', 0, { row: 'backRow', index: 0 }));
    expect(next.players.player2.field.backRow[0]).toBeNull();
    expect(next.players.player2.graveyard.map(c => c.id)).toEqual(['a']);
    next = unwrap(castSpell(next, 'player1', 0, { row: 'backRow', index: 1 }));
    expect(next.players.player2.field.backRow[1]?.cardHp).toBe(6);
  });

  it('requires a target on the correct side', () => {
    const state = withPlayer(
      withField(emptyState(), 'player1', 'frontRow', [monster('mine'), null, null]),
      'player1',
      { hand: [fireSpell] },
    );
    // 炎の呪文は相手のモンスターが対象なので、相手の同じ位置が空なら失敗する
    expect(castSpell(state, 'player1', 0, { row: 'frontRow', index: 0 }).ok).toBe(false);
  });
});

describe('first turn', () => {
  it('skips the attack phase and forbids attacks on the first player\'s first turn', () => {
    const base = withField({ ...emptyState(), turn: 1 }, 'player1', 'frontRow', [monster('a'), null, null]);
    expect(attack(inPhase(base, 'Attack'), 'player1', { row: 'frontRow', index: 0 }, { type: 'player' }).ok).toBe(false);
    const next = nextPhase(base); // Play → (Attack を飛ばして) 相手のターンへ
    expect(next.currentPlayer).toBe('player2');
    expect(next.phase).toBe('Draw');
  });

  it('allows attacks from the second turn on', () => {
    const state = withField({ ...emptyState(), turn: 3 }, 'player1', 'frontRow', [monster('a'), null, null]);
    expect(nextPhase(state).phase).toBe('Attack');
    expect(attack(inPhase(state, 'Attack'), 'player1', { row: 'frontRow', index: 0 }, { type: 'player' }).ok).toBe(true);
  });
});

describe('unimplemented spells', () => {
  it('cannot be cast and the AI does not try', () => {
    const custom = { ...spell, id: 'cx-0', effect: { kind: 'custom' as const }, target: 'enemyMonster' as const };
    let state = withField(emptyState(), 'player2', 'frontRow', [monster('a', { cardHp: 1 }), null, null]);
    state = withPlayer(state, 'player1', { hand: [custom] });
    expect(castSpell(state, 'player1', 0, { row: 'frontRow', index: 0 })).toEqual({ ok: false, error: 'このスペルの効果はまだ実装されていません。' });
  });
});

describe('draw then discard (恵の泉)', () => {
  const setup = (deck = [monster('d1'), monster('d2'), monster('d3')]) =>
    withPlayer(emptyState(), 'player1', { hand: [drawSpell, monster('h1'), monster('h2')], deck });

  it('draws two cards without a target, then waits for two cards to be discarded', () => {
    const next = unwrap(castSpell(setup(), 'player1', 0));
    expect(next.players.player1.hand.map(c => c.id)).toEqual(['h1', 'h2', 'd1', 'd2']);
    expect(next.players.player1.deck.map(c => c.id)).toEqual(['d3']);
    expect(next.players.player1.graveyard.map(c => c.id)).toEqual([drawSpell.id]);
    expect(next.pendingDiscard).toEqual({ player: 'player1', count: 2 });
  });

  it('blocks other actions and phase changes until the discard is done', () => {
    const next = unwrap(castSpell(setup(), 'player1', 0));
    expect(playCard(next, 'player1', 0, { row: 'frontRow', index: 0 }).ok).toBe(false);
    expect(nextPhase(next)).toBe(next);
    expect(endTurn(next)).toBe(next);
  });

  it('discards exactly the chosen cards', () => {
    const next = unwrap(castSpell(setup(), 'player1', 0));
    expect(discardCards(next, 'player1', [0]).ok).toBe(false);
    expect(discardCards(next, 'player1', [0, 0]).ok).toBe(false);
    const done = unwrap(discardCards(next, 'player1', [0, 3]));
    expect(done.players.player1.hand.map(c => c.id)).toEqual(['h2', 'd1']);
    expect(done.players.player1.graveyard.map(c => c.id)).toEqual([drawSpell.id, 'h1', 'd2']);
    expect(done.pendingDiscard).toBeNull();
  });

  it('draws only what is left in the deck', () => {
    const next = unwrap(castSpell(setup([monster('last')]), 'player1', 0));
    expect(next.players.player1.hand).toHaveLength(3);
    expect(next.pendingDiscard?.count).toBe(2);
  });
});
