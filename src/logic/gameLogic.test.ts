import { Card, MonsterCard } from '../types/card';
import { findBaseCard } from './cards';
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
  boostMonster,
  commandMonster,
  pickCard,
  resolveReaction,
  skipFreeSummon,
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
    expect(next.players.player2.graveyard[0]).toMatchObject({ id: 'm001-3', cardHp: (findBaseCard('m001') as MonsterCard).cardHp });
  });
});

describe('spell effects', () => {
  it('heals an ally up to its max HP and rejects an undamaged target', () => {
    const damaged = monster('x', { cardHp: 2, maxHp: 6 });
    let state = withField(emptyState(), 'player1', 'frontRow', [damaged, monster('y', { cardHp: 6, maxHp: 6 }), null]);
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
    state = withField(state, 'player1', 'frontRow', [monster('g', { race: 'ゴーレム', cardHp: 12, maxHp: 13 }), null, null]);
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

describe('leader ability (大将: energy once when HP is half or less)', () => {
  it('uses the ratio of the max HP when hpRatio is set', () => {
    let state = withLeaderAbility(emptyState(), 'player1', { kind: 'rallyEnergy', hpRatio: 0.5, amount: 3 }); // 最大 HP 20
    state = withPlayer(state, 'player1', { specialCardHp: 11, currentEnergy: 0 });
    expect(activateLeaderAbility(state, 'player1')).toEqual({ ok: false, error: '大将の HP が10以下のときに使えます。' });
    expect(unwrap(activateLeaderAbility(withPlayer(state, 'player1', { specialCardHp: 10 }), 'player1')).players.player1.currentEnergy).toBe(3);
  });

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

  it('槍兵 also deals 1 damage to the chosen back-row enemy (the weakest when not chosen)', () => {
    let state = withField(emptyState(), 'player1', 'frontRow', [withAbility('sp', { kind: 'pierce', amount: 1 }, { frontAttack: 3 }), null, null]);
    state = withField(state, 'player2', 'frontRow', [null, monster('f', { cardHp: 9 }), null]);
    state = atk(withField(state, 'player2', 'backRow', [monster('b1', { cardHp: 4 }), null, monster('b2', { cardHp: 2 })]));
    const next = unwrap(attack(state, 'player1', { row: 'frontRow', index: 0 }, { type: 'monster', position: { row: 'frontRow', index: 1 } }));
    expect(next.players.player2.field.frontRow[1]?.cardHp).toBe(6);
    expect(next.players.player2.field.backRow[2]?.cardHp).toBe(1);
    expect(next.players.player2.field.backRow[0]?.cardHp).toBe(4);
    const chosen = unwrap(attack(state, 'player1', { row: 'frontRow', index: 0 }, { type: 'monster', position: { row: 'frontRow', index: 1 } }, { row: 'backRow', index: 0 }));
    expect([chosen.players.player2.field.backRow[0]?.cardHp, chosen.players.player2.field.backRow[2]?.cardHp]).toEqual([3, 2]);
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

describe('move locks and own spells', () => {
  it('a monster locked by the opponent can still be moved by its owner\'s spells, but not by a normal move', () => {
    let state = withField(emptyState(), 'player1', 'frontRow', [monster('m001-0', { cardHp: 2 }), null, null]);
    state = { ...state, moveLocks: [{ player: 'player1', cardId: 'm001-0' }] };
    state = withPlayer(state, 'player1', { hand: [spellOf('retreat', { kind: 'retreat', amount: 2 })] });
    expect(moveMonster(state, 'player1', { row: 'frontRow', index: 0 }, { row: 'backRow', index: 0 }).ok).toBe(false);
    const next = unwrap(castSpell(state, 'player1', 0, { row: 'frontRow', index: 0 }));
    expect(next.players.player1.field.backRow[0]?.id).toBe('m001-0');
  });
});

describe('front/back row leaders', () => {
  it('軍師 heals a monster by 1 whenever it moves', () => {
    let state = withLeaderAbility(emptyState(), 'player1', { kind: 'healOnMove', amount: 1 });
    state = withField(state, 'player1', 'frontRow', [{ ...monster('m001-0'), cardHp: 2 }, null, null]);
    const next = unwrap(moveMonster(state, 'player1', { row: 'frontRow', index: 0 }, { row: 'backRow', index: 0 }));
    expect(next.players.player1.field.backRow[0]?.cardHp).toBe(3);
  });

  it('弓兵隊長 raises the BA of own back-row monsters once its HP is half or less', () => {
    let state = withLeaderAbility(emptyState(), 'player1', { kind: 'backRowBaBonus', amount: 1, hpRatio: 0.5 });
    state = withField(state, 'player1', 'backRow', [monster('a', { backAttack: 2 }), null, null]);
    state = withField(state, 'player2', 'backRow', [monster('e', { backAttack: 2 }), null, null]);
    expect(getAttackPower(state, state.players.player1.field.backRow[0]!, 'backRow')).toBe(2); // HP 20 / 20
    state = withPlayer(state, 'player1', { specialCardHp: 10 });
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

describe('resource cards: cost cheating', () => {
  const play = (state: GameState) => withPlayer(state, 'player1', { currentEnergy: 0 });

  it('召喚士 summons a cost-2 monster for free, which can be skipped', () => {
    const summoner = withAbility('sm', { kind: 'freeSummonOnSummon', maxCost: 2 }, { cost: 3 });
    const state = withPlayer(emptyState(), 'player1', { hand: [summoner, monster('cheap', { cost: 2 }), monster('big', { cost: 3 })], currentEnergy: 3 });
    const summoned = unwrap(playCard(state, 'player1', 0, { row: 'backRow', index: 0 }));
    expect(summoned.pendingFreeSummon).toMatchObject({ maxCost: 2 });
    expect(playCard(summoned, 'player1', 1, { row: 'frontRow', index: 0 }).ok).toBe(false); // big はコスト3
    const free = unwrap(playCard(summoned, 'player1', 0, { row: 'frontRow', index: 0 }));
    expect(free.players.player1.field.frontRow[0]?.id).toBe('cheap');
    expect(free.pendingFreeSummon).toBeNull();
    expect(unwrap(skipFreeSummon(summoned, 'player1')).pendingFreeSummon).toBeNull();
  });

  it('奇襲部隊 summons a cost-3 monster into the front row for free', () => {
    const state = withPlayer(emptyState(), 'player1', { hand: [spellOf('ambush', { kind: 'freeSummon', amount: 3 }, 2), monster('big', { cost: 3 })], currentEnergy: 2 });
    const cast = unwrap(castSpell(state, 'player1', 0));
    expect(playCard(cast, 'player1', 0, { row: 'backRow', index: 0 }).ok).toBe(false);
    const done = unwrap(playCard(cast, 'player1', 0, { row: 'frontRow', index: 0 }));
    expect(done.players.player1.currentEnergy).toBe(0);
    expect(done.players.player1.field.frontRow[0]?.id).toBe('big');
  });

  it('魔導書 and 伝令官 discount only the next spell', () => {
    const book = spellOf('book', { kind: 'spellDiscount', amount: 2 }, 1);
    const fire3 = { ...fireSpell, cost: 3 };
    let state = withField(emptyState(), 'player2', 'frontRow', [monster('e', { cardHp: 9 }), null, null]);
    state = withPlayer(state, 'player1', { hand: [book, fire3, { ...fire3, id: 'fire-2' }], currentEnergy: 2 });
    let next = unwrap(castSpell(state, 'player1', 0));
    next = unwrap(castSpell(next, 'player1', 0, { row: 'frontRow', index: 0 })); // 3 - 2 = 1
    expect(next.players.player1.currentEnergy).toBe(0);
    expect(castSpell(next, 'player1', 0, { row: 'frontRow', index: 0 }).ok).toBe(false);
    const herald = withAbility('hd', { kind: 'spellDiscountOnSummon', amount: 1 }, { cost: 1 });
    const summoned = unwrap(playCard(withPlayer(emptyState(), 'player1', { hand: [herald], currentEnergy: 1 }), 'player1', 0, { row: 'backRow', index: 0 }));
    expect(summoned.turnState.spellDiscount).toBe(1);
  });

  it('援軍要請 discounts the next summon by 2 only when outnumbered', () => {
    const call = spellOf('call', { kind: 'summonDiscount', amount: 2 }, 1);
    let state = withPlayer(emptyState(), 'player1', { hand: [call, monster('big', { cost: 3 })], currentEnergy: 2 });
    expect(castSpell(state, 'player1', 0).ok).toBe(false);
    state = withField(state, 'player2', 'frontRow', [monster('e'), null, null]);
    const next = unwrap(playCard(unwrap(castSpell(state, 'player1', 0)), 'player1', 0, { row: 'frontRow', index: 0 }));
    expect(next.players.player1.currentEnergy).toBe(0);
    expect(next.turnState.summonDiscount).toBe(0);
  });

  it('生贄の儀式 sacrifices a monster and summons a cost-2 monster for free', () => {
    let state = withField(emptyState(), 'player1', 'frontRow', [monster('weak'), null, null]);
    state = play(withPlayer(state, 'player1', { hand: [spellOf('rite', { kind: 'sacrificeSummon', amount: 2 }, 0), monster('new', { cost: 2 })] }));
    const cast = unwrap(castSpell(state, 'player1', 0, { row: 'frontRow', index: 0 }));
    expect(cast.players.player1.graveyard.map(c => c.id)).toContain('weak');
    const done = unwrap(playCard(cast, 'player1', 0, { row: 'frontRow', index: 0 }));
    expect(done.players.player1.field.frontRow[0]?.id).toBe('new');
  });

  it('傭兵 can be summoned by discarding two cards instead of paying energy', () => {
    const merc = withAbility('mc', { kind: 'discardSummon', amount: 2 }, { cost: 4 });
    const state = play(withPlayer(emptyState(), 'player1', { hand: [merc, monster('a'), monster('b'), monster('c')] }));
    expect(playCard(state, 'player1', 0, { row: 'frontRow', index: 0 }).ok).toBe(false);
    const summoned = unwrap(playCard(state, 'player1', 0, { row: 'frontRow', index: 0 }, { payByDiscard: true }));
    expect(summoned.pendingDiscard).toEqual({ player: 'player1', count: 2 });
    const done = unwrap(discardCards(summoned, 'player1', [0, 1]));
    expect(done.players.player1.hand.map(c => c.id)).toEqual(['c']);
  });
});

describe('resource cards: energy', () => {
  it('魔力の泉 and 祈祷師 add energy at the start of the next own turn', () => {
    const priest = withAbility('pr', { kind: 'energyNextTurnFromBack', amount: 1 }, { cost: 2 });
    let state = withPlayer(emptyState(), 'player1', { hand: [spellOf('fount', { kind: 'delayedEnergy', amount: 2 }), priest], currentEnergy: 3, deck: [monster('d1'), monster('d2')] });
    state = unwrap(castSpell(state, 'player1', 0));
    state = unwrap(playCard(state, 'player1', 0, { row: 'backRow', index: 0 }));
    const nextTurn = nextPhase(endTurn(endTurn(state)));
    expect(nextTurn.players.player1.currentEnergy).toBe(0 + 1 + 2 + 1);
    expect(nextTurn.players.player1.delayedEnergy).toEqual([]);
  });

  it('魔力結晶 gives 1 energy for 2 discards, 蓄魔の壺 raises the max up to 12', () => {
    let state = withPlayer(emptyState(), 'player1', { hand: [spellOf('crystal', { kind: 'discardForEnergy', amount: 1 }, 0), monster('a'), monster('b')], currentEnergy: 1 });
    expect(castSpell(withPlayer(state, 'player1', { hand: state.players.player1.hand.slice(0, 2) }), 'player1', 0).ok).toBe(false); // 捨てる手札が1枚しかない
    const cast = unwrap(castSpell(state, 'player1', 0));
    expect(cast.players.player1.currentEnergy).toBe(2);
    expect(cast.pendingDiscard?.count).toBe(2);
    const pot = spellOf('pot', { kind: 'raiseMaxEnergy', amount: 1 }, 0);
    state = withPlayer(emptyState(), 'player1', { hand: [pot, pot, pot], maxEnergy: 11 });
    const raised = unwrap(castSpell(state, 'player1', 0));
    expect(raised.players.player1.maxEnergy).toBe(12);
    expect(castSpell(raised, 'player1', 0).ok).toBe(false);
  });

  it('魔力吸収, 生命変換 and 捧げ物 move energy around', () => {
    let state = withPlayer(emptyState(), 'player2', { currentEnergy: 3 });
    state = withPlayer(state, 'player1', { hand: [spellOf('drain', { kind: 'drainEnergy', amount: 2 }, 2), spellOf('life', { kind: 'lifeToEnergy', amount: 2 }, 0)], currentEnergy: 2 });
    let next = unwrap(castSpell(state, 'player1', 0));
    expect([next.players.player1.currentEnergy, next.players.player2.currentEnergy]).toEqual([1, 1]);
    next = unwrap(castSpell(next, 'player1', 0));
    expect([next.players.player1.currentEnergy, next.players.player1.specialCardHp]).toEqual([3, 15]);
    expect(castSpell(withPlayer(state, 'player1', { specialCardHp: 5 }), 'player1', 1).ok).toBe(false);

    let offer = withField(emptyState(), 'player1', 'frontRow', [monster('m011-0', { cost: 3 }), null, null]);
    offer = withPlayer(offer, 'player1', { hand: [spellOf('offer', { kind: 'sacrificeForEnergy', amount: 1 }, 1)], currentEnergy: 1 });
    expect(unwrap(castSpell(offer, 'player1', 0, { row: 'frontRow', index: 0 })).players.player1.currentEnergy).toBe(3); // 騎士のコスト3
  });

  it('大魔導師 gains 1 energy on the first spell each turn', () => {
    let state = withLeaderAbility(emptyState(), 'player1', { kind: 'spellEnergy', amount: 1 });
    state = withPlayer(state, 'player1', { hand: [spellOf('a', { kind: 'draw', amount: 1 }), spellOf('b', { kind: 'draw', amount: 1 })], currentEnergy: 2, deck: [monster('d1'), monster('d2')] });
    let next = unwrap(castSpell(state, 'player1', 0));
    expect(next.players.player1.currentEnergy).toBe(2);
    next = unwrap(castSpell(next, 'player1', 0));
    expect(next.players.player1.currentEnergy).toBe(1);
  });
});

describe('resource cards: drawing', () => {
  const deck = [monster('d1'), monster('d2'), monster('d3')];

  it('斥候 draws on summon, 伝令兵 draws when destroyed in the front row', () => {
    const scout = withAbility('sc', { kind: 'drawOnSummon', amount: 1 });
    const summoned = unwrap(playCard(withPlayer(emptyState(), 'player1', { hand: [scout], deck }), 'player1', 0, { row: 'frontRow', index: 0 }));
    expect(summoned.players.player1.hand.map(c => c.id)).toEqual(['d1']);
    let state = withField(emptyState(), 'player2', 'frontRow', [withAbility('ms', { kind: 'drawOnFrontDeath', amount: 1 }, { cardHp: 2 }), null, null]);
    state = withPlayer(withPlayer(state, 'player2', { deck }), 'player1', { hand: [fireSpell] });
    expect(unwrap(castSpell(state, 'player1', 0, { row: 'frontRow', index: 0 })).players.player2.hand.map(c => c.id)).toEqual(['d1']);
  });

  it('作戦会議 draws 2, 補給線 trades back-row monsters for cards', () => {
    let state = withField(emptyState(), 'player1', 'backRow', [monster('b1'), monster('b2'), null]);
    state = withField(state, 'player1', 'frontRow', [monster('f'), null, null]);
    state = withPlayer(state, 'player1', { hand: [spellOf('meeting', { kind: 'draw', amount: 2 }, 2), spellOf('supply', { kind: 'supplyLine', amount: 1 })], currentEnergy: 3, deck });
    let next = unwrap(castSpell(state, 'player1', 0));
    expect(next.players.player1.hand).toHaveLength(3);
    expect(castSpell(next, 'player1', 0, undefined, [{ row: 'frontRow', index: 0 }]).ok).toBe(false);
    next = unwrap(castSpell(next, 'player1', 0, undefined, [{ row: 'backRow', index: 0 }, { row: 'backRow', index: 1 }]));
    expect(next.players.player1.field.backRow).toEqual([null, null, null]);
    expect(next.players.player1.hand.map(c => c.id)).toEqual(['d1', 'd2', 'd3']);
  });

  it('戦利品 draws once, on the first enemy destroyed this turn', () => {
    let state = withField(emptyState(), 'player2', 'frontRow', [monster('a', { cardHp: 1 }), monster('b', { cardHp: 1 }), null]);
    state = withPlayer(state, 'player1', { hand: [spellOf('spoils', { kind: 'spoils', amount: 1 }), fireSpell, fireSpell], deck, currentEnergy: 5 });
    let next = unwrap(castSpell(state, 'player1', 0));
    next = unwrap(castSpell(next, 'player1', 0, { row: 'frontRow', index: 0 }));
    expect(next.players.player1.hand.map(c => c.id)).toEqual([fireSpell.id, 'd1']);
    next = unwrap(castSpell(next, 'player1', 0, { row: 'frontRow', index: 1 }));
    expect(next.players.player1.hand.map(c => c.id)).toEqual(['d1']);
  });

  it('墓荒らし returns a monster from the graveyard to the hand', () => {
    const state = withPlayer(emptyState(), 'player1', { hand: [spellOf('rob', { kind: 'graveRob', amount: 1 })], graveyard: [spell, monster('dead')] });
    const cast = unwrap(castSpell(state, 'player1', 0));
    expect(pickCard(cast, 'player1', 0).ok).toBe(false); // スペルは選べない
    const done = unwrap(pickCard(cast, 'player1', 1));
    expect(done.players.player1.hand.map(c => c.id)).toEqual(['dead']);
    expect(castSpell(withPlayer(state, 'player1', { graveyard: [] }), 'player1', 0).ok).toBe(false);
  });

  it('研究者 draws at the end of turn when 1 or less energy is left; 賢者 draws extra with a small hand', () => {
    let state = withField(emptyState(), 'player1', 'backRow', [withAbility('rs', { kind: 'drawIfLowEnergy', amount: 1, threshold: 1 }), null, null]);
    state = withPlayer(state, 'player1', { deck, currentEnergy: 1 });
    expect(endTurn(state).players.player1.hand).toHaveLength(1);
    expect(endTurn(withPlayer(state, 'player1', { currentEnergy: 2 })).players.player1.hand).toHaveLength(0);

    let sage = withLeaderAbility(emptyState(), 'player1', { kind: 'extraDrawWhenFewCards', handSize: 2, amount: 1 });
    sage = { ...withPlayer(sage, 'player1', { deck, hand: [monster('h1'), monster('h2')] }), phase: 'Draw' };
    expect(nextPhase(sage).players.player1.hand).toHaveLength(4);
  });
});

describe('resource cards: discarding', () => {
  const deck = [monster('d1'), monster('d2'), monster('d3')];

  it('狂戦士 makes its owner discard a card on summon', () => {
    const berserker = withAbility('bs', { kind: 'discardOnSummon', amount: 1 }, { frontAttack: 4 });
    const summoned = unwrap(playCard(withPlayer(emptyState(), 'player1', { hand: [berserker, monster('x')] }), 'player1', 0, { row: 'frontRow', index: 0 }));
    expect(summoned.pendingDiscard?.count).toBe(1);
  });

  it('錬成 discards one card and then draws two', () => {
    const state = withPlayer(emptyState(), 'player1', { hand: [spellOf('alchemy', { kind: 'discardDraw', amount: 2 }), monster('x')], deck });
    const done = unwrap(discardCards(unwrap(castSpell(state, 'player1', 0)), 'player1', [0]));
    expect(done.players.player1.hand.map(c => c.id)).toEqual(['d1', 'd2']);
  });

  it('火炎瓶 deals the discarded card\'s cost + 2 damage', () => {
    let state = withField(emptyState(), 'player2', 'frontRow', [monster('e', { cardHp: 9 }), null, null]);
    state = withPlayer(state, 'player1', { hand: [spellOf('bomb', { kind: 'firebomb', amount: 2 }), monster('fuel', { cost: 3 })] });
    const cast = unwrap(castSpell(state, 'player1', 0, { row: 'frontRow', index: 0 }));
    const done = unwrap(discardCards(cast, 'player1', [0]));
    expect(done.players.player2.field.frontRow[0]?.cardHp).toBe(9 - 5);
  });

  it('略奪 and 情報戦 make the opponent discard; 怨霊 and 幻影兵 strike back', () => {
    const wraith = withAbility('wr', { kind: 'damageWhenDiscarded', amount: 2 });
    let state = withField(emptyState(), 'player1', 'frontRow', [monster('mine', { cardHp: 2 }), null, null]);
    state = withPlayer(state, 'player2', { hand: [wraith] });
    state = withPlayer(state, 'player1', { hand: [spellOf('loot', { kind: 'randomDiscard', amount: 1 }, 2)], currentEnergy: 2 });
    const looted = unwrap(castSpell(state, 'player1', 0));
    expect(looted.players.player2.hand).toHaveLength(0);
    expect(looted.pendingReaction).toMatchObject({ player: 'player2', kind: 'damage', amount: 2 });
    expect(endTurn(looted)).toBe(looted); // 怨霊の持ち主が選ぶまで進めない
    expect(resolveReaction(looted, 'player2', { row: 'frontRow', index: 1 }).ok).toBe(false); // 空きは選べない
    const struck = unwrap(resolveReaction(looted, 'player2', { row: 'frontRow', index: 0 }));
    expect(struck.players.player1.field.frontRow[0]).toBeNull(); // 選んだモンスターに 2 ダメージ

    const phantom = withAbility('ph', { kind: 'summonWhenDiscarded' }, { frontAttack: 3, backAttack: 3 });
    let spy = withPlayer(emptyState(), 'player2', { hand: [phantom, spell] });
    spy = withPlayer(spy, 'player1', { hand: [spellOf('intel', { kind: 'reveal', amount: 1 })] });
    const revealed = unwrap(castSpell(spy, 'player1', 0));
    expect(revealed.pendingPick?.kind).toBe('opponentHand');
    expect(pickCard(revealed, 'player1', 0).ok).toBe(false); // モンスターは選べない
    expect(unwrap(pickCard(revealed, 'player1', 1)).players.player2.hand.map(c => c.id)).toEqual(['ph']);
    expect(unwrap(pickCard(revealed, 'player1', 1)).pendingReaction).toBeNull(); // スペルを捨てても反応はない
    // 自分の効果で捨てた幻影兵は場に出ない（相手の効果のときだけ）
    const own = withPlayer(emptyState(), 'player1', { hand: [spellOf('alchemy', { kind: 'discardDraw', amount: 1 }), phantom], deck });
    const discarded = unwrap(discardCards(unwrap(castSpell(own, 'player1', 0)), 'player1', [0]));
    expect(discarded.players.player1.field.frontRow.every(c => c === null)).toBe(true);
  });

  it('幻影兵 enters the slot its owner chooses when discarded by the opponent', () => {
    const phantom = withAbility('ph', { kind: 'summonWhenDiscarded' }, { frontAttack: 3, backAttack: 3 });
    let state = withField(withPlayer(emptyState(), 'player2', { hand: [phantom] }), 'player2', 'backRow', [monster('x'), null, null]);
    state = withPlayer(state, 'player1', { hand: [spellOf('loot', { kind: 'randomDiscard', amount: 1 }, 2)], currentEnergy: 2 });
    const next = unwrap(castSpell(state, 'player1', 0));
    expect(next.pendingReaction).toMatchObject({ player: 'player2', kind: 'summon' });
    expect(resolveReaction(next, 'player2', { row: 'backRow', index: 0 }).ok).toBe(false); // 埋まっている
    const placed = unwrap(resolveReaction(next, 'player2', { row: 'backRow', index: 2 }));
    expect(placed.players.player2.field.backRow[2]?.id).toBe('ph');
    expect(placed.players.player2.graveyard).toHaveLength(0);
  });

  it('仕切り直し discards the whole hand and draws the same number', () => {
    const state = withPlayer(emptyState(), 'player1', { hand: [spellOf('redo', { kind: 'reshuffle', amount: 1 }, 3), monster('a'), monster('b')], deck, currentEnergy: 3 });
    const next = unwrap(castSpell(state, 'player1', 0));
    expect(next.players.player1.hand.map(c => c.id)).toEqual(['d1', 'd2']);
    expect(next.players.player1.graveyard.map(c => c.id)).toEqual(expect.arrayContaining(['a', 'b']));
  });
});

describe('race mechanics', () => {
  const atk = (state: GameState) => inPhase(state, 'Attack');
  const target = (row: 'frontRow' | 'backRow', index: number) => ({ type: 'monster' as const, position: { row, index } });

  it('packBonus and allyRaceBonus raise attack power with allies of a race', () => {
    const pack = withAbility('p', { kind: 'packBonus', race: '戦士', amount: 1, max: 2 }, { race: '戦士', frontAttack: 1, backAttack: 0 });
    let state = withField(emptyState(), 'player1', 'frontRow', [pack, monster('a', { race: '戦士' }), monster('b', { race: '戦士' })]);
    state = withField(state, 'player1', 'backRow', [monster('c', { race: '戦士' }), null, null]);
    expect(getAttackPower(state, pack, 'frontRow')).toBe(1 + 2); // 3体いても最大 +2
    const goblin = withAbility('g', { kind: 'allyRaceBonus', race: 'オーク', fa: 2, ba: 0 }, { frontAttack: 3 });
    const alone = withField(emptyState(), 'player1', 'frontRow', [goblin, null, null]);
    expect(getAttackPower(alone, goblin, 'frontRow')).toBe(3);
    expect(getAttackPower(withField(alone, 'player1', 'backRow', [monster('o', { race: 'オーク' }), null, null]), goblin, 'frontRow')).toBe(5);
  });

  it('taunt forces attacks onto the taunting monster; leaderShield reduces leader damage', () => {
    let state = withField(emptyState(), 'player1', 'frontRow', [monster('a', { frontAttack: 3 }), null, null]);
    state = atk(withField(state, 'player2', 'frontRow', [monster('x'), withAbility('t', { kind: 'taunt' }, { cardHp: 9 }), null]));
    expect(attack(state, 'player1', { row: 'frontRow', index: 0 }, target('frontRow', 0)).ok).toBe(false);
    expect(attack(state, 'player1', { row: 'frontRow', index: 0 }, target('frontRow', 1)).ok).toBe(true);

    let shielded = withField(emptyState(), 'player1', 'frontRow', [monster('a', { frontAttack: 5 }), null, null]);
    shielded = atk(withField(shielded, 'player2', 'backRow', [withAbility('s', { kind: 'leaderShield', amount: 2 }), null, null]));
    expect(unwrap(attack(shielded, 'player1', { row: 'frontRow', index: 0 }, { type: 'player' })).players.player2.specialCardHp).toBe(20 - 3);
  });

  it('raceHpAura raises allies\' HP, and allies drop when the aura leaves', () => {
    const aura = withAbility('au', { kind: 'raceHpAura', race: 'ゴーレム', amount: 4 }, { race: 'ゴーレム', cardHp: 2 });
    let state = withField(emptyState(), 'player2', 'frontRow', [aura, monster('g', { race: 'ゴーレム', cardHp: 0 }), null]);
    expect(getEffectiveHp(state, 'player2', state.players.player2.field.frontRow[1]!)).toBe(4);
    state = withPlayer(state, 'player1', { hand: [fireSpell] });
    const next = unwrap(castSpell(state, 'player1', 0, { row: 'frontRow', index: 0 }));
    expect(next.players.player2.field.frontRow).toEqual([null, null, null]); // オーラが消えて HP 0 のゴーレムも倒れる
  });

  it('grow raises FA and max HP at the end of each own turn, up to the limit', () => {
    let state = withField(emptyState(), 'player1', 'frontRow', [withAbility('dr', { kind: 'grow', fa: 1, hp: 2, max: 2 }, { frontAttack: 1, cardHp: 4 }), null, null]);
    for (let i = 0; i < 3; i++) state = inPhase(endTurn(endTurn(state)), 'Play');
    expect(state.players.player1.field.frontRow[0]).toMatchObject({ frontAttack: 3, cardHp: 8, maxHp: 8, growth: 2 });
  });

  it('reach lets a front-row monster hit the back row past the front row', () => {
    let state = withField(emptyState(), 'player1', 'frontRow', [withAbility('r', { kind: 'reach' }, { frontAttack: 3 }), null, null]);
    state = withField(state, 'player2', 'frontRow', [monster('f'), null, null]);
    state = atk(withField(state, 'player2', 'backRow', [monster('b', { cardHp: 3 }), null, null]));
    expect(unwrap(attack(state, 'player1', { row: 'frontRow', index: 0 }, target('backRow', 0))).players.player2.field.backRow[0]).toBeNull();
  });

  it('onSummonTarget lets the summoner choose a damage, heal or debuff target', () => {
    const mage = withAbility('mg', { kind: 'onSummonTarget', effect: 'damage', amount: 4, row: 'backRow' });
    let state = withField(emptyState(), 'player2', 'frontRow', [monster('f', { cardHp: 4 }), null, null]);
    state = withField(state, 'player2', 'backRow', [monster('b', { cardHp: 4 }), null, null]);
    state = withPlayer(state, 'player1', { hand: [mage] });
    const summoned = unwrap(playCard(state, 'player1', 0, { row: 'backRow', index: 0 }));
    expect(summoned.pendingReaction).toMatchObject({ player: 'player1', kind: 'damage', amount: 4, row: 'backRow' });
    expect(resolveReaction(summoned, 'player1', { row: 'frontRow', index: 0 }).ok).toBe(false);
    expect(unwrap(resolveReaction(summoned, 'player1', { row: 'backRow', index: 0 })).players.player2.field.backRow[0]).toBeNull();

    const healer = withAbility('h', { kind: 'onSummonTarget', effect: 'heal', amount: 6 });
    let heal = withField(emptyState(), 'player1', 'frontRow', [monster('hurt', { cardHp: 2, maxHp: 10 }), null, null]);
    heal = unwrap(playCard(withPlayer(heal, 'player1', { hand: [healer] }), 'player1', 0, { row: 'backRow', index: 0 }));
    expect(unwrap(resolveReaction(heal, 'player1', { row: 'frontRow', index: 0 })).players.player1.field.frontRow[0]?.cardHp).toBe(8);

    const fairy = withAbility('fy', { kind: 'onSummonTarget', effect: 'debuff', amount: 2 });
    let debuff = withField(emptyState(), 'player2', 'frontRow', [monster('e', { frontAttack: 3, backAttack: 1 }), null, null]);
    debuff = unwrap(playCard(withPlayer(debuff, 'player1', { hand: [fairy] }), 'player1', 0, { row: 'backRow', index: 0 }));
    expect(unwrap(resolveReaction(debuff, 'player1', { row: 'frontRow', index: 0 })).players.player2.field.frontRow[0]).toMatchObject({ frontAttack: 1, backAttack: 0 });
  });

  it('summon effects: leader heal, energy steal and gain, opponent discard', () => {
    const play = (card: MonsterCard, changes = {}) => unwrap(playCard(withPlayer(withPlayer(emptyState(), 'player2', { currentEnergy: 3, hand: [spell] }), 'player1', { hand: [card], currentEnergy: 2, specialCardHp: 10, ...changes }), 'player1', 0, { row: 'backRow', index: 0 }));
    expect(play(withAbility('f', { kind: 'onSummonLeaderHeal', amount: 4 }, { cost: 1 })).players.player1.specialCardHp).toBe(14);
    const stolen = play(withAbility('t', { kind: 'energySteal', amount: 1 }, { cost: 1 }));
    expect([stolen.players.player1.currentEnergy, stolen.players.player2.currentEnergy]).toEqual([2, 2]);
    expect(play(withAbility('e', { kind: 'energyOnSummon', amount: 1 }, { cost: 1 })).players.player1.currentEnergy).toBe(2);
    expect(play(withAbility('d', { kind: 'onSummonDiscard', amount: 1 }, { cost: 1 })).players.player2.hand).toHaveLength(0);
  });

  it('moveBuff and doubleAttack', () => {
    const tracker = withAbility('tr', { kind: 'moveBuff', fa: 0, ba: 2 }, { frontAttack: 0, backAttack: 3 });
    const moved = unwrap(moveMonster(withField(emptyState(), 'player1', 'frontRow', [tracker, null, null]), 'player1', { row: 'frontRow', index: 0 }, { row: 'backRow', index: 0 }));
    expect(getAttackPower(moved, tracker, 'backRow')).toBe(5);

    let state = withField(emptyState(), 'player1', 'frontRow', [withAbility('da', { kind: 'doubleAttack' }, { frontAttack: 2 }), null, null]);
    state = atk(withField(state, 'player2', 'frontRow', [monster('e', { cardHp: 9 }), null, null]));
    state = unwrap(attack(state, 'player1', { row: 'frontRow', index: 0 }, target('frontRow', 0)));
    state = unwrap(attack(state, 'player1', { row: 'frontRow', index: 0 }, target('frontRow', 0)));
    expect(state.players.player2.field.frontRow[0]?.cardHp).toBe(5);
    expect(attack(state, 'player1', { row: 'frontRow', index: 0 }, target('frontRow', 0)).ok).toBe(false);
  });

  it('endTurnDamage hits an enemy from the back row at the end of the turn', () => {
    let state = withField(emptyState(), 'player1', 'backRow', [withAbility('fm', { kind: 'endTurnDamage', amount: 2 }), null, null]);
    state = withField(state, 'player2', 'frontRow', [monster('a', { cardHp: 9 }), monster('b', { cardHp: 2, cost: 3 }), null]);
    expect(endTurn(state).players.player2.field.frontRow[1]).toBeNull(); // 倒せるものを狙う
  });

  it('selfBoost pays energy or HP to raise attack power once per turn', () => {
    const goblin = withAbility('gb', { kind: 'selfBoost', energy: 1, hp: 0, fa: 2, ba: 0 }, { frontAttack: 2 });
    const state = withPlayer(withField(emptyState(), 'player1', 'frontRow', [goblin, null, null]), 'player1', { currentEnergy: 1 });
    const boosted = unwrap(boostMonster(state, 'player1', { row: 'frontRow', index: 0 }));
    expect([getAttackPower(boosted, goblin, 'frontRow'), boosted.players.player1.currentEnergy]).toEqual([4, 0]);
    expect(boostMonster(withPlayer(boosted, 'player1', { currentEnergy: 5 }), 'player1', { row: 'frontRow', index: 0 }).ok).toBe(false);
    const mad = withAbility('mg', { kind: 'selfBoost', energy: 0, hp: 3, fa: 2, ba: 2 }, { cardHp: 5 });
    const paidHp = unwrap(boostMonster(withField(emptyState(), 'player1', 'frontRow', [mad, null, null]), 'player1', { row: 'frontRow', index: 0 }));
    expect(paidHp.players.player1.field.frontRow[0]?.cardHp).toBe(2);
  });

  it('graveyardSummonOnSummon brings back a cheap monster from the graveyard', () => {
    const necro = withAbility('nc', { kind: 'graveyardSummonOnSummon', maxCost: 2 }, { cost: 3 });
    const state = withPlayer(emptyState(), 'player1', { hand: [necro], currentEnergy: 3, graveyard: [monster('big', { cost: 3 }), monster('small', { cost: 2, frontAttack: 3, backAttack: 0 })] });
    const summoned = unwrap(playCard(state, 'player1', 0, { row: 'backRow', index: 0 }));
    expect(summoned.pendingPick).toMatchObject({ kind: 'graveyardSummon', maxCost: 2 });
    expect(pickCard(summoned, 'player1', 0).ok).toBe(false);
    const revived = unwrap(pickCard(summoned, 'player1', 1));
    expect(revived.players.player1.field.frontRow[0]?.id).toBe('small');
    expect(unwrap(pickCard(summoned, 'player1', null)).pendingPick).toBeNull();
  });

  it('lifesteal, deathDamage and returnOnDeath', () => {
    let state = withField(emptyState(), 'player1', 'frontRow', [withAbility('v', { kind: 'lifesteal' }, { frontAttack: 4, cardHp: 2, maxHp: 10 }), null, null]);
    state = atk(withField(state, 'player2', 'frontRow', [monster('e', { cardHp: 9 }), null, null]));
    expect(unwrap(attack(state, 'player1', { row: 'frontRow', index: 0 }, target('frontRow', 0))).players.player1.field.frontRow[0]?.cardHp).toBe(6);

    let wisp = withField(emptyState(), 'player2', 'frontRow', [withAbility('w', { kind: 'deathDamage', amount: 3 }, { cardHp: 1 }), null, null]);
    wisp = withField(wisp, 'player1', 'frontRow', [monster('mine', { cardHp: 3 }), null, null]);
    wisp = withPlayer(wisp, 'player1', { hand: [fireSpell] });
    const killed = unwrap(castSpell(wisp, 'player1', 0, { row: 'frontRow', index: 0 }));
    expect(killed.pendingReaction).toMatchObject({ player: 'player2', kind: 'damage', amount: 3 });
    expect(unwrap(resolveReaction(killed, 'player2', { row: 'frontRow', index: 0 })).players.player1.field.frontRow[0]).toBeNull();

    let soul = withField(emptyState(), 'player2', 'frontRow', [withAbility('s', { kind: 'returnOnDeath' }, { cardHp: 1 }), null, null]);
    soul = withPlayer(soul, 'player1', { hand: [fireSpell] });
    const returned = unwrap(castSpell(soul, 'player1', 0, { row: 'frontRow', index: 0 }));
    expect([returned.players.player2.hand.map(c => c.id), returned.players.player2.graveyard]).toEqual([['s'], []]);
  });

  it('fusionSummon sends allies of the race to the graveyard to summon for free', () => {
    const king = withAbility('ks', { kind: 'fusionSummon', race: 'スライム', count: 3 }, { cost: 5, race: 'スライム' });
    const slime = (id: string, cost = 1) => monster(id, { race: 'スライム', cost });
    let state = withField(emptyState(), 'player1', 'frontRow', [slime('s1'), slime('s2', 2), null]);
    state = withPlayer(state, 'player1', { hand: [king], currentEnergy: 0 });
    expect(playCard(state, 'player1', 0, { row: 'frontRow', index: 2 }, { payBySacrifice: true }).ok).toBe(false); // 2体しかいない
    state = withField(state, 'player1', 'backRow', [slime('s3'), slime('s4'), null]);
    const fused = unwrap(playCard(state, 'player1', 0, { row: 'frontRow', index: 1 }, { payBySacrifice: true }));
    expect(fused.players.player1.field.frontRow[1]?.id).toBe('ks');
    expect(fused.players.player1.graveyard.map(c => c.id).sort()).toEqual(['s1', 's2', 's3']); // 選んだ位置の s2 と、コストの低いもの
  });

  it('orc restrictions: summon turn, must move, and energy per attack', () => {
    const attackFrom = (card: MonsterCard, changes: Partial<GameState['turnState']> = {}, energy = 0) => {
      let state = withField(emptyState(), 'player1', 'frontRow', [card, null, null]);
      state = withPlayer(atk(withField(state, 'player2', 'frontRow', [monster('e', { cardHp: 9 }), null, null])), 'player1', { currentEnergy: energy });
      return attack({ ...state, turnState: { ...state.turnState, ...changes } }, 'player1', { row: 'frontRow', index: 0 }, target('frontRow', 0));
    };
    const fresh = withAbility('o1', { kind: 'noAttackOnSummonTurn' });
    expect(attackFrom(fresh, { summonedThisTurnIds: ['o1'] }).ok).toBe(false);
    expect(attackFrom(fresh).ok).toBe(true);
    const mover = withAbility('o2', { kind: 'mustMoveToAttack' });
    expect(attackFrom(mover).ok).toBe(false);
    expect(attackFrom(mover, { movedIds: ['o2'] }).ok).toBe(true);
    const costly = withAbility('o3', { kind: 'attackEnergyCost', amount: 1 });
    expect(attackFrom(costly).ok).toBe(false);
    expect(unwrap(attackFrom(costly, {}, 2)).players.player1.currentEnergy).toBe(1);
  });
});

