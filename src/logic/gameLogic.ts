import { Card, LeaderAbility, MonsterCard, SpellCard, getSpellTargetSide, isImplementedEffect, isMonster, isUntargetedSpell } from '../types/card';
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

// ラウンド：先手と後手のターンを1組とした数（turn 1・2 がラウンド1、turn 3・4 がラウンド2 …）
export const getRound = (turn: number): number => Math.ceil(turn / 2);

// 先手の1ターン目（ゲーム全体の1ターン目）は攻撃できない
export const canAttackThisTurn = (state: GameState): boolean => state.turn > 1;

// 場にいるモンスターの持ち主（場にいなければ null）
const ownerOf = (state: GameState, cardId: string): PlayerId | null =>
  (['player1', 'player2'] as PlayerId[]).find(player =>
    ROWS.some(row => state.players[player].field[row].some(card => card?.id === cardId))) ?? null;

// 攻撃力：前衛なら FA、後衛なら BA に、上げる効果（スペル・突撃兵・大将の効果）を足したもの
export const getAttackPower = (state: GameState, card: MonsterCard, row: Row): number => {
  const { turnState } = state;
  if (row === 'frontRow') {
    const charge = card.ability?.kind === 'charge' && turnState.movedToFrontIds.includes(card.id) ? card.ability.amount : 0;
    return card.frontAttack + (turnState.attackBuffs[card.id] ?? 0) + charge;
  }
  const owner = ownerOf(state, card.id);
  const leaderAbility = owner ? getActiveLeaderAbility(state, owner) : undefined;
  const leaderBonus = owner && leaderAbility?.kind === 'backRowBaBonus' && isLeaderHpLowEnough(state, owner, leaderAbility.hpRatio)
    ? leaderAbility.amount
    : 0;
  return card.backAttack + (turnState.backAttackBuffs[card.id] ?? 0) + leaderBonus;
};

// --- 大将カードの効果 ---

export const isLeaderActive = (state: GameState, player: PlayerId): boolean =>
  !state.turnState.disabledLeaders.includes(player);

// 大将の HP が最大 HP × ratio 以下か（ratio がなければ条件なし）
const isLeaderHpLowEnough = (state: GameState, player: PlayerId, ratio?: number): boolean => {
  const { specialCardHp, leader } = state.players[player];
  return ratio === undefined || specialCardHp <= leader.maxHp * ratio;
};

// 今働いている大将の効果（指揮低下でなくなっていれば undefined）
const getActiveLeaderAbility = (state: GameState, player: PlayerId): LeaderAbility | undefined =>
  isLeaderActive(state, player) ? state.players[player].leader.ability : undefined;

// 大将カードの効果で上がっている HP（owner はそのモンスターの持ち主）
export const getHpBonus = (state: GameState, owner: PlayerId, card: MonsterCard): number => {
  const ability = getActiveLeaderAbility(state, owner);
  return ability?.kind === 'raceHpBonus' && card.race === ability.race ? ability.amount : 0;
};

// 召喚のコスト（伏兵：相手の場のモンスターが自分より多いと下がる）
// 援軍要請：次に召喚するモンスターのコストが下がる
export const getSummonCost = (state: GameState, player: PlayerId, card: MonsterCard): number => {
  const ambush = card.ability?.kind === 'ambush' && countMonsters(state, getOpponent(player)) > countMonsters(state, player)
    ? card.ability.amount
    : 0;
  return Math.max(0, card.cost - ambush - state.turnState.summonDiscount);
};

// スペルのコスト（魔導書・伝令官で下がる。見習い魔導士の効果で使うときは 0）
export const getSpellCost = (state: GameState, spell: SpellCard): number =>
  state.pendingFreeSpell && spell.cost <= state.pendingFreeSpell.maxCost ? 0 : Math.max(0, spell.cost - state.turnState.spellDiscount);

export const countMonsters = (state: GameState, player: PlayerId): number => getMonsterPositions(state, player).length;

// 1回だけ使える大将の効果（rallyEnergy）を、いま使えるか
export const canUseLeaderAbility = (state: GameState, player: PlayerId): boolean => {
  const { leader, specialCardHp, leaderAbilityUsed } = state.players[player];
  const ability = leader.ability;
  return ability?.kind === 'rallyEnergy' && !leaderAbilityUsed && isLeaderActive(state, player)
    && specialCardHp <= rallyThreshold(leader.maxHp, ability) && !checkTurn(state, player, 'Play');
};

// 1回だけ使える大将の効果を使える HP（割合で決まっていれば最大 HP から計算する）
const rallyThreshold = (maxHp: number, ability: { hpThreshold?: number; hpRatio?: number }): number =>
  ability.hpRatio !== undefined ? Math.floor(maxHp * ability.hpRatio) : ability.hpThreshold ?? 0;

// 移動できなくなっているモンスターか（強制移動の効果）
export const isMoveLocked = (state: GameState, player: PlayerId, cardId: string): boolean =>
  state.moveLocks.some(lock => lock.player === player && lock.cardId === cardId);

// コストを払わずに使えるスペルか（召喚したときの効果）
const isFreeSpellCandidate = (card: Card, maxCost: number): boolean =>
  !isMonster(card) && isImplementedEffect(card.effect) && card.cost <= maxCost;

// 大将カードの効果を含めた今の HP（倒されるかどうかはこれで判定する）
export const getEffectiveHp = (state: GameState, owner: PlayerId, card: MonsterCard): number =>
  card.cardHp + getHpBonus(state, owner, card);

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

// 移動したあとの効果：後衛から前衛へ動いたことの記録（突撃兵）と、大将の効果での回復（軍師）
const afterMoved = (state: GameState, player: PlayerId, to: FieldPosition, fromRow: Row): GameState => {
  const card = getCardAt(state, player, to);
  if (!card || fromRow === to.row) return state;
  let next = fromRow === 'backRow'
    ? updateTurnState(state, { movedToFrontIds: [...state.turnState.movedToFrontIds, card.id] })
    : state;
  const ability = getActiveLeaderAbility(next, player);
  if (ability?.kind === 'healOnMove') {
    const healed = { ...card, cardHp: Math.min(card.cardHp + ability.amount, getMaxHp(card)) };
    next = updatePlayer(next, player, p => ({ ...p, field: setSlot(p.field, to, healed) }));
  }
  return next;
};

