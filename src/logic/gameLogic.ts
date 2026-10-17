import { MonsterCard, getSpellTargetSide, isMonster } from '../types/card';
import {
  AttackTarget,
  FieldPosition,
  GameState,
  Phase,
  PlayerId,
  PlayerState,
  Row,
} from '../types/gameState';
import { getMaxHp, toOriginalCard } from './cards';
import { createInitialTurnState } from './initialState';
import { RULES } from './rules';

// ゲームのルールをまとめた純粋関数群。
// どの関数も引数の state を書き換えず、新しい state を返す。
// プレイヤーの行動はルール違反なら { ok: false, error } を返す（AI も同じ関数を使う）。

export type ActionResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string };

const success = (state: GameState): ActionResult => ({ ok: true, state });
const failure = (error: string): ActionResult => ({ ok: false, error });

export const ROWS: Row[] = ['frontRow', 'backRow'];

export const getOpponent = (player: PlayerId): PlayerId =>
  player === 'player1' ? 'player2' : 'player1';

export const otherRow = (row: Row): Row => (row === 'frontRow' ? 'backRow' : 'frontRow');

// --- 状態の参照 ---

export const getCardAt = (state: GameState, player: PlayerId, position: FieldPosition): MonsterCard | null =>
  state.players[player].field[position.row][position.index] ?? null;

// 場にいるモンスターの位置の一覧（rows で列を絞り込める）
export const getMonsterPositions = (state: GameState, player: PlayerId, rows: Row[] = ROWS): FieldPosition[] =>
  rows.flatMap(row =>
    state.players[player].field[row].flatMap((card, index) => (card ? [{ row, index }] : [])),
  );

export const findEmptySlot = (state: GameState, player: PlayerId, row: Row): FieldPosition | null => {
  const index = state.players[player].field[row].findIndex(slot => slot === null);
  return index === -1 ? null : { row, index };
};

export const hasFrontRowMonsters = (playerState: PlayerState): boolean =>
  playerState.field.frontRow.some(card => card !== null);

// 攻撃の呪文のバフはFA（前衛での攻撃力）にのみ適用される
// 先手の1ターン目（ゲーム全体の1ターン目）は攻撃できない
export const canAttackThisTurn = (state: GameState): boolean => state.turn > 1;

export const getAttackPower = (state: GameState, card: MonsterCard, row: Row): number =>
  row === 'frontRow'
    ? card.frontAttack + (state.turnState.attackBuffs[card.id] ?? 0)
    : card.backAttack;

// --- 状態の更新ヘルパー ---

const updatePlayer = (
  state: GameState,
  player: PlayerId,
  update: (playerState: PlayerState) => PlayerState,
): GameState => ({
  ...state,
  players: { ...state.players, [player]: update(state.players[player]) },
});

const updateTurnState = (state: GameState, update: Partial<GameState['turnState']>): GameState => ({
  ...state,
  turnState: { ...state.turnState, ...update },
});

const setSlot = (
  field: PlayerState['field'],
  position: FieldPosition,
  card: MonsterCard | null,
): PlayerState['field'] => ({
  ...field,
  [position.row]: field[position.row].map((slot, i) => (i === position.index ? card : slot)),
});

// 手札からカードを取り除き、コストを支払う
const payFromHand = (playerState: PlayerState, handIndex: number, cost: number): PlayerState => ({
  ...playerState,
  currentEnergy: playerState.currentEnergy - cost,
  hand: playerState.hand.filter((_, i) => i !== handIndex),
});

// モンスターにダメージを与え、HPが0以下になったら元の能力値に戻して墓地へ送る
const damageMonster = (state: GameState, player: PlayerId, position: FieldPosition, amount: number): GameState => {
  const card = getCardAt(state, player, position);
  if (!card) return state;
  const newHp = card.cardHp - amount;
  return updatePlayer(state, player, p =>
    newHp <= 0
      ? { ...p, field: setSlot(p.field, position, null), graveyard: [...p.graveyard, toOriginalCard(card)] }
      : { ...p, field: setSlot(p.field, position, { ...card, cardHp: newHp }) },
  );
};

