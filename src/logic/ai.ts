import { MonsterCard, SpellCard, isMonster } from '../types/card';
import { getMaxHp } from './cards';
import { AttackTarget, FieldPosition, GameState, PlayerId, Row } from '../types/gameState';
import {
  ActionResult,
  attack,
  castSpell,
  findEmptySlot,
  getAttackPower,
  getCardAt,
  getMonsterPositions,
  getOpponent,
  moveMonster,
  otherRow,
  playCard,
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

const preferredRow = (card: MonsterCard): Row =>
  card.backAttack > card.frontAttack ? 'backRow' : 'frontRow';

// --- Play フェイズ ---

// 今いる列より攻撃力が上がる列へ、最も効果の大きいモンスターを1体移動する
const aiMove = (state: GameState, player: PlayerId): GameState => {
  let best: { from: FieldPosition; to: FieldPosition; gain: number } | null = null;
  for (const { position: from, card } of monstersOnField(state, player)) {
    if (state.turnState.summonedThisTurnIds.includes(card.id)) continue;
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
    const { hand, currentEnergy } = current.players[player];
    const candidates = hand
      .map((card, handIndex) => ({ card, handIndex }))
      .flatMap(({ card, handIndex }) => (isMonster(card) && card.cost <= currentEnergy ? [{ card, handIndex }] : []))
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
        current = result.state;
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
    case 'buffFa': {
      const defenderFront = monstersOnField(state, defender, ['frontRow']).map(({ card }) => card);
      const target = monstersOnField(state, player, ['frontRow']).find(({ card }) => {
        const power = getAttackPower(state, card, 'frontRow');
        if (power <= 0) return false;
        return defenderFront.length === 0
          || defenderFront.some(enemy => enemy.cardHp > power && enemy.cardHp <= power + effect.amount);
      });
      return target?.position ?? null;
    }
    case 'heal': {
      const damaged = monstersOnField(state, player)
        .filter(({ card }) => getMaxHp(card) - card.cardHp >= Math.min(2, effect.amount))
        .sort((a, b) => monsterValue(b.card) - monsterValue(a.card));
      return damaged[0]?.position ?? null;
    }
    case 'damage': {
      const killable = monstersOnField(state, defender)
        .filter(({ card }) => card.cardHp <= effect.amount)
        .sort((a, b) => monsterValue(b.card) - monsterValue(a.card));
      return killable[0]?.position ?? null;
    }
  }
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

const tryCastOneSpell = (state: GameState, player: PlayerId): GameState | null => {
  const { hand, currentEnergy } = state.players[player];
  for (let handIndex = 0; handIndex < hand.length; handIndex++) {
    const card = hand[handIndex];
    if (isMonster(card) || card.cost > currentEnergy) continue;
    const target = findSpellTarget(state, player, card);
    if (!target) continue;
    const result = castSpell(state, player, handIndex, target);
    if (result.ok) return result.state;
  }
  return null;
};

export const runAiPlayPhase = (state: GameState, player: PlayerId): GameState =>
  aiCastSpells(aiSummon(aiMove(state, player), player), player);

// --- Attack フェイズ ---

interface AttackPlan {
  attacker: FieldPosition;
  target: AttackTarget;
}

// 1回分の攻撃を決める。
// 相手の前衛が空なら大将カードを直接攻撃。
// 倒せるモンスターがいれば、価値が一番高いものを、無駄の少ない攻撃役で倒す。
// 倒せなければ、一番HPの低いモンスターを一番強い攻撃役で削り、後続の攻撃で倒しやすくする。
const chooseAttack = (state: GameState, player: PlayerId): AttackPlan | null => {
  const defender = getOpponent(player);
  const attackers = monstersOnField(state, player)
    .map(({ position, card }) => ({ position, card, power: getAttackPower(state, card, position.row) }))
    .filter(({ card, power }) => power > 0 && !state.turnState.attackedMonsterIds.includes(card.id));
  if (attackers.length === 0) return null;

  const targets = monstersOnField(state, defender, ['frontRow']);
  if (targets.length === 0) return { attacker: attackers[0].position, target: { type: 'player' } };

  let bestKill: { plan: AttackPlan; value: number; overkill: number } | null = null;
  for (const attacker of attackers) {
    for (const target of targets) {
      const hp = target.card.cardHp;
      if (attacker.power < hp) continue;
      const value = monsterValue(target.card);
      const overkill = attacker.power - hp;
      if (!bestKill || value > bestKill.value || (value === bestKill.value && overkill < bestKill.overkill)) {
        bestKill = { plan: { attacker: attacker.position, target: { type: 'monster', position: target.position } }, value, overkill };
      }
    }
  }
  if (bestKill) return bestKill.plan;

  const strongest = attackers.reduce((a, b) => (b.power > a.power ? b : a));
  const weakest = targets.reduce((a, b) => (b.card.cardHp < a.card.cardHp ? b : a));
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