// a と b のモンスターを入れ替える（片方が空なら、ただの移動）
const swapMonsters = (state: GameState, player: PlayerId, a: FieldPosition, b: FieldPosition): GameState => {
  const cardA = getCardAt(state, player, a);
  const cardB = getCardAt(state, player, b);
  let next = updatePlayer(state, player, p => ({ ...p, field: setSlot(setSlot(p.field, a, cardB), b, cardA) }));
  if (cardA) next = afterMoved(next, player, b, a.row);
  if (cardB) next = afterMoved(next, player, a, b.row);
  return next;
};

// 反対の列の移動先：同じ位置。埋まっていれば反対の列の空いている一番左（どこも埋まっていれば null）
const otherRowDestination = (state: GameState, player: PlayerId, from: FieldPosition): FieldPosition | null => {
  const sameColumn = { row: otherRow(from.row), index: from.index };
  return getCardAt(state, player, sameColumn) ? findEmptySlot(state, player, sameColumn.row) : sameColumn;
};

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
  // 盾兵：前衛にいるとき受けるダメージが減る
  const reduction = card.ability?.kind === 'frontGuard' && position.row === 'frontRow' ? card.ability.amount : 0;
  const newHp = card.cardHp - Math.max(0, amount - reduction);
  if (newHp + getHpBonus(state, player, card) > 0) {
    return updatePlayer(state, player, p => ({ ...p, field: setSlot(p.field, position, { ...card, cardHp: newHp }) }));
  }
  return onDestroyed(sendToGraveyard(state, player, position), player, card, position);
};

// 場のモンスターを元の能力値に戻して墓地へ送る
const sendToGraveyard = (state: GameState, player: PlayerId, position: FieldPosition): GameState => {
  const card = getCardAt(state, player, position);
  if (!card) return state;
  return updatePlayer(state, player, p => ({ ...p, field: setSlot(p.field, position, null), graveyard: [...p.graveyard, toOriginalCard(card)] }));
};

// 倒されたときの効果：伝令兵（前衛で倒されたら持ち主が引く）と戦利品（相手のモンスターを倒したら引く）
const onDestroyed = (state: GameState, owner: PlayerId, card: MonsterCard, position: FieldPosition): GameState => {
  let next = state;
  const { ability } = card;
  if (ability?.kind === 'drawOnFrontDeath' && position.row === 'frontRow') {
    next = updatePlayer(next, owner, p => drawCards(p, ability.amount));
  }
  const { spoilsDraw } = next.turnState;
  if (spoilsDraw > 0 && owner !== next.currentPlayer) {
    next = updateTurnState(updatePlayer(next, next.currentPlayer, p => drawCards(p, spoilsDraw)), { spoilsDraw: 0 });
  }
  return next;
};

// 大将カードの効果がなくなるなどして HP が 0 以下になったモンスターを墓地へ送る
const removeDefeatedMonsters = (state: GameState): GameState =>
  (['player1', 'player2'] as PlayerId[]).reduce((current, player) =>
    getMonsterPositions(current, player).reduce((next, position) => {
      const card = getCardAt(next, player, position);
      return card && getEffectiveHp(next, player, card) <= 0 ? damageMonster(next, player, position, 0) : next;
    }, current), state);

// 大将カードにダメージを与え、HPが0以下になったら相手の勝利とする
// 籠城の効果があれば、1回のダメージを減らす
const damageSpecialCard = (state: GameState, player: PlayerId, amount: number): GameState => {
  const guard = state.leaderGuards.filter(g => g.player === player).reduce((sum, g) => sum + g.amount, 0);
  const next = updatePlayer(state, player, p => ({ ...p, specialCardHp: p.specialCardHp - Math.max(0, amount - guard) }));
  return next.players[player].specialCardHp <= 0 && !next.winner
    ? { ...next, winner: getOpponent(player) }
    : next;
};

// 行動できるのは、自分のターンの指定フェイズ中だけ。
// allow：コストなしのスペル（freeSpell）・召喚（freeSummon）を選んでいる途中でも、その行動は通す
const checkTurn = (state: GameState, player: PlayerId, phase: Phase, allow?: 'freeSpell' | 'freeSummon'): string | null => {
  if (state.winner) return 'ゲームは終了しています。';
  if (state.currentPlayer !== player) return '自分のターンではありません。';
  if (state.pendingDiscard) return `先に、墓地に置くカードを${state.pendingDiscard.count}枚選んでください。`;
  if (state.pendingPick) return `先に、「${state.pendingPick.source}」の効果でカードを選んでください。`;
  if (state.pendingReaction) {
    return state.pendingReaction.player === player
      ? `先に、「${state.pendingReaction.card.name}」の効果の対象を選んでください。`
      : `相手が「${state.pendingReaction.card.name}」の効果の対象を選んでいます。`;
  }
  if (state.pendingFreeSpell && allow !== 'freeSpell') return `先に、「${state.pendingFreeSpell.source}」の効果で使うスペルを選ぶか、「使わない」を選んでください。`;
  if (state.pendingFreeSummon && allow !== 'freeSummon') return `先に、「${state.pendingFreeSummon.source}」の効果で召喚するモンスターを選ぶか、「召喚しない」を選んでください。`;
  if (state.phase !== phase) return `${phase} フェイズではありません。`;
  return null;
};

// --- フェイズ・ターン進行 ---

