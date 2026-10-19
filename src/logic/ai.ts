import { Card, MonsterCard, SpellCard, isMonster, isUntargetedSpell } from '../types/card';
import { getMaxHp } from './cards';
import { AttackTarget, FieldPosition, GameState, PlayerId, Row } from '../types/gameState';
import {
  ActionResult,
  ROWS,
  attack,
  canAttackThisTurn,
  canCommand,
  canSnipe,
  canUseLeaderAbility,
  castSpell,
  commandMonster,
  countMonsters,
  discardCards,
  findEmptySlot,
  getAttackPower,
  getCardAt,
  getEffectiveHp,
  getHpBonus,
  getMonsterPositions,
  getOpponent,
  getSpellCost,
  getSummonCost,
  isMoveLocked,
  moveMonster,
  otherRow,
  pickCard,
  playCard,
  resolveReaction,
  skipFreeSpell,
  skipFreeSummon,
  activateLeaderAbility,
} from './gameLogic';

// AI（相手プレイヤー）の思考ルーチン。
// 各行動はプレイヤーと同じ gameLogic の関数を通すので、ルール違反の手は打てない。

const applyIfOk = (state: GameState, result: ActionResult): GameState => (result.ok ? result.state : state);

// 場のモンスターを、位置とカードの組で取り出す
const monstersOnField = (state: GameState, player: PlayerId, rows?: Row[]) =>
  getMonsterPositions(state, player, rows).map(position => ({
    position,
    card: getCardAt(state, player, position) as MonsterCard,
  }));

// モンスターの強さの目安（召喚の優先度・攻撃対象の優先度に使う）
const monsterValue = (card: MonsterCard): number =>
  Math.max(card.frontAttack, card.backAttack) * 2 + card.cardHp + card.cost;

// 効果が働く列（その列にいるときだけ効果があるモンスター）
const abilityRow = (card: MonsterCard): Row | null => {
  switch (card.ability?.kind) {
    case 'sniper':
    case 'medic':
    case 'commander': return 'backRow';
    case 'energyNextTurnFromBack':
    case 'drawIfLowEnergy': return 'backRow';
    case 'pierce':
    case 'frontGuard':
    case 'rearguard':
    case 'drawOnFrontDeath': return 'frontRow';
    default: return null;
  }
};

const preferredRow = (card: MonsterCard): Row =>
  abilityRow(card) ?? (card.backAttack > card.frontAttack ? 'backRow' : 'frontRow');

// --- Play フェイズ ---

// 今いる列より攻撃力が上がる列へ、最も効果の大きいモンスターを1体移動する
const aiMove = (state: GameState, player: PlayerId): GameState => {
  let best: { from: FieldPosition; to: FieldPosition; gain: number } | null = null;
  for (const { position: from, card } of monstersOnField(state, player)) {
    if (state.turnState.summonedThisTurnIds.includes(card.id) || isMoveLocked(state, player, card.id)) continue;
    if (abilityRow(card) === from.row) continue; // 効果が働く列からは動かさない
    const to = findEmptySlot(state, player, otherRow(from.row));
    if (!to) continue;
    const gain = getAttackPower(state, card, to.row) - getAttackPower(state, card, from.row);
    if (gain > 0 && (!best || gain > best.gain)) best = { from, to, gain };
  }
  return best ? applyIfOk(state, moveMonster(state, player, best.from, best.to)) : state;
};

