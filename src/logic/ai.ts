import { Card } from '../types/card';
import { AttackTarget, FieldPosition, GameState, PlayerId, Row } from '../types/gameState';
import {
  ActionResult,
  ROWS,
  attack,
  castSpell,
  getAttackPower,
  getCardAt,
  getOpponent,
  isAttackSpell,
  moveMonster,
  playCard,
} from './gameLogic';

// AI（相手プレイヤー）の思考ルーチン。
// 各行動はプレイヤーと同じ gameLogic の関数を通すので、ルール違反の手は打てない。

const otherRow = (row: Row): Row => (row === 'frontRow' ? 'backRow' : 'frontRow');

const applyIfOk = (state: GameState, result: ActionResult): GameState => (result.ok ? result.state : state);

const monsterPositions = (state: GameState, player: PlayerId, rows: Row[] = ROWS): FieldPosition[] =>
  rows.flatMap(row =>
    state.players[player].field[row]
      .map((card, index) => (card ? { row, index } : null))
      .filter((position): position is FieldPosition => position !== null),
  );

const findEmptySlot = (state: GameState, player: PlayerId, row: Row): FieldPosition | null => {
  const index = state.players[player].field[row].findIndex(slot => slot === null);
  return index === -1 ? null : { row, index };
};

// モンスターの強さの目安（召喚の優先度・攻撃対象の優先度に使う）
const monsterValue = (card: Card): number =>
  Math.max(card.frontAttack ?? 0, card.backAttack ?? 0) * 2 + (card.cardHp ?? 0) + card.cost;

const preferredRow = (card: Card): Row =>
  (card.backAttack ?? 0) > (card.frontAttack ?? 0) ? 'backRow' : 'frontRow';

// --- Play フェイズ ---

// 今いる列より攻撃力が上がる列へ、最も効果の大きいモンスターを1体移動する
const aiMove = (state: GameState, player: PlayerId): GameState => {
  let best: { from: FieldPosition; to: FieldPosition; gain: number } | null = null;
  for (const from of monsterPositions(state, player)) {
    const card = getCardAt(state, player, from)!;
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
      .filter(({ card }) => card.type === 'Monster' && card.cost <= currentEnergy)
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

// 攻撃の呪文は、+1 で相手の前衛モンスターを倒せるようになるとき、
// または相手の前衛が空で大将カードへのダメージが増えるときだけ使う
const findSpellTarget = (state: GameState, player: PlayerId): FieldPosition | null => {
  const defenderFront = state.players[getOpponent(player)].field.frontRow.filter((card): card is Card => card !== null);
  const target = monsterPositions(state, player, ['frontRow']).find(position => {
    const power = getAttackPower(state, getCardAt(state, player, position)!, 'frontRow');
    if (power <= 0) return false;
    return defenderFront.length === 0 || defenderFront.some(enemy => enemy.cardHp === power + 1);
  });
  return target ?? null;
};

const aiCastSpells = (state: GameState, player: PlayerId): GameState => {
  let current = state;
  for (;;) {
    const { hand, currentEnergy } = current.players[player];
    const spellIndex = hand.findIndex(card => isAttackSpell(card) && card.cost <= currentEnergy);
    if (spellIndex === -1) return current;

    const target = findSpellTarget(current, player);
    if (!target) return current;

    const result = castSpell(current, player, spellIndex, target);
    if (!result.ok) return current;
    current = result.state;
  }
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
  const attackers = monsterPositions(state, player)
    .map(position => {
      const card = getCardAt(state, player, position)!;
      return { position, card, power: getAttackPower(state, card, position.row) };
    })
    .filter(({ card, power }) => power > 0 && !state.turnState.attackedMonsterIds.includes(card.id));
  if (attackers.length === 0) return null;

  const targets = monsterPositions(state, defender, ['frontRow']).map(position => ({
    position,
    card: getCardAt(state, defender, position)!,
  }));
  if (targets.length === 0) return { attacker: attackers[0].position, target: { type: 'player' } };

  let bestKill: { plan: AttackPlan; value: number; overkill: number } | null = null;
  for (const attacker of attackers) {
    for (const target of targets) {
      const hp = target.card.cardHp ?? 0;
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
  const weakest = targets.reduce((a, b) => ((b.card.cardHp ?? 0) < (a.card.cardHp ?? 0) ? b : a));
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