// 山札が尽きた状態で自分のターンを迎えたら、ドローの代わりに大将カードがダメージを受ける。
// 最後の1枚を引いたターンや、そのターン中に山札が補充された場合は、次のターン開始時に山札が残っているので対象外。
// 先手の1ターン目（ゲーム全体の1ターン目）はドローしない（エネルギーは増える）
const drawPhase = (state: GameState): GameState => {
  const player = state.currentPlayer;
  const skipDraw = state.turn === 1;
  const afterDeckOut = state.players[player].deck.length === 0
    ? damageSpecialCard(state, player, RULES.deckOutDamage)
    : state;
  const next = updatePlayer(afterDeckOut, player, playerState => {
    // 魔力の泉・祈祷師：前のターンに予約したエネルギー（祈祷師は場に残っているときだけ）
    const delayed = playerState.delayedEnergy
      .filter(e => !e.cardId || ROWS.some(row => playerState.field[row].some(c => c?.id === e.cardId)))
      .reduce((sum, e) => sum + e.amount, 0);
    const charged = {
      ...playerState,
      currentEnergy: Math.min(playerState.currentEnergy + 1 + delayed, playerState.maxEnergy),
      delayedEnergy: [],
    };
    return skipDraw ? charged : drawCards(charged, 1 + getExtraDraws(state, player));
  });
  return { ...next, phase: 'Play' };
};

// ターン開始時に多く引く枚数（不屈の将：モンスターが少ないとき、賢者：手札が少ないとき）
const getExtraDraws = (state: GameState, player: PlayerId): number => {
  const ability = getActiveLeaderAbility(state, player);
  switch (ability?.kind) {
    case 'extraDrawWhenBehind':
      return countMonsters(state, getOpponent(player)) - countMonsters(state, player) >= ability.margin ? ability.amount : 0;
    case 'extraDrawWhenFewCards':
      return state.players[player].hand.length <= ability.handSize ? ability.amount : 0;
    default:
      return 0;
  }
};

const isBusy = (state: GameState): boolean =>
  !!(state.winner || state.pendingDiscard || state.pendingFreeSpell || state.pendingFreeSummon || state.pendingPick || state.pendingReaction);

// ターン終了時の効果（衛生兵：後衛から同じ位置の前衛の味方を回復、研究者：エネルギーが少なければ引く）
const applyEndOfTurnEffects = (state: GameState): GameState => {
  const player = state.currentPlayer;
  return getMonsterPositions(state, player, ['backRow']).reduce((next, position) => {
    const ability = getCardAt(next, player, position)?.ability;
    if (ability?.kind === 'drawIfLowEnergy') {
      return next.players[player].currentEnergy <= ability.threshold ? updatePlayer(next, player, p => drawCards(p, ability.amount)) : next;
    }
    if (ability?.kind !== 'medic') return next;
    const front: FieldPosition = { row: 'frontRow', index: position.index };
    const ally = getCardAt(next, player, front);
    if (!ally) return next;
    const healed = { ...ally, cardHp: Math.min(ally.cardHp + ability.amount, getMaxHp(ally)) };
    return updatePlayer(next, player, p => ({ ...p, field: setSlot(p.field, front, healed) }));
  }, state);
};

export const endTurn = (state: GameState): GameState => {
  if (isBusy(state)) return state;
  const ended = applyEndOfTurnEffects(state);
  return {
    ...ended,
    // 自分のモンスターにかかっていた「次のターンは移動できない」は、自分のターンが終わると切れる
    moveLocks: ended.moveLocks.filter(lock => lock.player !== state.currentPlayer),
    // 籠城は、使ったプレイヤーの相手のターンが終わると切れる
    leaderGuards: ended.leaderGuards.filter(guard => guard.player === state.currentPlayer),
    turn: ended.turn + 1,
    currentPlayer: getOpponent(state.currentPlayer),
    phase: 'Draw',
    turnState: createInitialTurnState(),
  };
};

export const nextPhase = (state: GameState): GameState => {
  if (isBusy(state)) return state;
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
  options: { payByDiscard?: boolean } = {}, // 傭兵：エネルギーの代わりに手札を捨てて召喚する
): ActionResult => {
  const turnError = checkTurn(state, player, 'Play', 'freeSummon');
  if (turnError) return failure(turnError);
  const playerState = state.players[player];
  const card = playerState.hand[handIndex];
  if (!card) return failure('カードが選択されていません。');
  if (!isMonster(card)) return failure('スペルカードは味方モンスターを選んで使用してください。');
  if (getCardAt(state, player, position)) return failure('そのスロットには既にカードがあります。');
  const free = state.pendingFreeSummon;
  if (free && card.cost > free.maxCost) return failure(`コストなしで召喚できるのはコスト${free.maxCost}以下のモンスターです。`);
  if (free?.row && position.row !== free.row) return failure(`「${free.source}」の効果では${free.row === 'frontRow' ? '前衛' : '後衛'}に召喚します。`);
  const discardSummon = !free && options.payByDiscard && card.ability?.kind === 'discardSummon' ? card.ability.amount : 0;
  if (options.payByDiscard && !discardSummon) return failure('このモンスターは手札を捨てて召喚できません。');
  if (discardSummon && playerState.hand.length - 1 < discardSummon) return failure(`捨てる手札が${discardSummon}枚必要です。`);
  const cost = free || discardSummon ? 0 : getSummonCost(state, player, card);
  if (playerState.currentEnergy < cost) return failure('エネルギーが足りません！');

  const next = updatePlayer(state, player, p => ({
    ...payFromHand(p, handIndex, cost),
    field: setSlot(p.field, position, card),
  }));
  const summoned = updateTurnState(next, {
    summonedThisTurnIds: [...next.turnState.summonedThisTurnIds, card.id],
    // 援軍要請の割引は、コストを払って召喚したときに使い切る
    summonDiscount: free || discardSummon ? next.turnState.summonDiscount : 0,
  });
  const cleared = free ? { ...summoned, pendingFreeSummon: null } : summoned;
  if (discardSummon) return success({ ...cleared, pendingDiscard: { player, count: discardSummon } });
  return success(applySummonEffects(cleared, player, card, position));
};