// 出せるモンスターの中で一番強いものから順に召喚する。
// 得意な列が埋まっていれば、もう一方の列でも攻撃できる場合はそちらに出す。
const aiSummon = (state: GameState, player: PlayerId): GameState => {
  let current = state;
  for (;;) {
    const snapshot = current;
    const { hand, currentEnergy } = snapshot.players[player];
    // 傭兵：エネルギーが足りなくても、手札に余裕があれば（捨てる枚数 +2 枚以上）手札を捨てて召喚する
    const byDiscard = (card: MonsterCard) => card.ability?.kind === 'discardSummon' && hand.length - 1 >= card.ability.amount + 2;
    const candidates = hand
      .map((card, handIndex) => ({ card, handIndex }))
      .flatMap(({ card, handIndex }) => {
        if (!isMonster(card)) return [];
        if (getSummonCost(snapshot, player, card) <= currentEnergy) return [{ card, handIndex, payByDiscard: false }];
        return byDiscard(card) ? [{ card, handIndex, payByDiscard: true }] : [];
      })
      .sort((a, b) => monsterValue(b.card) - monsterValue(a.card));

    // 空きが少ないときは、次のターンに出せる、もっと強いモンスターのためにエネルギーを温存する
    const emptySlots = ROWS.reduce((sum, row) => sum + snapshot.players[player].field[row].filter(c => !c).length, 0);
    const nextTurnBest = hand
      .filter((c): c is MonsterCard => isMonster(c) && getSummonCost(snapshot, player, c) === currentEnergy + 1)
      .reduce((best, c) => Math.max(best, monsterValue(c)), 0);
    const worthSaving = (card: MonsterCard) => emptySlots <= 2 && nextTurnBest > monsterValue(card) * 1.3;

    let summoned = false;
    for (const { card, handIndex, payByDiscard } of candidates) {
      if (worthSaving(card)) continue;
      const row = preferredRow(card);
      const fallbackRow = otherRow(row);
      const slot = findEmptySlot(current, player, row)
        ?? (getAttackPower(current, card, fallbackRow) > 0 ? findEmptySlot(current, player, fallbackRow) : null);
      if (!slot) continue;
      const result = playCard(current, player, handIndex, slot, { payByDiscard });
      if (result.ok) {
        current = resolveAiPending(result.state, player);
        summoned = true;
        break;
      }
    }
    if (!summoned) return current;
  }
};

// スペルの対象を選ぶ。使う価値がないときは null（エネルギーを温存する）
// - FA上昇：上昇分で相手の前衛モンスターを倒せるようになるとき、または相手の前衛が空で直接攻撃が増えるとき
// - 回復：回復量をほぼ無駄なく使える、ダメージを受けた味方
// - ダメージ：倒せる相手モンスターのうち一番価値の高いもの
const findSpellTarget = (state: GameState, player: PlayerId, spell: SpellCard): FieldPosition | null => {
  const { effect } = spell;
  const defender = getOpponent(player);
  switch (effect.kind) {
    case 'custom':
      return null; // まだ実装されていない効果は使わない
    case 'buffFa':
    case 'buffBa': {
      // FA を上げるなら前衛、BA を上げるなら後衛のモンスターが対象
      const row: Row = effect.kind === 'buffFa' ? 'frontRow' : 'backRow';
      const defenderFrontHps = monstersOnField(state, defender, ['frontRow']).map(({ card }) => getEffectiveHp(state, defender, card));
      const target = monstersOnField(state, player, [row]).find(({ card }) => {
        const power = getAttackPower(state, card, row);
        if (power <= 0) return false;
        return defenderFrontHps.length === 0
          || defenderFrontHps.some(hp => hp > power && hp <= power + effect.amount);
      });
      return target?.position ?? null;
    }
    case 'heal': {
      const damaged = monstersOnField(state, player)
        .filter(({ card }) => getMaxHp(card) - card.cardHp >= Math.min(2, effect.amount))
        .sort((a, b) => monsterValue(b.card) - monsterValue(a.card));
      return damaged[0]?.position ?? null;
    }
    case 'damage':
    case 'damageBack': {
      const rows: Row[] | undefined = effect.kind === 'damageBack' ? ['backRow'] : undefined;
      const killable = monstersOnField(state, defender, rows)
        .filter(({ card }) => getEffectiveHp(state, defender, card) <= effect.amount)
        .sort((a, b) => monsterValue(b.card) - monsterValue(a.card));
      return killable[0]?.position ?? null;
    }
    case 'forceMove':
      return findForceMoveTarget(state, player);
    case 'volley': {
      const damage = monstersOnField(state, player, ['backRow']).length * effect.amount;
      const killable = monstersOnField(state, defender, ['frontRow'])
        .filter(({ card }) => getEffectiveHp(state, defender, card) <= damage)
        .sort((a, b) => monsterValue(b.card) - monsterValue(a.card));
      return killable[0]?.position ?? null;
    }
    case 'retreat': {
      // 倒されそうな（HP 3 以下の）前衛の味方を下げる
      if (!findEmptySlot(state, player, 'backRow')) return null;
      const endangered = monstersOnField(state, player, ['frontRow'])
        .filter(({ card }) => getEffectiveHp(state, player, card) <= getMaxHp(card) * 0.3 && card.cardHp < getMaxHp(card))
        .sort((a, b) => monsterValue(b.card) - monsterValue(a.card));
      return endangered[0]?.position ?? null;
    }
    case 'swapColumn':
      return findColumnSwap(state, player, player, 2);
    case 'firebomb': {
      // 一番残しておきたくない手札を捨てる前提で、倒せる相手モンスターを狙う
      const others = state.players[player].hand.filter(c => c.id !== spell.id);
      if (others.length === 0) return null;
      const fuel = others.reduce((a, b) => (keepValue(b) < keepValue(a) ? b : a));
      const damage = fuel.cost + effect.amount;
      const killable = monstersOnField(state, defender)
        .filter(({ card }) => getEffectiveHp(state, defender, card) <= damage)
        .sort((a, b) => monsterValue(b.card) - monsterValue(a.card));
      return killable[0]?.position ?? null;
    }
    case 'sacrificeSummon': {
      // 弱いモンスターを、手札のもっと強いモンスターに入れ替える
      const best = state.players[player].hand
        .filter((c): c is MonsterCard => isMonster(c) && c.cost <= effect.amount)
        .reduce<MonsterCard | null>((a, b) => (!a || monsterValue(b) > monsterValue(a) ? b : a), null);
      if (!best) return null;
      const weakest = monstersOnField(state, player).sort((a, b) => monsterValue(a.card) - monsterValue(b.card))[0];
      return weakest && monsterValue(best) >= monsterValue(weakest.card) + 4 ? weakest.position : null;
    }
    case 'sacrificeForEnergy':
    case 'supplyLine':
      return null; // 自分のモンスターを減らす効果は使わない
    case 'pullForward':
      return findColumnSwap(state, player, defender, -2, ['backRow']);
    case 'drawDiscard':
    case 'disableLeader':
    case 'catchUpEnergy':
    case 'damageFrontAll':
    case 'lastStand':
    case 'guardLeader':
    case 'freeSummon':
    case 'spellDiscount':
    case 'summonDiscount':
    case 'delayedEnergy':
    case 'discardForEnergy':
    case 'raiseMaxEnergy':
    case 'drainEnergy':
    case 'lifeToEnergy':
    case 'draw':
    case 'spoils':
    case 'graveRob':
    case 'discardDraw':
    case 'randomDiscard':
    case 'reveal':
    case 'reshuffle':
      return null; // 対象を選ばないスペル（shouldCastUntargeted で判断する）
  }
};