// 大将カードにダメージを与え、HPが0以下になったら相手の勝利とする
const damageSpecialCard = (state: GameState, player: PlayerId, amount: number): GameState => {
  const next = updatePlayer(state, player, p => ({ ...p, specialCardHp: p.specialCardHp - amount }));
  return next.players[player].specialCardHp <= 0 && !next.winner
    ? { ...next, winner: getOpponent(player) }
    : next;
};

// 行動できるのは、自分のターンの指定フェイズ中だけ
const checkTurn = (state: GameState, player: PlayerId, phase: Phase): string | null => {
  if (state.winner) return 'ゲームは終了しています。';
  if (state.currentPlayer !== player) return '自分のターンではありません。';
  if (state.phase !== phase) return `${phase} フェイズではありません。`;
  return null;
};

// --- フェイズ・ターン進行 ---

// 山札が尽きた状態で自分のターンを迎えたら、ドローの代わりに大将カードがダメージを受ける。
// 最後の1枚を引いたターンや、そのターン中に山札が補充された場合は、次のターン開始時に山札が残っているので対象外。
const drawPhase = (state: GameState): GameState => {
  const player = state.currentPlayer;
  const afterDeckOut = state.players[player].deck.length === 0
    ? damageSpecialCard(state, player, RULES.deckOutDamage)
    : state;
  const next = updatePlayer(afterDeckOut, player, playerState => {
    const [drawnCard, ...deck] = playerState.deck;
    return {
      ...playerState,
      deck,
      hand: drawnCard ? [...playerState.hand, drawnCard] : playerState.hand,
      currentEnergy: Math.min(playerState.currentEnergy + 1, playerState.maxEnergy),
    };
  });
  return { ...next, phase: 'Play' };
};

export const endTurn = (state: GameState): GameState => {
  if (state.winner) return state;
  return {
    ...state,
    turn: state.turn + 1,
    currentPlayer: getOpponent(state.currentPlayer),
    phase: 'Draw',
    turnState: createInitialTurnState(),
  };
};

export const nextPhase = (state: GameState): GameState => {
  if (state.winner) return state;
  switch (state.phase) {
    case 'Draw': return drawPhase(state);
    case 'Play': return canAttackThisTurn(state) ? { ...state, phase: 'Attack' } : endTurn(state);
    case 'Attack': return endTurn(state);
  }
};

// --- プレイヤーの行動 ---

export const playCard = (
  state: GameState,
  player: PlayerId,
  handIndex: number,
  position: FieldPosition,
): ActionResult => {
  const turnError = checkTurn(state, player, 'Play');
  if (turnError) return failure(turnError);
  const playerState = state.players[player];
  const card = playerState.hand[handIndex];
  if (!card) return failure('カードが選択されていません。');
  if (!isMonster(card)) return failure('スペルカードは味方モンスターを選んで使用してください。');
  if (playerState.currentEnergy < card.cost) return failure('エネルギーが足りません！');
  if (getCardAt(state, player, position)) return failure('そのスロットには既にカードがあります。');

  const next = updatePlayer(state, player, p => ({
    ...payFromHand(p, handIndex, card.cost),
    field: setSlot(p.field, position, card),
  }));
  return success(updateTurnState(next, {
    summonedThisTurnIds: [...next.turnState.summonedThisTurnIds, card.id],
  }));
};