// 召喚したときの効果
const applySummonEffects = (state: GameState, player: PlayerId, card: MonsterCard, position: FieldPosition): GameState => {
  const { ability } = card;
  const hand = state.players[player].hand;
  switch (ability?.kind) {
    case 'freeSpellOnSummon':
      // 使えるスペルが手札にあれば、使うかどうかを選ぶ
      return hand.some(c => isFreeSpellCandidate(c, ability.maxCost))
        ? { ...state, pendingFreeSpell: { player, maxCost: ability.maxCost, source: card.name } }
        : state;
    case 'freeSummonOnSummon':
      return canFreeSummon(state, player, ability.maxCost)
        ? { ...state, pendingFreeSummon: { player, maxCost: ability.maxCost, source: card.name } }
        : state;
    case 'spellDiscountOnSummon':
      return updateTurnState(state, { spellDiscount: state.turnState.spellDiscount + ability.amount });
    case 'energyNextTurnFromBack':
      return position.row === 'backRow'
        ? updatePlayer(state, player, p => ({ ...p, delayedEnergy: [...p.delayedEnergy, { amount: ability.amount, cardId: card.id }] }))
        : state;
    case 'drawOnSummon':
      return updatePlayer(state, player, p => drawCards(p, ability.amount));
    case 'discardOnSummon': {
      const count = Math.min(ability.amount, hand.length);
      return count > 0 ? { ...state, pendingDiscard: { player, count } } : state;
    }
    default:
      return state;
  }
};

// コストなしで召喚できるモンスターが手札にあり、出せる空きがあるか
const canFreeSummon = (state: GameState, player: PlayerId, maxCost: number, row?: Row): boolean =>
  state.players[player].hand.some(c => isMonster(c) && c.cost <= maxCost)
  && (row ? !!findEmptySlot(state, player, row) : ROWS.some(r => findEmptySlot(state, player, r)));

// コストなしで召喚できる場面で、召喚しないことを選ぶ
export const skipFreeSummon = (state: GameState, player: PlayerId): ActionResult => {
  if (state.pendingFreeSummon?.player !== player) return failure('いまはモンスターを選ぶ場面ではありません。');
  return success({ ...state, pendingFreeSummon: null });
};

// コストなしでスペルを使える場面で、使わないことを選ぶ
export const skipFreeSpell = (state: GameState, player: PlayerId): ActionResult => {
  if (state.pendingFreeSpell?.player !== player) return failure('いまはスペルを選ぶ場面ではありません。');
  return success({ ...state, pendingFreeSpell: null });
};

// 1回だけ使える大将の効果を使う（エネルギーを増やす）
export const activateLeaderAbility = (state: GameState, player: PlayerId): ActionResult => {
  const turnError = checkTurn(state, player, 'Play');
  if (turnError) return failure(turnError);
  const { ability } = state.players[player].leader;
  if (ability?.kind !== 'rallyEnergy') return failure('この大将には使える効果がありません。');
  if (!canUseLeaderAbility(state, player)) {
    if (state.players[player].leaderAbilityUsed) return failure('大将の効果はもう使いました。');
    if (!isLeaderActive(state, player)) return failure('このターンは大将の効果がなくなっています。');
    return failure(`大将の HP が${rallyThreshold(state.players[player].leader.maxHp, ability)}以下のときに使えます。`);
  }
  return success(updatePlayer(state, player, p => ({
    ...p,
    currentEnergy: Math.min(p.currentEnergy + ability.amount, p.maxEnergy),
    leaderAbilityUsed: true,
  })));
};

// 山札から枚数ぶん引く（山札が足りなければ、ある分だけ）
const drawCards = (playerState: PlayerState, count: number): PlayerState => ({
  ...playerState,
  deck: playerState.deck.slice(count),
  hand: [...playerState.hand, ...playerState.deck.slice(0, count)],
});

// 対象を選ばないスペルを使う（カードを引いて捨てる など）。cost は払うエネルギー（コストなしで使うときは 0）
const LIFE_TO_ENERGY_COST = 5; // 生命変換で減る大将の HP
export const DISCARD_FOR_ENERGY_COUNT = 2; // 魔力結晶で捨てる手札の枚数

const gainEnergy = (state: GameState, player: PlayerId, amount: number): GameState =>
  updatePlayer(state, player, p => ({ ...p, currentEnergy: Math.min(p.currentEnergy + amount, p.maxEnergy) }));

// 対象を選ばないスペルを使えない理由（使えるなら null）。手札の数は、使うスペルを除いて数える
const untargetedPrecondition = (state: GameState, player: PlayerId, spell: SpellCard): string | null => {
  const opponent = getOpponent(player);
  const { hand, maxEnergy, specialCardHp, graveyard } = state.players[player];
  const otherCards = hand.length - 1;
  const { effect } = spell;
  switch (effect.kind) {
    case 'lastStand':
    case 'summonDiscount':
      return countMonsters(state, player) < countMonsters(state, opponent) ? null : '自分の場のモンスターが相手より少ないときだけ使えます。';
    case 'freeSummon':
      return canFreeSummon(state, player, effect.amount, 'frontRow') ? null : `手札にコスト${effect.amount}以下のモンスターがいないか、前衛に空きがありません。`;
    case 'discardForEnergy':
      return otherCards >= DISCARD_FOR_ENERGY_COUNT ? null : `捨てる手札が${DISCARD_FOR_ENERGY_COUNT}枚必要です。`;
    case 'discardDraw':
      return otherCards >= 1 ? null : '捨てる手札がないので使えません。';
    case 'raiseMaxEnergy':
      return maxEnergy < RULES.maxEnergyLimit ? null : `エネルギーの上限は${RULES.maxEnergyLimit}までです。`;
    case 'lifeToEnergy':
      return specialCardHp > LIFE_TO_ENERGY_COST ? null : `大将の HP が${LIFE_TO_ENERGY_COST}より多いときだけ使えます。`;
    case 'graveRob':
      return graveyard.some(isMonster) ? null : '墓地にモンスターがいません。';
    case 'randomDiscard':
    case 'reveal':
      return state.players[opponent].hand.length > 0 ? null : '相手の手札がありません。';
    default:
      return null;
  }
};