// 強制移動の対象：相手の前衛の最後の1体を後衛へ動かすと大将を攻撃できるなら、それを選ぶ。
// そうでなければ、移動で攻撃力が一番下がる相手モンスター（2以上下がるときだけ）
const findForceMoveTarget = (state: GameState, player: PlayerId): FieldPosition | null => {
  const defender = getOpponent(player);
  const movable = monstersOnField(state, defender).filter(({ position }) => findEmptySlot(state, defender, otherRow(position.row)));
  const front = monstersOnField(state, defender, ['frontRow']);
  const canHitLeader = monstersOnField(state, player, ['frontRow']).some(({ card }) => getAttackPower(state, card, 'frontRow') > 0);
  if (front.length === 1 && canHitLeader && movable.some(({ card }) => card.id === front[0].card.id)) return front[0].position;
  let best: { position: FieldPosition; loss: number } | null = null;
  for (const { position, card } of movable) {
    const loss = getAttackPower(state, card, position.row) - getAttackPower(state, card, otherRow(position.row));
    if (loss >= 2 && (!best || loss > best.loss)) best = { position, loss };
  }
  return best?.position ?? null;
};

// 同じ位置の前衛と後衛を入れ替えたときの、owner の攻撃力の合計の変化が threshold 以上（負なら以下）になる位置を探す。
// 自分の陣形転換なら上がる位置（threshold > 0）、相手への挑発なら下がる位置（threshold < 0）
const findColumnSwap = (state: GameState, player: PlayerId, owner: PlayerId, threshold: number, rows?: Row[]): FieldPosition | null => {
  const columnPower = (front: MonsterCard | null, back: MonsterCard | null) =>
    (front ? getAttackPower(state, front, 'frontRow') : 0) + (back ? getAttackPower(state, back, 'backRow') : 0);
  let best: { position: FieldPosition; change: number } | null = null;
  for (const { position } of monstersOnField(state, owner, rows)) {
    const front = getCardAt(state, owner, { row: 'frontRow', index: position.index });
    const back = getCardAt(state, owner, { row: 'backRow', index: position.index });
    const change = columnPower(back, front) - columnPower(front, back);
    const better = threshold > 0 ? change >= threshold && (!best || change > best.change) : change <= threshold && (!best || change < best.change);
    if (better) best = { position, change };
  }
  return best?.position ?? null;
};

