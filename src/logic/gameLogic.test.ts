import { Card } from '../types/card';
import { GameState } from '../types/gameState';
import { createInitialGameState } from './initialState';
import {
  attack,
  castSpell,
  discardCards,
  activateLeaderAbility,
  endTurn,
  getAttackPower,
  getEffectiveHp,
  moveMonster,
  nextPhase,
  commandMonster,
  getSummonCost,
  playCard,
  skipFreeSpell,
} from './gameLogic';
import { apprentice, spellOf, withAbility, withLeaderAbility, backSpell, catchUpSpell, disableSpell, drawSpell, forceMoveSpell, throwSpell, withRallyLeader, emptyState, fireSpell, healSpell, inPhase, monster, spell, unwrap, withField, withGolemLeader, withPlayer } from './testUtils';

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

  it('forbids back-row monsters from attacking the special card, but lets them attack monsters', () => {
    let state = withField(emptyState(), 'player1', 'backRow', [monster('a', { backAttack: 3 }), null, null]);
    state = inPhase(withField(state, 'player2', 'backRow', [monster('b', { cardHp: 5 }), null, null]), 'Attack');
    const attacker = { row: 'backRow' as const, index: 0 };
    expect(attack(state, 'player1', attacker, { type: 'player' })).toEqual({ ok: false, error: '後衛のモンスターは大将カードを攻撃できません。' });
    const next = unwrap(attack(state, 'player1', attacker, { type: 'monster', position: { row: 'backRow', index: 0 } }));
    expect(next.players.player2.field.backRow[0]?.cardHp).toBe(2);
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

describe('後衛支援 (BA buff)', () => {
  it('raises BA of an ally until the end of the turn', () => {
    let state = withField(emptyState(), 'player1', 'backRow', [monster('a', { backAttack: 2 }), null, null]);
    state = withPlayer(state, 'player1', { hand: [backSpell] });
    const next = unwrap(castSpell(state, 'player1', 0, { row: 'backRow', index: 0 }));
    const card = next.players.player1.field.backRow[0]!;
    expect(getAttackPower(next, card, 'backRow')).toBe(3);
    expect(getAttackPower(next, card, 'frontRow')).toBe(3); // FA は変わらない
    expect(getAttackPower(endTurn(next), card, 'backRow')).toBe(2);
  });
});

describe('leader ability (マウンテンゴーレム)', () => {
  const golem = (id: string, cardHp: number) => monster(id, { race: 'ゴーレム', cardHp });

  it('gives golems +1 HP, so they survive damage equal to their card HP', () => {
    let state = withGolemLeader(emptyState(), 'player2');
    state = withField(state, 'player2', 'frontRow', [golem('g', 3), monster('other', { cardHp: 3 }), null]);
    expect(getEffectiveHp(state, 'player2', state.players.player2.field.frontRow[0]!)).toBe(4);
    state = withPlayer(state, 'player1', { hand: [fireSpell, fireSpell] });
    let next = unwrap(castSpell(state, 'player1', 0, { row: 'frontRow', index: 0 }));
    expect(next.players.player2.field.frontRow[0]?.cardHp).toBe(0); // 表示上の HP は 0 + 1 = 1
    next = unwrap(castSpell(next, 'player1', 0, { row: 'frontRow', index: 1 }));
    expect(next.players.player2.field.frontRow[1]).toBeNull(); // ゴーレム以外は倒される
  });

  it('heals golems up to their max HP plus the bonus', () => {
    let state = withGolemLeader(emptyState(), 'player1');
    state = withField(state, 'player1', 'frontRow', [{ ...monster('m002-0', { race: 'ゴーレム' }), cardHp: 12 }, null, null]); // ストーンゴーレム（最大HP 13）
    state = withPlayer(state, 'player1', { hand: [healSpell, healSpell] });
    const next = unwrap(castSpell(state, 'player1', 0, { row: 'frontRow', index: 0 }));
    expect(getEffectiveHp(next, 'player1', next.players.player1.field.frontRow[0]!)).toBe(14);
    expect(castSpell(next, 'player1', 0, { row: 'frontRow', index: 0 }).ok).toBe(false); // 満タンなので使えない
  });

  it('is cancelled by 指揮低下 for this turn: golems left at 0 HP are destroyed', () => {
    let state = withGolemLeader(emptyState(), 'player2');
    state = withField(state, 'player2', 'frontRow', [golem('weak', 0), golem('strong', 5), null]);
    state = withPlayer(state, 'player1', { hand: [disableSpell] });
    const next = unwrap(castSpell(state, 'player1', 0));
    expect(next.turnState.disabledLeaders).toEqual(['player2']);
    expect(next.players.player2.field.frontRow[0]).toBeNull();
    expect(next.players.player2.graveyard.map(c => c.id)).toEqual(['weak']);
    const strong = next.players.player2.field.frontRow[1]!;
    expect(getEffectiveHp(next, 'player2', strong)).toBe(5);
    expect(getEffectiveHp(endTurn(next), 'player2', strong)).toBe(6); // 次のターンには戻る
  });
});

describe('投擲 (damage to the back row)', () => {
  it('hits only a back-row enemy, even when the front row is occupied', () => {
    let state = withField(emptyState(), 'player2', 'frontRow', [monster('f'), null, null]);
    state = withField(state, 'player2', 'backRow', [monster('b', { cardHp: 3 }), null, null]);
    state = withPlayer(state, 'player1', { hand: [throwSpell] });
    expect(castSpell(state, 'player1', 0, { row: 'frontRow', index: 0 })).toEqual({ ok: false, error: '相手の後衛のモンスターを選んでください。' });
    const next = unwrap(castSpell(state, 'player1', 0, { row: 'backRow', index: 0 }));
    expect(next.players.player2.field.backRow[0]).toBeNull();
  });
});

describe('強制移動 (forced move)', () => {
  const setup = () => withPlayer(
    withField(emptyState(), 'player2', 'frontRow', [null, monster('t'), null]),
    'player1', { hand: [forceMoveSpell] },
  );

  it('moves the enemy to the same column of the other row and locks it during its owner\'s next turn', () => {
    const next = unwrap(castSpell(setup(), 'player1', 0, { row: 'frontRow', index: 1 }));
    expect(next.players.player2.field.frontRow[1]).toBeNull();
    expect(next.players.player2.field.backRow[1]?.id).toBe('t');
    const theirTurn = { ...endTurn(next), phase: 'Play' as const };
    expect(moveMonster(theirTurn, 'player2', { row: 'backRow', index: 1 }, { row: 'frontRow', index: 1 }))
      .toEqual({ ok: false, error: 'このモンスターは強制移動の効果で、このターンは移動できません。' });
    const later = { ...endTurn(endTurn(theirTurn)), phase: 'Play' as const };
    expect(moveMonster(later, 'player2', { row: 'backRow', index: 1 }, { row: 'frontRow', index: 1 }).ok).toBe(true);
  });

  it('uses another empty slot when the same column is taken, and fails when the row is full', () => {
    let state = withField(setup(), 'player2', 'backRow', [null, monster('x'), monster('y')]);
    const next = unwrap(castSpell(state, 'player1', 0, { row: 'frontRow', index: 1 }));
    expect(next.players.player2.field.backRow[0]?.id).toBe('t');
    state = withField(state, 'player2', 'backRow', [monster('w'), monster('x'), monster('y')]);
    expect(castSpell(state, 'player1', 0, { row: 'frontRow', index: 1 }).ok).toBe(false);
  });
});

describe('逆転の兆し (catch-up energy)', () => {
  it('gains energy equal to how many more monsters the opponent has, up to the max', () => {
    let state = withField(emptyState(), 'player2', 'frontRow', [monster('a'), monster('b'), monster('c')]);
    state = withField(state, 'player1', 'frontRow', [monster('m'), null, null]);
    state = withPlayer(state, 'player1', { hand: [catchUpSpell, catchUpSpell], currentEnergy: 5 });
    const next = unwrap(castSpell(state, 'player1', 0));
    expect(next.players.player1.currentEnergy).toBe(5 - 1 + 2);
    const capped = unwrap(castSpell(withPlayer(next, 'player1', { currentEnergy: 10 }), 'player1', 0));
    expect(capped.players.player1.currentEnergy).toBe(10 - 1 + 1); // 上限 10
  });

  it('gains nothing when the opponent does not have more monsters', () => {
    const state = withPlayer(emptyState(), 'player1', { hand: [catchUpSpell], currentEnergy: 3 });
    expect(unwrap(castSpell(state, 'player1', 0)).players.player1.currentEnergy).toBe(2);
  });
});

describe('見習い魔導士 (free spell on summon)', () => {
  const setup = (hand = [apprentice(), fireSpell, healSpell]) =>
    withField(withPlayer(emptyState(), 'player1', { hand, currentEnergy: 1 }), 'player2', 'frontRow', [monster('e', { cardHp: 3 }), null, null]);

  it('lets the player cast a cost-1 spell for free right after summoning', () => {
    const fire = { ...fireSpell, cost: 1 };
    const summoned = unwrap(playCard(setup([apprentice(), fire]), 'player1', 0, { row: 'backRow', index: 0 }));
    expect(summoned.pendingFreeSpell).toEqual({ player: 'player1', maxCost: 1, source: '見習い魔導士' });
    expect(summoned.players.player1.currentEnergy).toBe(0);
    expect(nextPhase(summoned)).toBe(summoned); // 選ぶまで進めない
    const next = unwrap(castSpell(summoned, 'player1', 0, { row: 'frontRow', index: 0 }));
    expect(next.players.player2.field.frontRow[0]).toBeNull();
    expect(next.players.player1.currentEnergy).toBe(0);
    expect(next.pendingFreeSpell).toBeNull();
  });

  it('rejects spells above the cost limit and can be skipped', () => {
    const expensive = { ...fireSpell, cost: 2 };
    const summoned = unwrap(playCard(setup([apprentice(), expensive, spell]), 'player1', 0, { row: 'backRow', index: 0 }));
    expect(castSpell(summoned, 'player1', 0, { row: 'frontRow', index: 0 }).ok).toBe(false);
    expect(playCard(summoned, 'player1', 1, { row: 'frontRow', index: 0 }).ok).toBe(false);
    const skipped = unwrap(skipFreeSpell(summoned, 'player1'));
    expect(skipped.pendingFreeSpell).toBeNull();
    expect(skipped.players.player1.hand).toHaveLength(2);
  });

  it('does not ask when there is no usable spell in hand', () => {
    const summoned = unwrap(playCard(setup([apprentice(), monster('x')]), 'player1', 0, { row: 'backRow', index: 0 }));
    expect(summoned.pendingFreeSpell).toBeNull();
  });
});

describe('leader ability (大将: energy once when HP <= 10)', () => {
  it('can be used once, only at 10 HP or less, and not while disabled', () => {
    let state = withPlayer(withRallyLeader(emptyState(), 'player1'), 'player1', { currentEnergy: 2 });
    expect(activateLeaderAbility(state, 'player1').ok).toBe(false); // HP 20
    state = withPlayer(state, 'player1', { specialCardHp: 10 });
    const disabled = { ...state, turnState: { ...state.turnState, disabledLeaders: ['player1' as const] } };
    expect(activateLeaderAbility(disabled, 'player1').ok).toBe(false);
    const next = unwrap(activateLeaderAbility(state, 'player1'));
    expect(next.players.player1.currentEnergy).toBe(5);
    expect(activateLeaderAbility(next, 'player1')).toEqual({ ok: false, error: '大将の効果はもう使いました。' });
  });
});

describe('front/back row monsters', () => {
  const atk = (state: GameState) => inPhase(state, 'Attack');

  it('狙撃手 can hit the back row from the back row even when the front row is occupied', () => {
    let state = withField(emptyState(), 'player1', 'backRow', [withAbility('sn', { kind: 'sniper' }, { backAttack: 3 }), monster('n', { backAttack: 3 }), null]);
    state = withField(state, 'player2', 'frontRow', [monster('f'), null, null]);
    state = atk(withField(state, 'player2', 'backRow', [monster('b', { cardHp: 3 }), null, null]));
    const target = { type: 'monster' as const, position: { row: 'backRow' as const, index: 0 } };
    expect(attack(state, 'player1', { row: 'backRow', index: 1 }, target).ok).toBe(false);
    expect(unwrap(attack(state, 'player1', { row: 'backRow', index: 0 }, target)).players.player2.field.backRow[0]).toBeNull();
  });

  it('槍兵 also deals 1 damage to the weakest back-row enemy when attacking from the front', () => {
    let state = withField(emptyState(), 'player1', 'frontRow', [withAbility('sp', { kind: 'pierce', amount: 1 }, { frontAttack: 3 }), null, null]);
    state = withField(state, 'player2', 'frontRow', [null, monster('f', { cardHp: 9 }), null]);
    state = atk(withField(state, 'player2', 'backRow', [monster('b1', { cardHp: 4 }), null, monster('b2', { cardHp: 2 })]));
    const next = unwrap(attack(state, 'player1', { row: 'frontRow', index: 0 }, { type: 'monster', position: { row: 'frontRow', index: 1 } }));
    expect(next.players.player2.field.frontRow[1]?.cardHp).toBe(6);
    expect(next.players.player2.field.backRow[2]?.cardHp).toBe(1);
    expect(next.players.player2.field.backRow[0]?.cardHp).toBe(4);
  });

  it('盾兵 takes 1 less damage only in the front row', () => {
    const shield = (id: string) => withAbility(id, { kind: 'frontGuard', amount: 1 }, { cardHp: 9 });
    let state = withField(emptyState(), 'player2', 'frontRow', [shield('s1'), null, null]);
    state = withField(state, 'player2', 'backRow', [shield('s2'), null, null]);
    state = withPlayer(state, 'player1', { hand: [fireSpell, fireSpell] });
    let next = unwrap(castSpell(state, 'player1', 0, { row: 'frontRow', index: 0 }));
    next = unwrap(castSpell(next, 'player1', 0, { row: 'backRow', index: 0 }));
    expect(next.players.player2.field.frontRow[0]?.cardHp).toBe(7);
    expect(next.players.player2.field.backRow[0]?.cardHp).toBe(6);
  });

  it('衛生兵 heals the front ally in the same column at the end of its owner\'s turn', () => {
    let state = withField(emptyState(), 'player1', 'backRow', [withAbility('md', { kind: 'medic', amount: 2 }), null, null]);
    state = withField(state, 'player1', 'frontRow', [{ ...monster('m001-0'), cardHp: 1 }, { ...monster('m001-1'), cardHp: 1 }, null]);
    const next = endTurn(state);
    expect(next.players.player1.field.frontRow[0]?.cardHp).toBe(3);
    expect(next.players.player1.field.frontRow[1]?.cardHp).toBe(1);
  });

  it('指揮官 raises one front ally\'s FA once per turn from the back row', () => {
    let state = withField(emptyState(), 'player1', 'backRow', [withAbility('cm', { kind: 'commander', amount: 1 }), null, null]);
    state = withField(state, 'player1', 'frontRow', [monster('a', { frontAttack: 3 }), monster('b'), null]);
    const next = unwrap(commandMonster(state, 'player1', { row: 'backRow', index: 0 }, { row: 'frontRow', index: 0 }));
    expect(getAttackPower(next, next.players.player1.field.frontRow[0]!, 'frontRow')).toBe(4);
    expect(commandMonster(next, 'player1', { row: 'backRow', index: 0 }, { row: 'frontRow', index: 1 }).ok).toBe(false);
    expect(commandMonster(inPhase(endTurn(endTurn(next)), 'Play'), 'player1', { row: 'backRow', index: 0 }, { row: 'frontRow', index: 1 }).ok).toBe(true);
  });

  it('突撃兵 gets FA +2 on the turn it moves from the back row to the front row', () => {
    const state = withField(emptyState(), 'player1', 'backRow', [withAbility('ch', { kind: 'charge', amount: 2 }, { frontAttack: 2 }), null, null]);
    const next = unwrap(moveMonster(state, 'player1', { row: 'backRow', index: 0 }, { row: 'frontRow', index: 0 }));
    const card = next.players.player1.field.frontRow[0]!;
    expect(getAttackPower(next, card, 'frontRow')).toBe(4);
    expect(getAttackPower(endTurn(next), card, 'frontRow')).toBe(2);
  });

  it('殿 strikes back when destroyed in the front row by an attack', () => {
    let state = withField(emptyState(), 'player1', 'frontRow', [monster('a', { frontAttack: 6, cardHp: 5 }), null, null]);
    state = atk(withField(state, 'player2', 'frontRow', [withAbility('rg', { kind: 'rearguard', amount: 3 }, { cardHp: 6 }), null, null]));
    const next = unwrap(attack(state, 'player1', { row: 'frontRow', index: 0 }, { type: 'monster', position: { row: 'frontRow', index: 0 } }));
    expect(next.players.player2.field.frontRow[0]).toBeNull();
    expect(next.players.player1.field.frontRow[0]?.cardHp).toBe(2);
  });

  it('伏兵 costs 1 less while the opponent has more monsters', () => {
    const ambush = withAbility('am', { kind: 'ambush', amount: 1 }, { cost: 2 });
    let state = withPlayer(emptyState(), 'player1', { hand: [ambush], currentEnergy: 1 });
    expect(getSummonCost(state, 'player1', ambush)).toBe(2);
    expect(playCard(state, 'player1', 0, { row: 'frontRow', index: 0 }).ok).toBe(false);
    state = withField(state, 'player2', 'frontRow', [monster('e'), null, null]);
    const next = unwrap(playCard(state, 'player1', 0, { row: 'frontRow', index: 0 }));
    expect(next.players.player1.currentEnergy).toBe(0);
  });
});

describe('front/back row spells', () => {
  it('薙ぎ払い hits every enemy front-row monster', () => {
    let state = withField(emptyState(), 'player2', 'frontRow', [monster('a', { cardHp: 2 }), monster('b', { cardHp: 5 }), null]);
    state = withField(state, 'player2', 'backRow', [monster('c', { cardHp: 2 }), null, null]);
    state = withPlayer(state, 'player1', { hand: [spellOf('sweep', { kind: 'damageFrontAll', amount: 2 }, 3)] });
    const next = unwrap(castSpell(state, 'player1', 0));
    expect(next.players.player2.field.frontRow[0]).toBeNull();
    expect(next.players.player2.field.frontRow[1]?.cardHp).toBe(3);
    expect(next.players.player2.field.backRow[0]?.cardHp).toBe(2);
  });

  it('一斉射撃 deals damage equal to the number of own back-row monsters to an enemy front monster', () => {
    const volley = spellOf('volley', { kind: 'volley', amount: 1 }, 2);
    let state = withField(emptyState(), 'player2', 'frontRow', [monster('a', { cardHp: 5 }), null, null]);
    state = withPlayer(state, 'player1', { hand: [volley] });
    expect(castSpell(state, 'player1', 0, { row: 'frontRow', index: 0 }).ok).toBe(false); // 後衛がいない
    state = withField(state, 'player1', 'backRow', [monster('x'), monster('y'), null]);
    const next = unwrap(castSpell(state, 'player1', 0, { row: 'frontRow', index: 0 }));
    expect(next.players.player2.field.frontRow[0]?.cardHp).toBe(3);
  });

  it('撤退命令 moves a front ally to the back row and heals it without using the move', () => {
    let state = withField(emptyState(), 'player1', 'frontRow', [null, { ...monster('m001-0'), cardHp: 2 }, null]);
    state = withPlayer(state, 'player1', { hand: [spellOf('retreat', { kind: 'retreat', amount: 2 })] });
    const next = unwrap(castSpell(state, 'player1', 0, { row: 'frontRow', index: 1 }));
    expect(next.players.player1.field.backRow[1]?.cardHp).toBe(4);
    expect(next.turnState.movedMonsterId).toBeNull();
  });

  it('陣形転換 swaps the front and back monsters of a column', () => {
    let state = withField(emptyState(), 'player1', 'frontRow', [monster('f'), null, null]);
    state = withField(state, 'player1', 'backRow', [monster('b'), null, null]);
    state = withPlayer(state, 'player1', { hand: [spellOf('swap', { kind: 'swapColumn', amount: 1 })] });
    const next = unwrap(castSpell(state, 'player1', 0, { row: 'backRow', index: 0 }));
    expect([next.players.player1.field.frontRow[0]?.id, next.players.player1.field.backRow[0]?.id]).toEqual(['b', 'f']);
    expect(next.turnState.movedMonsterId).toBeNull();
  });

  it('挑発 moves an enemy back-row monster forward, swapping with the front, and locks both', () => {
    let state = withField(emptyState(), 'player2', 'frontRow', [null, monster('f'), null]);
    state = withField(state, 'player2', 'backRow', [monster('solo'), monster('b'), null]);
    state = withPlayer(state, 'player1', { hand: [spellOf('taunt', { kind: 'pullForward', amount: 1 }), spellOf('taunt2', { kind: 'pullForward', amount: 1 })] });
    expect(castSpell(state, 'player1', 0, { row: 'frontRow', index: 1 }).ok).toBe(false); // 前衛は選べない
    let next = unwrap(castSpell(state, 'player1', 0, { row: 'backRow', index: 1 }));
    expect([next.players.player2.field.frontRow[1]?.id, next.players.player2.field.backRow[1]?.id]).toEqual(['b', 'f']);
    next = unwrap(castSpell(next, 'player1', 0, { row: 'backRow', index: 0 }));
    expect(next.players.player2.field.frontRow[0]?.id).toBe('solo');
    expect(next.moveLocks.map(l => l.cardId).sort()).toEqual(['b', 'f', 'solo']);
  });

  it('背水の陣 boosts all own monsters only when outnumbered', () => {
    const stand = spellOf('stand', { kind: 'lastStand', amount: 2 }, 2);
    let state = withField(emptyState(), 'player1', 'frontRow', [monster('a', { frontAttack: 3 }), null, null]);
    state = withPlayer(state, 'player1', { hand: [stand] });
    expect(castSpell(state, 'player1', 0).ok).toBe(false);
    state = withField(state, 'player2', 'frontRow', [monster('x'), monster('y'), null]);
    const next = unwrap(castSpell(state, 'player1', 0));
    const card = next.players.player1.field.frontRow[0]!;
    expect([getAttackPower(next, card, 'frontRow'), getAttackPower(next, card, 'backRow')]).toEqual([5, 3]);
  });

  it('籠城 reduces each hit on the leader during the opponent\'s next turn', () => {
    let state = withPlayer(emptyState(), 'player1', { hand: [spellOf('guard', { kind: 'guardLeader', amount: 2 }, 2)] });
    state = withField(state, 'player2', 'frontRow', [monster('a', { frontAttack: 3 }), monster('b', { frontAttack: 1 }), null]);
    const guarded = endTurn(unwrap(castSpell(state, 'player1', 0)));
    let theirAttack = inPhase(guarded, 'Attack', 'player2');
    theirAttack = unwrap(attack(theirAttack, 'player2', { row: 'frontRow', index: 0 }, { type: 'player' }));
    theirAttack = unwrap(attack(theirAttack, 'player2', { row: 'frontRow', index: 1 }, { type: 'player' }));
    expect(theirAttack.players.player1.specialCardHp).toBe(20 - 1);
    expect(endTurn(theirAttack).leaderGuards).toEqual([]);
  });
});

describe('front/back row leaders', () => {
  it('軍師 heals a monster by 1 whenever it moves', () => {
    let state = withLeaderAbility(emptyState(), 'player1', { kind: 'healOnMove', amount: 1 });
    state = withField(state, 'player1', 'frontRow', [{ ...monster('m001-0'), cardHp: 2 }, null, null]);
    const next = unwrap(moveMonster(state, 'player1', { row: 'frontRow', index: 0 }, { row: 'backRow', index: 0 }));
    expect(next.players.player1.field.backRow[0]?.cardHp).toBe(3);
  });

  it('弓兵隊長 raises the BA of own back-row monsters', () => {
    let state = withLeaderAbility(emptyState(), 'player1', { kind: 'backRowBaBonus', amount: 1 });
    state = withField(state, 'player1', 'backRow', [monster('a', { backAttack: 2 }), null, null]);
    state = withField(state, 'player2', 'backRow', [monster('e', { backAttack: 2 }), null, null]);
    expect(getAttackPower(state, state.players.player1.field.backRow[0]!, 'backRow')).toBe(3);
    expect(getAttackPower(state, state.players.player2.field.backRow[0]!, 'backRow')).toBe(2);
  });

  it('不屈の将 draws an extra card when two or more monsters behind', () => {
    let state = withLeaderAbility(emptyState(), 'player1', { kind: 'extraDrawWhenBehind', margin: 2, amount: 1 });
    state = { ...withPlayer(state, 'player1', { deck: [monster('d1'), monster('d2'), monster('d3')] }), phase: 'Draw' };
    expect(nextPhase(withField(state, 'player2', 'frontRow', [monster('a'), null, null])).players.player1.hand).toHaveLength(1);
    expect(nextPhase(withField(state, 'player2', 'frontRow', [monster('a'), monster('b'), null])).players.player1.hand).toHaveLength(2);
  });
});