// 補給線：選んだ自分の後衛のモンスターを墓地に送り、その数だけ引く
const castSupplyLine = (state: GameState, player: PlayerId, handIndex: number, cost: number, positions: FieldPosition[]): ActionResult => {
  const unique = positions.filter((pos, i) => positions.findIndex(o => o.row === pos.row && o.index === pos.index) === i);
  if (unique.length === 0) return failure('墓地に送る自分の後衛のモンスターを選んでください。');
  if (unique.some(pos => pos.row !== 'backRow' || !getCardAt(state, player, pos))) return failure('選べるのは自分の後衛のモンスターだけです。');
  const spell = state.players[player].hand[handIndex];
  const paid = updatePlayer(state, player, p => ({ ...payFromHand(p, handIndex, cost), graveyard: [...p.graveyard, spell] }));
  const sacrificed = unique.reduce((next, pos) => sendToGraveyard(next, player, pos), paid);
  return success(updatePlayer(sacrificed, player, p => drawCards(p, unique.length)));
};

// 相手の効果で手札を捨てさせられる。怨霊（相手のモンスターにダメージ）と幻影兵（場に出る）は、持ち主が対象を選ぶ
const forceDiscard = (state: GameState, victim: PlayerId, handIndex: number): GameState => {
  const card = state.players[victim].hand[handIndex];
  if (!card) return state;
  const removed = updatePlayer(state, victim, p => ({ ...p, hand: p.hand.filter((_, i) => i !== handIndex) }));
  const toGraveyard = updatePlayer(removed, victim, p => ({ ...p, graveyard: [...p.graveyard, card] }));
  if (!isMonster(card)) return toGraveyard;
  const { ability } = card;
  if (ability?.kind === 'summonWhenDiscarded' && ROWS.some(row => findEmptySlot(removed, victim, row))) {
    return { ...removed, pendingReaction: { player: victim, card, kind: 'summon', amount: 0 } };
  }
  if (ability?.kind === 'damageWhenDiscarded' && countMonsters(toGraveyard, getOpponent(victim)) > 0) {
    return { ...toGraveyard, pendingReaction: { player: victim, card, kind: 'damage', amount: ability.amount } };
  }
  return toGraveyard;
};

// 捨てられたカードの効果の対象を選ぶ（怨霊：相手のモンスター、幻影兵：自分の空きスロット）
export const resolveReaction = (state: GameState, player: PlayerId, position: FieldPosition): ActionResult => {
  const pending = state.pendingReaction;
  if (pending?.player !== player) return failure('いまは選ぶ場面ではありません。');
  const done = { ...state, pendingReaction: null };
  if (pending.kind === 'summon') {
    if (getCardAt(state, player, position)) return failure('空いているスロットを選んでください。');
    return success(updatePlayer(done, player, p => ({ ...p, field: setSlot(p.field, position, pending.card) })));
  }
  const opponent = getOpponent(player);
  if (!getCardAt(state, opponent, position)) return failure('相手のモンスターを選んでください。');
  return success(damageMonster(done, opponent, position, pending.amount));
};

// 墓地や相手の手札からカードを選ぶ（墓荒らし：墓地のモンスターを手札へ、情報戦：相手のスペルを捨てさせる）。
// 情報戦で相手の手札にスペルがなければ index は null
export const pickCard = (state: GameState, player: PlayerId, index: number | null): ActionResult => {
  const pending = state.pendingPick;
  if (pending?.player !== player) return failure('いまはカードを選ぶ場面ではありません。');
  const done = { ...state, pendingPick: null };
  if (pending.kind === 'graveyard') {
    const card = index === null ? undefined : state.players[player].graveyard[index];
    if (!card || !isMonster(card)) return failure('墓地のモンスターを選んでください。');
    return success(updatePlayer(done, player, p => ({
      ...p,
      graveyard: p.graveyard.filter((_, i) => i !== index),
      hand: [...p.hand, card],
    })));
  }
  const opponent = getOpponent(player);
  const hand = state.players[opponent].hand;
  if (index === null) {
    return hand.some(c => !isMonster(c)) ? failure('捨てさせるスペルを選んでください。') : success(done);
  }
  const card = hand[index];
  if (!card || isMonster(card)) return failure('捨てさせるのは相手のスペルです。');
  return success(forceDiscard(done, opponent, index));
};