// 対象を選ばないスペルを使うか
// - 引いて捨てる：引く枚数ぶん山札が残っていれば使う
// - 相手の大将の効果をなくす：相手の大将の効果で HP が上がっている相手モンスターがいれば使う
const shouldCastUntargeted = (state: GameState, player: PlayerId, spell: SpellCard): boolean => {
  const defender = getOpponent(player);
  switch (spell.effect.kind) {
    case 'drawDiscard':
      return state.players[player].deck.length >= spell.effect.amount;
    case 'disableLeader':
      return monstersOnField(state, defender).some(({ card }) => getHpBonus(state, defender, card) > 0);
    case 'damageFrontAll': {
      const front = monstersOnField(state, defender, ['frontRow']);
      return front.length >= 2 || front.some(({ card }) => getEffectiveHp(state, defender, card) <= (spell.effect as { amount: number }).amount);
    }
    case 'lastStand': {
      const attackers = monstersOnField(state, player).filter(({ position, card }) => getAttackPower(state, card, position.row) > 0);
      return canAttackThisTurn(state) && countMonsters(state, player) < countMonsters(state, defender) && attackers.length >= 2;
    }
    case 'guardLeader':
      return isLeaderLow(state, player, 0.5) && countMonsters(state, defender) >= 2;
    default:
      return shouldCastResourceSpell(state, player, spell);
    case 'catchUpEnergy': {
      // 増えるエネルギーが払うコストより多いときだけ
      const gain = monstersOnField(state, defender).length - monstersOnField(state, player).length;
      return gain > (state.pendingFreeSpell ? 0 : spell.cost);
    }
  }
};

// 大将の HP が最大 HP × ratio 以下か
const isLeaderLow = (state: GameState, player: PlayerId, ratio: number): boolean =>
  state.players[player].specialCardHp <= state.players[player].leader.maxHp * ratio;

// しばらく使えそうにない手札か（未実装のスペル、次のターンでも出せない重いモンスター、出せる列がないモンスター）
const isDeadCard = (state: GameState, player: PlayerId, card: Card): boolean => {
  if (!isMonster(card)) return card.effect.kind === 'custom';
  if (getSummonCost(state, player, card) > state.players[player].currentEnergy + 2) return true;
  return !ROWS.some(row => findEmptySlot(state, player, row) && getAttackPower(state, card, row) > 0);
};

// カードを引く・捨てる・エネルギー・踏み倒しのスペルを使うか
const shouldCastResourceSpell = (state: GameState, player: PlayerId, spell: SpellCard): boolean => {
  const defender = getOpponent(player);
  const me = state.players[player];
  const energyAfter = me.currentEnergy - getSpellCost(state, spell);
  const others = me.hand.filter(c => c.id !== spell.id);
  const monstersInHand = others.filter((c): c is MonsterCard => isMonster(c));
  const effect = spell.effect as { kind: SpellCard['effect']['kind']; amount: number };
  // 今は出せないが、エネルギーが gain 増えれば出せるモンスターが手札にあるか
  const unlocks = (gain: number) => monstersInHand.some(c => getSummonCost(state, player, c) > energyAfter && getSummonCost(state, player, c) <= energyAfter + gain);
  switch (effect.kind) {
    case 'freeSummon':
      return monstersInHand.some(c => c.cost >= 2 && c.cost <= effect.amount);
    case 'spellDiscount':
      return others.some(c => !isMonster(c) && c.effect.kind !== 'custom' && c.cost >= 2);
    case 'summonDiscount':
      return unlocks(effect.amount);
    case 'discardForEnergy':
      return others.length >= effect.amount + 1 && unlocks(effect.amount);
    case 'lifeToEnergy':
      return !isLeaderLow(state, player, 0.6) && unlocks(effect.amount);
    case 'delayedEnergy':
    case 'raiseMaxEnergy':
      return true;
    case 'drainEnergy':
      return state.players[defender].currentEnergy >= 2;
    case 'draw':
      return me.deck.length >= effect.amount + 3;
    case 'spoils':
      return canAttackThisTurn(state) && countMonsters(state, player) > 0 && countMonsters(state, defender) > 0;
    case 'graveRob':
      return me.graveyard.some(c => isMonster(c) && c.cost >= 2);
    case 'discardDraw':
      return me.deck.length >= effect.amount + 3 && others.length >= 2 && others.some(c => isDeadCard(state, player, c));
    case 'randomDiscard':
    case 'reveal':
      return state.players[defender].hand.length > 0;
    case 'reshuffle':
      return me.deck.length >= others.length + 3 && others.length >= 3
        && others.filter(c => isDeadCard(state, player, c)).length * 2 >= others.length;
    default:
      return false;
  }
};

