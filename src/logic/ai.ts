import { Card, MonsterCard, SpellCard, isMonster, isUntargetedSpell } from '../types/card';
import { getMaxHp } from './cards';
import { AttackTarget, FieldPosition, GameState, PlayerId, Row } from '../types/gameState';
import {
  ActionResult,
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
  getSummonCost,
  isMoveLocked,
  moveMonster,
  otherRow,
  playCard,
  skipFreeSpell,
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
    case 'pierce':
    case 'frontGuard':
    case 'rearguard': return 'frontRow';
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
    const candidates = hand
      .map((card, handIndex) => ({ card, handIndex }))
      .flatMap(({ card, handIndex }) => (isMonster(card) && getSummonCost(snapshot, player, card) <= currentEnergy ? [{ card, handIndex }] : []))
      .sort((a, b) => monsterValue(b.card) - monsterValue(a.card));

    let summoned = false;
    for (const { card, handIndex } of candidates) {
      const row = preferredRow(card);
      const fallbackRow = otherRow(row);
      const slot = findEmptySlot(current, player, row)
        ?? (getAttackPower(current, card, fallbackRow) > 0 ? findEmptySlot(current, player, fallbackRow) : null);
      if (!slot) continue;
      const result = playCard(current, player, handIndex, slot);
      if (result.ok) {
        current = resolveAiFreeSpell(result.state, player);
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
        .filter(({ card }) => getEffectiveHp(state, player, card) <= 3 && card.cardHp < getMaxHp(card))
        .sort((a, b) => monsterValue(b.card) - monsterValue(a.card));
      return endangered[0]?.position ?? null;
    }
    case 'swapColumn':
      return findColumnSwap(state, player, player, 2);
    case 'pullForward':
      return findColumnSwap(state, player, defender, -2, ['backRow']);
    case 'drawDiscard':
    case 'disableLeader':
    case 'catchUpEnergy':
    case 'damageFrontAll':
    case 'lastStand':
    case 'guardLeader':
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
      return state.players[player].specialCardHp <= 10 && countMonsters(state, defender) >= 2;
    case 'catchUpEnergy': {
      // 増えるエネルギーが払うコストより多いときだけ
      const gain = monstersOnField(state, defender).length - monstersOnField(state, player).length;
      return gain > (state.pendingFreeSpell ? 0 : spell.cost);
    }
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
const aiCastSpells = (state: GameState, player: PlayerId): GameState => {
  let current = state;
  for (;;) {
    const next = tryCastOneSpell(current, player);
    if (!next) return current;
    current = next;
  }
};

// 手札のスペルを1枚使う（使えたら新しい状態、使えなければ null）。canPay でコストを払えるかを判断する
const tryCastOneSpell = (
  state: GameState,
  player: PlayerId,
  canPay: (spell: SpellCard) => boolean = spell => spell.cost <= state.players[player].currentEnergy,
): GameState | null => {
  const { hand } = state.players[player];
  for (let handIndex = 0; handIndex < hand.length; handIndex++) {
    const card = hand[handIndex];
    if (isMonster(card) || !canPay(card)) continue;
    if (isUntargetedSpell(card)) {
      if (!shouldCastUntargeted(state, player, card)) continue;
      const result = castSpell(state, player, handIndex);
      if (result.ok) return resolveAiDiscard(result.state, player);
      continue;
    }
    const target = findSpellTarget(state, player, card);
    if (!target) continue;
    const result = castSpell(state, player, handIndex, target);
    if (result.ok) return result.state;
  }
  return null;
};

// 召喚したときの効果でコストなしのスペルを使えるなら、使う価値のあるものを使う（なければ使わない）
const resolveAiFreeSpell = (state: GameState, player: PlayerId): GameState => {
  const pending = state.pendingFreeSpell;
  if (pending?.player !== player) return state;
  return tryCastOneSpell(state, player, spell => spell.cost <= pending.maxCost) ?? applyIfOk(state, skipFreeSpell(state, player));
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

export const runAiPlayPhase = (state: GameState, player: PlayerId): GameState =>
  aiCommand(aiCastSpells(aiSummon(aiMove(aiUseLeaderAbility(state, player), player), player), player), player);

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