const castUntargetedSpell = (state: GameState, player: PlayerId, handIndex: number, cost: number): ActionResult => {
  const spell = state.players[player].hand[handIndex];
  if (!spell || isMonster(spell)) return failure('スペルカードが選択されていません。');
  const { effect } = spell;
  const opponent = getOpponent(player);
  const precondition = untargetedPrecondition(state, player, spell);
  if (precondition) return failure(precondition);

  const paid = updatePlayer(state, player, p => ({
    ...payFromHand(p, handIndex, cost),
    graveyard: [...p.graveyard, spell],
  }));
  switch (effect.kind) {
    case 'catchUpEnergy': {
      const gain = Math.max(0, countMonsters(paid, opponent) - countMonsters(paid, player));
      return success(updatePlayer(paid, player, p => ({ ...p, currentEnergy: Math.min(p.currentEnergy + gain, p.maxEnergy) })));
    }
    case 'disableLeader': {
      const { disabledLeaders } = paid.turnState;
      const disabled = updateTurnState(paid, {
        disabledLeaders: disabledLeaders.includes(opponent) ? disabledLeaders : [...disabledLeaders, opponent],
      });
      return success(removeDefeatedMonsters(disabled));
    }
    case 'damageFrontAll':
      return success(getMonsterPositions(paid, opponent, ['frontRow'])
        .reduce((next, position) => damageMonster(next, opponent, position, effect.amount), paid));
    case 'lastStand':
      return success(getMonsterPositions(paid, player).reduce((next, position) => {
        const card = getCardAt(next, player, position) as MonsterCard;
        return addBuff(addBuff(next, 'attackBuffs', card.id, effect.amount), 'backAttackBuffs', card.id, effect.amount);
      }, paid));
    case 'guardLeader':
      return success({ ...paid, leaderGuards: [...paid.leaderGuards, { player, amount: effect.amount }] });
    case 'drawDiscard': {
      const drawn = updatePlayer(paid, player, p => drawCards(p, effect.amount));
      const count = Math.min(effect.amount, drawn.players[player].hand.length);
      return success(count > 0 ? { ...drawn, pendingDiscard: { player, count } } : drawn);
    }
    case 'freeSummon':
      return success({ ...paid, pendingFreeSummon: { player, maxCost: effect.amount, row: 'frontRow', source: spell.name } });
    case 'spellDiscount':
      return success(updateTurnState(paid, { spellDiscount: paid.turnState.spellDiscount + effect.amount }));
    case 'summonDiscount':
      return success(updateTurnState(paid, { summonDiscount: paid.turnState.summonDiscount + effect.amount }));
    case 'delayedEnergy':
      return success(updatePlayer(paid, player, p => ({ ...p, delayedEnergy: [...p.delayedEnergy, { amount: effect.amount }] })));
    case 'discardForEnergy':
      return success({ ...gainEnergy(paid, player, effect.amount), pendingDiscard: { player, count: DISCARD_FOR_ENERGY_COUNT } });
    case 'raiseMaxEnergy':
      return success(updatePlayer(paid, player, p => ({ ...p, maxEnergy: Math.min(p.maxEnergy + effect.amount, RULES.maxEnergyLimit) })));
    case 'drainEnergy': {
      const drained = updatePlayer(paid, opponent, p => ({ ...p, currentEnergy: Math.max(0, p.currentEnergy - effect.amount) }));
      return success(gainEnergy(drained, player, 1));
    }
    case 'lifeToEnergy': {
      const paidLife = updatePlayer(paid, player, p => ({ ...p, specialCardHp: p.specialCardHp - LIFE_TO_ENERGY_COST }));
      return success(gainEnergy(paidLife, player, effect.amount));
    }
    case 'draw':
      return success(updatePlayer(paid, player, p => drawCards(p, effect.amount)));
    case 'spoils':
      return success(updateTurnState(paid, { spoilsDraw: paid.turnState.spoilsDraw + effect.amount }));
    case 'graveRob':
      return success({ ...paid, pendingPick: { player, kind: 'graveyard', source: spell.name } });
    case 'discardDraw':
      return success({ ...paid, pendingDiscard: { player, count: 1, then: { kind: 'draw', amount: effect.amount } } });
    case 'randomDiscard': {
      let next = paid;
      for (let i = 0; i < effect.amount && next.players[opponent].hand.length > 0 && !next.pendingReaction; i++) {
        next = forceDiscard(next, opponent, Math.floor(Math.random() * next.players[opponent].hand.length));
      }
      return success(next);
    }
    case 'reveal':
      return success({ ...paid, pendingPick: { player, kind: 'opponentHand', source: spell.name } });
    case 'reshuffle': {
      const count = paid.players[player].hand.length;
      const discarded = updatePlayer(paid, player, p => ({ ...p, hand: [], graveyard: [...p.graveyard, ...p.hand] }));
      return success(updatePlayer(discarded, player, p => drawCards(p, count)));
    }
    default:
      return failure('このスペルの効果はまだ実装されていません。');
  }
};

// そのターンだけ攻撃力を上げる
const addBuff = (state: GameState, key: 'attackBuffs' | 'backAttackBuffs', cardId: string, amount: number): GameState =>
  updateTurnState(state, { [key]: { ...state.turnState[key], [cardId]: (state.turnState[key][cardId] ?? 0) + amount } });

// 手札から選んだカードを墓地に置く（pendingDiscard の枚数ちょうど）
export const discardCards = (state: GameState, player: PlayerId, handIndices: number[]): ActionResult => {
  const pending = state.pendingDiscard;
  if (!pending || pending.player !== player) return failure('いまは捨てるカードを選ぶ場面ではありません。');
  const unique = Array.from(new Set(handIndices));
  const hand = state.players[player].hand;
  if (unique.length !== pending.count || unique.some(i => !hand[i])) {
    return failure(`墓地に置くカードを${pending.count}枚選んでください。`);
  }
  const discarded = unique.map(i => hand[i]);
  const next = updatePlayer(state, player, p => ({
    ...p,
    hand: p.hand.filter((_, i) => !unique.includes(i)),
    graveyard: [...p.graveyard, ...discarded],
  }));
  const done: GameState = { ...next, pendingDiscard: null };
  const followUp = pending.then;
  if (followUp?.kind === 'damage') {
    // 火炎瓶：捨てたカードのコスト + bonus のダメージ
    const damage = discarded.reduce((sum, card) => sum + card.cost, 0) + followUp.bonus;
    return success(damageMonster(done, getOpponent(player), followUp.target, damage));
  }
  if (followUp?.kind === 'draw') return success(updatePlayer(done, player, p => drawCards(p, followUp.amount)));
  return success(done);
};

// スペルを使う。対象を選ぶスペルは、効果に応じて味方または相手の場のモンスターを targetPosition で指定する。
// モンスターの効果でコストなしのスペルを選んでいる途中なら、コストを払わずに使う
export const castSpell = (
  state: GameState,
  player: PlayerId,
  handIndex: number,
  targetPosition?: FieldPosition,
  positions?: FieldPosition[], // 補給線：墓地に送る自分の後衛のモンスター
): ActionResult => {
  const turnError = checkTurn(state, player, 'Play', 'freeSpell');
  if (turnError) return failure(turnError);
  const result = castSpellUnchecked(state, player, handIndex, targetPosition, positions);
  if (!result.ok) return result;
  let next = result.state;
  if (state.pendingFreeSpell) {
    next = { ...next, pendingFreeSpell: null };
  } else if (state.turnState.spellDiscount > 0) {
    // 割引はこのスペルで使い切る（このスペルで新しく増えた割引は残す）
    next = updateTurnState(next, { spellDiscount: next.turnState.spellDiscount - state.turnState.spellDiscount });
  }
  // 大魔導師：1ターンに1回、スペルを使ったらエネルギーが増える
  const ability = getActiveLeaderAbility(next, player);
  if (ability?.kind === 'spellEnergy' && !next.turnState.spellEnergyUsed) {
    next = updateTurnState(updatePlayer(next, player, p => ({ ...p, currentEnergy: Math.min(p.currentEnergy + ability.amount, p.maxEnergy) })), { spellEnergyUsed: true });
  }
  return success(next);
};