// 手札のカードの残しておきたさ（低いものから捨てる）。まだ効果のないスペルは真っ先に捨てる
const keepValue = (card: Card): number => {
  if (isMonster(card)) return monsterValue(card);
  return card.effect.kind === 'custom' ? -100 : 6 + card.cost;
};

// 捨てるカードを選んでいる途中なら、残しておきたさの低いカードから捨てる
const resolveAiDiscard = (state: GameState, player: PlayerId): GameState => {
  const pending = state.pendingDiscard;
  if (!pending || pending.player !== player) return state;
  const indices = state.players[player].hand
    .map((card, index) => ({ index, value: keepValue(card) }))
    .sort((a, b) => a.value - b.value)
    .slice(0, pending.count)
    .map(({ index }) => index);
  const result = discardCards(state, player, indices);
  return result.ok ? result.state : state;
};

// 使う価値のあるスペルがなくなるまで、手札のスペルを使う
const aiCastSpells = (state: GameState, player: PlayerId, only: (spell: SpellCard) => boolean = () => true): GameState => {
  let current = state;
  for (;;) {
    const snapshot = current;
    const next = tryCastOneSpell(snapshot, player, spell => only(spell) && getSpellCost(snapshot, spell) <= snapshot.players[player].currentEnergy);
    if (!next) return current;
    current = next;
  }
};

// 手札のスペルを1枚使う（使えたら新しい状態、使えなければ null）。canPay でコストを払えるかを判断する
const tryCastOneSpell = (
  state: GameState,
  player: PlayerId,
  canPay: (spell: SpellCard) => boolean = spell => getSpellCost(state, spell) <= state.players[player].currentEnergy,
): GameState | null => {
  const { hand } = state.players[player];
  for (let handIndex = 0; handIndex < hand.length; handIndex++) {
    const card = hand[handIndex];
    if (isMonster(card) || !canPay(card)) continue;
    if (isUntargetedSpell(card)) {
      if (!shouldCastUntargeted(state, player, card)) continue;
      const result = castSpell(state, player, handIndex);
      if (result.ok) return resolveAiPending(result.state, player);
      continue;
    }
    const target = findSpellTarget(state, player, card);
    if (!target) continue;
    const result = castSpell(state, player, handIndex, target);
    if (result.ok) return resolveAiPending(result.state, player);
  }
  return null;
};

// 召喚したときの効果でコストなしのスペルを使えるなら、使う価値のあるものを使う（なければ使わない）
const resolveAiFreeSpell = (state: GameState, player: PlayerId): GameState => {
  const pending = state.pendingFreeSpell;
  if (pending?.player !== player) return state;
  return tryCastOneSpell(state, player, spell => spell.cost <= pending.maxCost) ?? applyIfOk(state, skipFreeSpell(state, player));
};

// コストなしの召喚：手札の一番強い対象のモンスターを出す（出せなければ召喚しない）
const resolveAiFreeSummon = (state: GameState, player: PlayerId): GameState => {
  const pending = state.pendingFreeSummon;
  if (pending?.player !== player) return state;
  const options = state.players[player].hand
    .map((card, handIndex) => ({ card, handIndex }))
    .filter((o): o is { card: MonsterCard; handIndex: number } => isMonster(o.card) && o.card.cost <= pending.maxCost)
    .sort((a, b) => monsterValue(b.card) - monsterValue(a.card));
  for (const { card, handIndex } of options) {
    const row = pending.row ?? preferredRow(card);
    const slot = findEmptySlot(state, player, row) ?? (pending.row ? null : findEmptySlot(state, player, otherRow(row)));
    if (!slot) continue;
    const result = playCard(state, player, handIndex, slot);
    if (result.ok) return result.state;
  }
  return applyIfOk(state, skipFreeSummon(state, player));
};