// スペルを使う。対象は効果に応じて、味方（ダメージ以外）または相手（ダメージ）の場のモンスター
export const castSpell = (
  state: GameState,
  player: PlayerId,
  handIndex: number,
  targetPosition: FieldPosition,
): ActionResult => {
  const turnError = checkTurn(state, player, 'Play');
  if (turnError) return failure(turnError);
  const playerState = state.players[player];
  const spell = playerState.hand[handIndex];
  if (!spell || isMonster(spell)) return failure('スペルカードが選択されていません。');
  const targetSide = getSpellTargetSide(spell);
  const targetPlayer = targetSide === 'ally' ? player : getOpponent(player);
  const target = getCardAt(state, targetPlayer, targetPosition);
  if (!target) {
    return failure(targetSide === 'ally' ? '対象の味方モンスターを選んでください。' : '対象の相手モンスターを選んでください。');
  }
  if (playerState.currentEnergy < spell.cost) return failure('エネルギーが足りません！');
  if (spell.effect.kind === 'heal' && target.cardHp >= getMaxHp(target)) {
    return failure('このモンスターはダメージを受けていません。');
  }

  const paid = updatePlayer(state, player, p => ({
    ...payFromHand(p, handIndex, spell.cost),
    graveyard: [...p.graveyard, spell],
  }));

  const { effect } = spell;
  switch (effect.kind) {
    case 'buffFa': {
      const { attackBuffs } = paid.turnState;
      return success(updateTurnState(paid, {
        attackBuffs: { ...attackBuffs, [target.id]: (attackBuffs[target.id] ?? 0) + effect.amount },
      }));
    }
    case 'heal': {
      const healed = { ...target, cardHp: Math.min(target.cardHp + effect.amount, getMaxHp(target)) };
      return success(updatePlayer(paid, player, p => ({ ...p, field: setSlot(p.field, targetPosition, healed) })));
    }
    case 'damage':
      return success(damageMonster(paid, targetPlayer, targetPosition, effect.amount));
  }
};

export const moveMonster = (
  state: GameState,
  player: PlayerId,
  from: FieldPosition,
  to: FieldPosition,
): ActionResult => {
  const turnError = checkTurn(state, player, 'Play');
  if (turnError) return failure(turnError);
  const card = getCardAt(state, player, from);
  if (!card) return failure('移動するモンスターがいません。');
  if (state.turnState.hasMoved) return failure('モンスターの移動は1ターンに1回までです。');
  if (state.turnState.summonedThisTurnIds.includes(card.id)) {
    return failure('このモンスターは召喚されたターンには移動できません。');
  }
  if (from.row === to.row) return failure('同じ列の中では移動できません。');
  if (getCardAt(state, player, to)) return failure('移動先には既にカードがあります。');

  const next = updatePlayer(state, player, p => ({
    ...p,
    field: setSlot(setSlot(p.field, from, null), to, card),
  }));
  return success(updateTurnState(next, { hasMoved: true }));
};

export const attack = (
  state: GameState,
  attackerPlayer: PlayerId,
  attackerPosition: FieldPosition,
  target: AttackTarget,
): ActionResult => {
  const turnError = checkTurn(state, attackerPlayer, 'Attack');
  if (turnError) return failure(turnError);
  if (!canAttackThisTurn(state)) return failure('先手の1ターン目は攻撃できません。');
  const attacker = getCardAt(state, attackerPlayer, attackerPosition);
  if (!attacker) return failure('攻撃するモンスターがいません。');
  if (state.turnState.attackedMonsterIds.includes(attacker.id)) {
    return failure('このモンスターは既に攻撃済みです。');
  }

  const defender = getOpponent(attackerPlayer);
  const frontRowBlocked = hasFrontRowMonsters(state.players[defender]);
  const attackPower = getAttackPower(state, attacker, attackerPosition.row);

  let next: GameState;
  if (target.type === 'monster') {
    if (!getCardAt(state, defender, target.position)) return failure('攻撃対象のモンスターがいません。');
    if (target.position.row === 'backRow' && frontRowBlocked) {
      return failure('前衛にモンスターがいるため、後衛を攻撃できません。');
    }
    next = damageMonster(state, defender, target.position, attackPower);
  } else {
    if (frontRowBlocked) return failure('前衛にモンスターがいるため、直接攻撃できません。');
    next = damageSpecialCard(state, defender, attackPower);
  }

  return success(updateTurnState(next, {
    attackedMonsterIds: [...next.turnState.attackedMonsterIds, attacker.id],
  }));
};
