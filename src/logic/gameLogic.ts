import { Card } from '../types/card';
import {
  AttackTarget,
  FieldPosition,
  GameState,
  PlayerId,
  PlayerState,
  Row,
} from '../types/gameState';
import { ATTACK_SPELL_ID, getBaseCardId } from './cards';
import { createInitialTurnState } from './initialState';
import { RULES } from './rules';

// ゲームのルールをまとめた純粋関数群。
// どの関数も引数の state を書き換えず、新しい state を返す。

export type ActionResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string };

const success = (state: GameState): ActionResult => ({ ok: true, state });
const failure = (error: string): ActionResult => ({ ok: false, error });

export const ROWS: Row[] = ['frontRow', 'backRow'];

export const getOpponent = (player: PlayerId): PlayerId =>
  player === 'player1' ? 'player2' : 'player1';

const updatePlayer = (
  state: GameState,
  player: PlayerId,
  update: (playerState: PlayerState) => PlayerState,
): GameState => ({
  ...state,
  players: { ...state.players, [player]: update(state.players[player]) },
});

const setSlot = (
  field: PlayerState['field'],
  position: FieldPosition,
  card: Card | null,
): PlayerState['field'] => ({
  ...field,
  [position.row]: field[position.row].map((slot, i) => (i === position.index ? card : slot)),
});

// 大将カードにダメージを与え、HPが0以下になったら相手の勝利とする
const damageSpecialCard = (state: GameState, player: PlayerId, amount: number): GameState => {
  const next = updatePlayer(state, player, p => ({ ...p, specialCardHp: p.specialCardHp - amount }));
  return next.players[player].specialCardHp <= 0 && !next.winner
    ? { ...next, winner: getOpponent(player) }
    : next;
};

export const getCardAt = (state: GameState, player: PlayerId, position: FieldPosition): Card | null =>
  state.players[player].field[position.row][position.index] ?? null;

export const hasFrontRowMonsters = (playerState: PlayerState): boolean =>
  playerState.field.frontRow.some(card => card !== null);

// 攻撃の呪文のバフはFA（前衛での攻撃力）にのみ適用される
export const getAttackPower = (state: GameState, card: Card, row: Row): number => {
  if (row === 'frontRow') {
    return (card.frontAttack ?? 0) + (state.turnState.attackBuffs[card.id] ?? 0);
  }
  return card.backAttack ?? 0;
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
    case 'Play': return { ...state, phase: 'Attack' };
    default: return endTurn(state);
  }
};

// --- プレイヤーの行動 ---

export const playCard = (
  state: GameState,
  player: PlayerId,
  handIndex: number,
  position: FieldPosition,
): ActionResult => {
  const playerState = state.players[player];
  const card = playerState.hand[handIndex];
  if (!card) return failure('カードが選択されていません。');
  if (card.type !== 'Monster') return failure('スペルカードは味方モンスターを選んで使用してください。');
  if (playerState.currentEnergy < card.cost) return failure('エネルギーが足りません！');
  if (getCardAt(state, player, position)) return failure('そのスロットには既にカードがあります。');

  const next = updatePlayer(state, player, p => ({
    ...p,
    currentEnergy: p.currentEnergy - card.cost,
    hand: p.hand.filter((_, i) => i !== handIndex),
    field: setSlot(p.field, position, card),
  }));
  return success({
    ...next,
    turnState: {
      ...next.turnState,
      summonedThisTurnIds: [...next.turnState.summonedThisTurnIds, card.id],
    },
  });
};

const isAttackSpell = (card: Card) => getBaseCardId(card) === ATTACK_SPELL_ID;

export const castSpell = (
  state: GameState,
  player: PlayerId,
  handIndex: number,
  targetPosition: FieldPosition,
): ActionResult => {
  const playerState = state.players[player];
  const spell = playerState.hand[handIndex];
  const target = getCardAt(state, player, targetPosition);
  if (!spell || spell.type !== 'Spell') return failure('スペルカードが選択されていません。');
  if (!target) return failure('対象のモンスターがいません。');
  if (playerState.currentEnergy < spell.cost) return failure('エネルギーが足りません！');

  let next = updatePlayer(state, player, p => ({
    ...p,
    currentEnergy: p.currentEnergy - spell.cost,
    hand: p.hand.filter((_, i) => i !== handIndex),
    graveyard: [...p.graveyard, spell],
  }));

  if (isAttackSpell(spell)) {
    const { attackBuffs } = next.turnState;
    next = {
      ...next,
      turnState: {
        ...next.turnState,
        attackBuffs: { ...attackBuffs, [target.id]: (attackBuffs[target.id] ?? 0) + 1 },
      },
    };
  }
  return success(next);
};