// 墓荒らし：一番強いモンスターを戻す。情報戦：一番コストの高いスペルを捨てさせる
const resolveAiPick = (state: GameState, player: PlayerId): GameState => {
  const pending = state.pendingPick;
  if (pending?.player !== player) return state;
  const cards = pending.kind === 'graveyard' ? state.players[player].graveyard : state.players[getOpponent(player)].hand;
  const scored = cards
    .map((card, index) => ({ index, score: pending.kind === 'graveyard'
      ? (isMonster(card) ? monsterValue(card) : -1)
      : (isMonster(card) ? -1 : card.cost) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score);
  return applyIfOk(state, pickCard(state, player, scored[0]?.index ?? null));
};

// 捨てられた怨霊・幻影兵の対象を選ぶ（怨霊：倒せる中で一番強い相手、なければ一番強い相手。幻影兵：得意な列の空き）
export const resolveAiReaction = (state: GameState, player: PlayerId): GameState => {
  const pending = state.pendingReaction;
  if (pending?.player !== player) return state;
  if (pending.kind === 'summon') {
    const row = preferredRow(pending.card);
    const slot = findEmptySlot(state, player, row) ?? findEmptySlot(state, player, otherRow(row));
    return slot ? applyIfOk(state, resolveReaction(state, player, slot)) : state;
  }
  const defender = getOpponent(player);
  const target = monstersOnField(state, defender)
    .map(m => ({ ...m, kills: getEffectiveHp(state, defender, m.card) <= pending.amount }))
    .sort((a, b) => Number(b.kills) - Number(a.kills) || monsterValue(b.card) - monsterValue(a.card))[0];
  return target ? applyIfOk(state, resolveReaction(state, player, target.position)) : state;
};

// 選ぶ途中の場面（捨てる・コストなしのスペルや召喚・カードを選ぶ）がなくなるまで片付ける
const resolveAiPending = (state: GameState, player: PlayerId): GameState => {
  let current = state;
  for (let i = 0; i < 10; i++) {
    const before = current;
    current = resolveAiReaction(resolveAiPick(resolveAiFreeSummon(resolveAiFreeSpell(resolveAiDiscard(current, player), player), player), player), player);
    if (current === before) return current;
  }
  return current;
};

// 1回だけ使える大将の効果は、使えるようになったらすぐ使う
const aiUseLeaderAbility = (state: GameState, player: PlayerId): GameState =>
  canUseLeaderAbility(state, player) ? applyIfOk(state, activateLeaderAbility(state, player)) : state;

// 指揮官で、前衛の一番攻撃力の高い味方の FA を上げる
const aiCommand = (state: GameState, player: PlayerId): GameState =>
  monstersOnField(state, player, ['backRow']).reduce((current, { position }) => {
    if (!canCommand(current, player, position)) return current;
    const target = monstersOnField(current, player, ['frontRow'])
      .sort((a, b) => getAttackPower(current, b.card, 'frontRow') - getAttackPower(current, a.card, 'frontRow'))[0];
    return target ? applyIfOk(current, commandMonster(current, player, position, target.position)) : current;
  }, state);

// 召喚の前に使うスペル（エネルギー・割引・踏み倒し・ドローなど、召喚の助けになるもの）
const PREPARE_KINDS: SpellCard['effect']['kind'][] = [
  'summonDiscount', 'discardForEnergy', 'raiseMaxEnergy', 'drainEnergy', 'lifeToEnergy', 'freeSummon', 'draw', 'graveRob', 'discardDraw',
];

// 進め方：大将の効果 → 移動 → 召喚の助けになるスペル → 使う価値のあるスペル（倒せる・条件を満たすもの）→ 召喚 → 残りのスペル → 指揮。
// スペルを召喚より先に使うのは、先に召喚でエネルギーを使い切って、効果の大きいスペルが使えなくなるのを防ぐため
export const runAiPlayPhase = (state: GameState, player: PlayerId): GameState => {
  const prepared = aiCastSpells(aiMove(aiUseLeaderAbility(state, player), player), player, spell => PREPARE_KINDS.includes(spell.effect.kind));
  // 見習い魔導士を出せるなら、その効果でコストなしで使えるスペルは召喚のあとに回す
  const { hand, currentEnergy } = prepared.players[player];
  const freeSpellCost = hand.reduce((max, c) =>
    (isMonster(c) && c.ability?.kind === 'freeSpellOnSummon' && getSummonCost(prepared, player, c) <= currentEnergy ? Math.max(max, c.ability.maxCost) : max), -1);
  const impactful = aiCastSpells(prepared, player, spell => !BUFF_KINDS.includes(spell.effect.kind) && spell.cost > freeSpellCost);
  return aiCommand(aiCastSpells(aiSummon(impactful, player), player), player);
};

// 召喚したモンスターにも使いたいので、召喚のあとに使うスペル
const BUFF_KINDS: SpellCard['effect']['kind'][] = ['buffFa', 'buffBa'];

// --- Attack フェイズ ---

interface AttackPlan {
  attacker: FieldPosition;
  target: AttackTarget;
}

// 1回分の攻撃を決める。
// 相手の前衛が空なら、前衛のモンスターで大将カードを直接攻撃（後衛からは大将を攻撃できない）。
// 倒せるモンスターがいれば、価値が一番高いものを、無駄の少ない攻撃役で倒す。
// 倒せなければ、一番HPの低いモンスターを一番強い攻撃役で削り、後続の攻撃で倒しやすくする。
const chooseAttack = (state: GameState, player: PlayerId): AttackPlan | null => {
  const defender = getOpponent(player);
  const attackers = monstersOnField(state, player)
    .map(({ position, card }) => ({ position, card, power: getAttackPower(state, card, position.row) }))
    .filter(({ card, power }) => power > 0 && !state.turnState.attackedMonsterIds.includes(card.id));
  if (attackers.length === 0) return null;

  const frontTargets = monstersOnField(state, defender, ['frontRow']);
  if (frontTargets.length === 0) {
    const frontAttacker = attackers.find(({ position }) => position.row === 'frontRow');
    if (frontAttacker) return { attacker: frontAttacker.position, target: { type: 'player' } };
  }
  const backTargets = monstersOnField(state, defender, ['backRow']);
  // 攻撃役ごとに狙える相手：前衛がいれば前衛（狙撃手は後衛も）、前衛が空なら後衛
  const targetsOf = (attacker: { position: FieldPosition; card: MonsterCard }) => {
    if (frontTargets.length === 0) return backTargets;
    return canSnipe(attacker.card, attacker.position) ? [...frontTargets, ...backTargets] : frontTargets;
  };

  let bestKill: { plan: AttackPlan; value: number; overkill: number } | null = null;
  for (const attacker of attackers) {
    for (const target of targetsOf(attacker)) {
      const hp = getEffectiveHp(state, defender, target.card);
      if (attacker.power < hp) continue;
      const value = monsterValue(target.card);
      const overkill = attacker.power - hp;
      if (!bestKill || value > bestKill.value || (value === bestKill.value && overkill < bestKill.overkill)) {
        bestKill = { plan: { attacker: attacker.position, target: { type: 'monster', position: target.position } }, value, overkill };
      }
    }
  }
  if (bestKill) return bestKill.plan;

  const hpOf = (target: { card: MonsterCard }) => getEffectiveHp(state, defender, target.card);
  const usable = attackers.filter(attacker => targetsOf(attacker).length > 0);
  if (usable.length === 0) return null;
  const strongest = usable.reduce((a, b) => (b.power > a.power ? b : a));
  const weakest = targetsOf(strongest).reduce((a, b) => (hpOf(b) < hpOf(a) ? b : a));
  return { attacker: strongest.position, target: { type: 'monster', position: weakest.position } };
};

export const runAiAttackPhase = (state: GameState, player: PlayerId): GameState => {
  let current = state;
  while (!current.winner) {
    const plan = chooseAttack(current, player);
    if (!plan) break;
    const result = attack(current, player, plan.attacker, plan.target);
    if (!result.ok) break;
    current = result.state;
  }
  return current;
};