const castSpellUnchecked = (
  state: GameState,
  player: PlayerId,
  handIndex: number,
  targetPosition?: FieldPosition,
  positions?: FieldPosition[],
): ActionResult => {
  const playerState = state.players[player];
  const spell = playerState.hand[handIndex];
  if (!spell || isMonster(spell)) return failure('スペルカードが選択されていません。');
  if (spell.effect.kind === 'custom') return failure('このスペルの効果はまだ実装されていません。');
  const free = state.pendingFreeSpell;
  if (free && spell.cost > free.maxCost) return failure(`コストなしで使えるのはコスト${free.maxCost}以下のスペルです。`);
  const cost = getSpellCost(state, spell);
  if (playerState.currentEnergy < cost) return failure('エネルギーが足りません！');
  if (isUntargetedSpell(spell)) return castUntargetedSpell(state, player, handIndex, cost);
  if (spell.effect.kind === 'supplyLine') return castSupplyLine(state, player, handIndex, cost, positions ?? []);
  if (!targetPosition) return failure('対象のモンスターを選んでください。');
  const targetSide = getSpellTargetSide(spell);
  const targetPlayer = targetSide === 'ally' ? player : getOpponent(player);
  const target = getCardAt(state, targetPlayer, targetPosition);
  if (!target) {
    return failure(targetSide === 'ally' ? '対象の味方モンスターを選んでください。' : '対象の相手モンスターを選んでください。');
  }
  const { effect } = spell;
  const backCount = getMonsterPositions(state, player, ['backRow']).length;
  const destination = effect.kind === 'forceMove' || effect.kind === 'retreat'
    ? otherRowDestination(state, targetPlayer, targetPosition)
    : { row: otherRow(targetPosition.row), index: targetPosition.index }; // 陣形転換・挑発は同じ位置の反対の列
  const targetError = ((): string | null => {
    switch (effect.kind) {
      case 'heal': return target.cardHp >= getMaxHp(target) ? 'このモンスターはダメージを受けていません。' : null;
      case 'damageBack':
      case 'pullForward': return targetPosition.row !== 'backRow' ? '相手の後衛のモンスターを選んでください。' : null;
      case 'volley':
        if (targetPosition.row !== 'frontRow') return '相手の前衛のモンスターを選んでください。';
        return backCount === 0 ? '自分の後衛にモンスターがいないので使えません。' : null;
      case 'retreat':
        if (targetPosition.row !== 'frontRow') return '自分の前衛のモンスターを選んでください。';
        return destination ? null : '後衛に空きがないので下げられません。';
      case 'forceMove': return destination ? null : '反対の列に空きがないので移動させられません。';
      case 'sacrificeSummon':
        return state.players[player].hand.some(c => isMonster(c) && c.cost <= effect.amount)
          ? null : `手札にコスト${effect.amount}以下のモンスターがいないので使えません。`;
      case 'firebomb': return playerState.hand.length < 2 ? '捨てる手札がないので使えません。' : null;
      default: return null;
    }
  })();
  if (targetError) return failure(targetError);

  const paid = updatePlayer(state, player, p => ({
    ...payFromHand(p, handIndex, cost),
    graveyard: [...p.graveyard, spell],
  }));
  const to = destination as FieldPosition;

  switch (effect.kind) {
    case 'buffFa':
      return success(addBuff(paid, 'attackBuffs', target.id, effect.amount));
    case 'buffBa':
      return success(addBuff(paid, 'backAttackBuffs', target.id, effect.amount));
    case 'heal': {
      const healed = { ...target, cardHp: Math.min(target.cardHp + effect.amount, getMaxHp(target)) };
      return success(updatePlayer(paid, player, p => ({ ...p, field: setSlot(p.field, targetPosition, healed) })));
    }
    case 'damage':
    case 'damageBack':
      return success(damageMonster(paid, targetPlayer, targetPosition, effect.amount));
    case 'volley':
      return success(damageMonster(paid, targetPlayer, targetPosition, backCount * effect.amount));
    case 'forceMove': {
      const moved = swapMonsters(paid, targetPlayer, targetPosition, to);
      return success({ ...moved, moveLocks: [...moved.moveLocks, { player: targetPlayer, cardId: target.id }] });
    }
    case 'pullForward': {
      // 前衛に相手のモンスターがいれば入れ替える。動いたモンスターはどちらも次のターン移動できない
      const displaced = getCardAt(paid, targetPlayer, to);
      const moved = swapMonsters(paid, targetPlayer, targetPosition, to);
      const locks = [target, displaced].flatMap(card => (card ? [{ player: targetPlayer, cardId: card.id }] : []));
      return success({ ...moved, moveLocks: [...moved.moveLocks, ...locks] });
    }
    case 'retreat': {
      const moved = swapMonsters(paid, player, targetPosition, to);
      const card = getCardAt(moved, player, to) as MonsterCard;
      const healed = { ...card, cardHp: Math.min(card.cardHp + effect.amount, getMaxHp(card)) };
      return success(updatePlayer(moved, player, p => ({ ...p, field: setSlot(p.field, to, healed) })));
    }
    case 'swapColumn':
      return success(swapMonsters(paid, player, targetPosition, to));
    case 'sacrificeSummon': {
      const sacrificed = sendToGraveyard(paid, player, targetPosition);
      return success({ ...sacrificed, pendingFreeSummon: { player, maxCost: effect.amount, source: spell.name } });
    }
    case 'sacrificeForEnergy': {
      const sacrificed = sendToGraveyard(paid, player, targetPosition);
      const gain = toOriginalCard(target).cost;
      return success(updatePlayer(sacrificed, player, p => ({ ...p, currentEnergy: Math.min(p.currentEnergy + gain, p.maxEnergy) })));
    }
    case 'firebomb':
      return success({ ...paid, pendingDiscard: { player, count: 1, then: { kind: 'damage', target: targetPosition, bonus: effect.amount } } });
    default:
      return failure('このスペルは対象を選ばずに使います。'); // isUntargetedSpell で先に処理している
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
  if (state.turnState.movedMonsterId) return failure('モンスターの移動は1ターンに1回までです。');
  if (isMoveLocked(state, player, card.id)) return failure('このモンスターは強制移動の効果で、このターンは移動できません。');
  if (state.turnState.summonedThisTurnIds.includes(card.id)) {
    return failure('このモンスターは召喚されたターンには移動できません。');
  }
  if (from.row === to.row) return failure('同じ列の中では移動できません。');
  if (getCardAt(state, player, to)) return failure('移動先には既にカードがあります。');

  const next = swapMonsters(state, player, from, to);
  return success(updateTurnState(next, { movedMonsterId: card.id }));
};

export const attack = (
  state: GameState,
  attackerPlayer: PlayerId,
  attackerPosition: FieldPosition,
  target: AttackTarget,
  pierceTarget?: FieldPosition, // 槍兵の追加ダメージを与える相手の後衛（なければ HP が一番低いもの）
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
    const defenderCard = getCardAt(state, defender, target.position);
    if (!defenderCard) return failure('攻撃対象のモンスターがいません。');
    if (target.position.row === 'backRow' && frontRowBlocked && !canSnipe(attacker, attackerPosition)) {
      return failure('前衛にモンスターがいるため、後衛を攻撃できません。');
    }
    next = damageMonster(state, defender, target.position, attackPower);
    // 殿：前衛で倒されたら、攻撃したモンスターにダメージを返す
    const { ability } = defenderCard;
    if (ability?.kind === 'rearguard' && target.position.row === 'frontRow' && !getCardAt(next, defender, target.position)) {
      next = damageMonster(next, attackerPlayer, attackerPosition, ability.amount);
    }
  } else {
    if (attackerPosition.row === 'backRow') return failure('後衛のモンスターは大将カードを攻撃できません。');
    if (frontRowBlocked) return failure('前衛にモンスターがいるため、直接攻撃できません。');
    next = damageSpecialCard(state, defender, attackPower);
  }

  // 槍兵：前衛から攻撃したとき、選んだ相手の後衛のモンスターにもダメージ（選んだものがいなければ HP が一番低いもの）
  const pierce = attacker.ability;
  if (pierce?.kind === 'pierce' && attackerPosition.row === 'frontRow') {
    const hpAt = (position: FieldPosition) => getEffectiveHp(next, defender, getCardAt(next, defender, position) as MonsterCard);
    const chosen = pierceTarget?.row === 'backRow' && getCardAt(next, defender, pierceTarget) ? pierceTarget : undefined;
    const victim = chosen ?? getMonsterPositions(next, defender, ['backRow']).sort((a, b) => hpAt(a) - hpAt(b))[0];
    if (victim) next = damageMonster(next, defender, victim, pierce.amount);
  }

  return success(updateTurnState(next, {
    attackedMonsterIds: [...next.turnState.attackedMonsterIds, attacker.id],
  }));
};