export const moveMonster = (
  state: GameState,
  player: PlayerId,
  from: FieldPosition,
  to: FieldPosition,
): ActionResult => {
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
  return success({ ...next, turnState: { ...next.turnState, hasMoved: true } });
};

export const attack = (
  state: GameState,
  attackerPlayer: PlayerId,
  attackerPosition: FieldPosition,
  target: AttackTarget,
): ActionResult => {
  if (state.winner) return failure('ゲームは終了しています。');
  const attacker = getCardAt(state, attackerPlayer, attackerPosition);
  if (!attacker || attacker.type !== 'Monster') return failure('攻撃するモンスターがいません。');
  if (state.turnState.attackedMonsterIds.includes(attacker.id)) {
    return failure('このモンスターは既に攻撃済みです。');
  }

  const defender = getOpponent(attackerPlayer);
  const defenderState = state.players[defender];
  const frontRowBlocked = hasFrontRowMonsters(defenderState);
  const attackPower = getAttackPower(state, attacker, attackerPosition.row);

  let next: GameState;
  if (target.type === 'monster') {
    const targetCard = getCardAt(state, defender, target.position);
    if (!targetCard || targetCard.cardHp === undefined) return failure('攻撃対象のモンスターがいません。');
    if (target.position.row === 'backRow' && frontRowBlocked) {
      return failure('前衛にモンスターがいるため、後衛を攻撃できません。');
    }
    const newHp = targetCard.cardHp - attackPower;
    next = updatePlayer(state, defender, p =>
      newHp <= 0
        ? { ...p, field: setSlot(p.field, target.position, null), graveyard: [...p.graveyard, targetCard] }
        : { ...p, field: setSlot(p.field, target.position, { ...targetCard, cardHp: newHp }) },
    );
  } else {
    if (frontRowBlocked) return failure('前衛にモンスターがいるため、直接攻撃できません。');
    next = damageSpecialCard(state, defender, attackPower);
  }

  return success({
    ...next,
    turnState: {
      ...next.turnState,
      attackedMonsterIds: [...next.turnState.attackedMonsterIds, attacker.id],
    },
  });
};

// --- AI ---

const findEmptySlot = (playerState: PlayerState, row: Row): FieldPosition | null => {
  const index = playerState.field[row].findIndex(slot => slot === null);
  return index === -1 ? null : { row, index };
};

// 出せるモンスターを手札の先頭から順に、BAが高ければ後衛、そうでなければ前衛に出す
export const runAiPlayPhase = (state: GameState, player: PlayerId): GameState => {
  let current = state;
  let handIndex = 0;
  while (handIndex < current.players[player].hand.length) {
    const playerState = current.players[player];
    const card = playerState.hand[handIndex];
    const preferredRow: Row = (card.backAttack ?? 0) > (card.frontAttack ?? 0) ? 'backRow' : 'frontRow';
    const slot = findEmptySlot(playerState, preferredRow);
    const result = card.type === 'Monster' && slot ? playCard(current, player, handIndex, slot) : null;
    if (result?.ok) {
      current = result.state; // 手札が1枚減るので同じ index を再確認する
    } else {
      handIndex++;
    }
  }
  return current;
};

// 攻撃可能な全モンスターで、相手の前衛（いなければプレイヤー本体）を攻撃する
export const runAiAttackPhase = (state: GameState, player: PlayerId): GameState => {
  const defender = getOpponent(player);
  const attackerPositions = ROWS.flatMap(row =>
    state.players[player].field[row].map((_, index): FieldPosition => ({ row, index })),
  );
  return attackerPositions.reduce((current, attackerPosition) => {
    const attacker = getCardAt(current, player, attackerPosition);
    if (!attacker || current.winner || getAttackPower(current, attacker, attackerPosition.row) <= 0) return current;

    const targetIndex = current.players[defender].field.frontRow.findIndex(card => card !== null);
    const target: AttackTarget = targetIndex === -1
      ? { type: 'player' }
      : { type: 'monster', position: { row: 'frontRow', index: targetIndex } };
    const result = attack(current, player, attackerPosition, target);
    return result.ok ? result.state : current;
  }, state);
};