// 槍兵の追加ダメージの対象を選ぶ必要があるか（前衛から攻撃し、相手の後衛に2体以上いるとき）
export const needsPierceTarget = (state: GameState, player: PlayerId, attackerPosition: FieldPosition): boolean =>
  getCardAt(state, player, attackerPosition)?.ability?.kind === 'pierce' && attackerPosition.row === 'frontRow'
  && getMonsterPositions(state, getOpponent(player), ['backRow']).length >= 2;

// 狙撃手：後衛にいれば、相手の前衛にモンスターがいても相手の後衛を攻撃できる
export const canSnipe = (attacker: MonsterCard, position: FieldPosition): boolean =>
  attacker.ability?.kind === 'sniper' && position.row === 'backRow';

// 指揮官が使えるか（後衛にいて、このターンまだ指揮していない）
export const canCommand = (state: GameState, player: PlayerId, position: FieldPosition): boolean => {
  const card = getCardAt(state, player, position);
  return card?.ability?.kind === 'commander' && position.row === 'backRow'
    && !state.turnState.commandUsedIds.includes(card.id) && !checkTurn(state, player, 'Play');
};

// 指揮官で、前衛の味方1体の FA をこのターンだけ上げる
export const commandMonster = (
  state: GameState,
  player: PlayerId,
  commanderPosition: FieldPosition,
  targetPosition: FieldPosition,
): ActionResult => {
  const turnError = checkTurn(state, player, 'Play');
  if (turnError) return failure(turnError);
  const commander = getCardAt(state, player, commanderPosition);
  const ability = commander?.ability;
  if (!commander || ability?.kind !== 'commander') return failure('指揮できるモンスターではありません。');
  if (commanderPosition.row !== 'backRow') return failure('指揮官は後衛にいるときだけ指揮できます。');
  if (state.turnState.commandUsedIds.includes(commander.id)) return failure('この指揮官は、このターンもう指揮しました。');
  const target = getCardAt(state, player, targetPosition);
  if (!target || targetPosition.row !== 'frontRow') return failure('前衛の味方のモンスターを選んでください。');
  const buffed = addBuff(state, 'attackBuffs', target.id, ability.amount);
  return success(updateTurnState(buffed, { commandUsedIds: [...buffed.turnState.commandUsedIds, commander.id] }));
};
