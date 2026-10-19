export type ImplementationStatus = '未実装' | '実装済み' | '効果なし';

// AI に渡すための情報（カード作成画面で作成・変更したカードに付く。最初から入っているカードにはない）
export interface CardNotes {
  effectText?: string; // 効果の文章（AI に実装してもらう内容）
  flavorText?: string; // 雰囲気の文（ルールには関係しない）
  illustrationPrompt?: string; // イラストのイメージ（AI に絵を描いてもらうための説明）
  implementation?: ImplementationStatus;
  memo?: string;
  updatedAt?: string; // 最後に保存・取り込みした日時（ISO 形式）。ブラウザの変更とプログラムのカードで新しい方を使う
}

interface BaseCard extends CardNotes {
  id: string;
  name: string;
  description: string;
  cost: number;
  race?: string;
  image?: string; // カードの絵の URL（未設定なら種族名を表示）
}

// モンスターの効果
export type MonsterAbility =
  | { kind: 'freeSpellOnSummon'; maxCost: number } // 召喚したとき、手札のコスト maxCost 以下のスペルを1枚、コストを払わずに使える
  | { kind: 'sniper' } // 後衛にいるとき、相手の前衛にモンスターがいても相手の後衛を攻撃できる
  | { kind: 'pierce'; amount: number } // 前衛から攻撃したとき、相手の後衛のモンスター1体（選んだもの）にも amount ダメージ
  | { kind: 'frontGuard'; amount: number } // 前衛にいるとき、受けるダメージを amount 減らす
  | { kind: 'medic'; amount: number } // 後衛にいるとき、自分のターン終了時に同じ位置の前衛の味方の HP を amount 回復
  | { kind: 'commander'; amount: number } // 後衛にいるとき、1ターンに1回、前衛の味方1体の FA をそのターンだけ amount 上げる
  | { kind: 'charge'; amount: number } // 後衛から前衛へ移動したターン、FA が amount 上がる
  | { kind: 'rearguard'; amount: number } // 前衛で攻撃されて倒されたとき、攻撃したモンスターに amount ダメージ
  | { kind: 'ambush'; amount: number } // 相手の場のモンスターが自分より多いとき、召喚のコストが amount 下がる
  | { kind: 'freeSummonOnSummon'; maxCost: number } // 召喚したとき、手札のコスト maxCost 以下のモンスターを1体、コストなしで召喚できる
  | { kind: 'discardSummon'; amount: number } // 手札を amount 枚捨てれば、エネルギーを払わずに召喚できる
  | { kind: 'spellDiscountOnSummon'; amount: number } // 召喚したとき、このターン次に使うスペルのコストが amount 下がる
  | { kind: 'energyNextTurnFromBack'; amount: number } // 後衛に召喚したとき、次の自分のターン開始時にエネルギー +amount
  | { kind: 'drawOnSummon'; amount: number } // 召喚したとき、カードを amount 枚引く
  | { kind: 'drawOnFrontDeath'; amount: number } // 前衛で倒されたとき、持ち主がカードを amount 枚引く
  | { kind: 'drawIfLowEnergy'; amount: number; threshold: number } // 後衛にいるとき、ターン終了時にエネルギーが threshold 以下なら amount 枚引く
  | { kind: 'discardOnSummon'; amount: number } // 召喚したとき、手札を amount 枚選んで捨てる
  | { kind: 'damageWhenDiscarded'; amount: number } // 相手の効果で手札から捨てられたとき、相手のモンスター1体に amount ダメージ
  | { kind: 'summonWhenDiscarded' }; // 相手の効果で手札から捨てられたとき、空きがあれば場に出る

export const MONSTER_ABILITY_KINDS: MonsterAbility['kind'][] = [
  'freeSpellOnSummon', 'sniper', 'pierce', 'frontGuard', 'medic', 'commander', 'charge', 'rearguard', 'ambush',
  'freeSummonOnSummon', 'discardSummon', 'spellDiscountOnSummon', 'energyNextTurnFromBack', 'drawOnSummon',
  'drawOnFrontDeath', 'drawIfLowEnergy', 'discardOnSummon', 'damageWhenDiscarded', 'summonWhenDiscarded',
];

export interface MonsterCard extends BaseCard {
  type: 'Monster';
  ability?: MonsterAbility; // 実装済みの効果（なければ効果なし、または未実装）
  frontAttack: number; // FA: 前衛にいるときの攻撃力
  backAttack: number; // BA: 後衛にいるときの攻撃力
  cardHp: number;
  maxHp?: number; // 最大HP（カード一覧にないカード用。なければ一覧の元のカードの HP）
}

// スペルの効果
export type SpellEffect =
  | { kind: 'buffFa'; amount: number } // 味方モンスターのFAをターン終了まで上げる
  | { kind: 'heal'; amount: number } // 味方モンスターのHPを回復する（最大HPまで）
  | { kind: 'damage'; amount: number } // 相手のモンスターにダメージを与える
  | { kind: 'buffBa'; amount: number } // 味方モンスターのBAをターン終了まで上げる
  | { kind: 'drawDiscard'; amount: number } // カードを amount 枚引き、その後手札から amount 枚を選んで墓地に置く（対象なし）
  | { kind: 'disableLeader'; amount: number } // このターンの間、相手の大将カードの効果をなくす（amount は使わない。対象は相手の大将）
  | { kind: 'damageBack'; amount: number } // 相手の後衛のモンスターにダメージを与える
  | { kind: 'forceMove'; amount: number } // 相手のモンスターを反対の列へ移動させ、相手の次のターンは移動できなくする（amount は使わない）
  | { kind: 'catchUpEnergy'; amount: number } // 相手のモンスターが自分より多いぶん、エネルギーを増やす（amount は使わない。対象なし）
  | { kind: 'damageFrontAll'; amount: number } // 相手の前衛のモンスターすべてに amount ダメージ（対象なし）
  | { kind: 'volley'; amount: number } // 相手の前衛のモンスター1体に、自分の後衛のモンスターの数 × amount ダメージ
  | { kind: 'retreat'; amount: number } // 自分の前衛のモンスター1体を後衛へ下げ、HP を amount 回復（移動回数を使わない）
  | { kind: 'swapColumn'; amount: number } // 自分のモンスターがいる位置の前衛と後衛を入れ替える（移動回数を使わない。amount は使わない）
  | { kind: 'pullForward'; amount: number } // 相手の後衛のモンスター1体を同じ位置の前衛へ移動（埋まっていれば入れ替え）。動いたモンスターは次のターン移動できない（amount は使わない）
  | { kind: 'lastStand'; amount: number } // 自分の場のモンスターが相手より少ないとき、このターン自分の全モンスターの FA・BA を amount 上げる（対象なし）
  | { kind: 'guardLeader'; amount: number } // 次の相手のターン、自分の大将が受けるダメージを1回につき amount 減らす（対象は自分の大将）
  | { kind: 'freeSummon'; amount: number } // 手札のコスト amount 以下のモンスター1体を、コストなしで前衛に召喚する（対象なし）
  | { kind: 'spellDiscount'; amount: number } // このターン、次に使うスペルのコストを amount 下げる（対象なし）
  | { kind: 'summonDiscount'; amount: number } // 自分のモンスターが相手より少ないとき、このターン次に召喚するモンスターのコストを amount 下げる（対象なし）
  | { kind: 'sacrificeSummon'; amount: number } // 自分のモンスター1体を墓地に置き、手札のコスト amount 以下のモンスターをコストなしで召喚する
  | { kind: 'delayedEnergy'; amount: number } // 次の自分のターン開始時、エネルギー +amount（対象なし）
  | { kind: 'discardForEnergy'; amount: number } // 手札を2枚捨て、エネルギー +amount（対象なし）
  | { kind: 'raiseMaxEnergy'; amount: number } // エネルギーの上限を amount 上げる（最大 RULES.maxEnergyLimit。対象なし）
  | { kind: 'drainEnergy'; amount: number } // 相手のエネルギーを amount 減らし、自分のエネルギーを1増やす（対象なし）
  | { kind: 'lifeToEnergy'; amount: number } // 自分の大将の HP を5減らし、エネルギー +amount（対象なし）
  | { kind: 'sacrificeForEnergy'; amount: number } // 自分のモンスター1体を墓地に置き、そのコストぶんエネルギーを得る（amount は使わない）
  | { kind: 'draw'; amount: number } // カードを amount 枚引く（対象なし）
  | { kind: 'supplyLine'; amount: number } // 自分の後衛のモンスターを好きな数だけ墓地に送り、その数だけ引く（amount は使わない）
  | { kind: 'spoils'; amount: number } // このターン、最初に相手のモンスターを倒したとき amount 枚引く（対象なし）
  | { kind: 'graveRob'; amount: number } // 自分の墓地のモンスター1体を手札に戻す（amount は使わない。対象なし）
  | { kind: 'discardDraw'; amount: number } // 手札を1枚捨て、カードを amount 枚引く（対象なし）
  | { kind: 'randomDiscard'; amount: number } // 相手の手札をランダムに amount 枚捨てさせる（対象なし）
  | { kind: 'firebomb'; amount: number } // 手札を1枚捨て、相手のモンスター1体に「捨てたカードのコスト + amount」ダメージ
  | { kind: 'reveal'; amount: number } // 相手の手札を見て、スペルを1枚選んで捨てさせる（amount は使わない。対象なし）
  | { kind: 'reshuffle'; amount: number } // 手札をすべて捨て、同じ枚数を引く（amount は使わない。対象なし）
  | { kind: 'custom' }; // まだ実装されていない効果（effectText に文章で書く。対戦では使えない）

// スペルの対象（まだ実装されていない効果のときに指定する。実装済みの効果は効果の種類から決まる）
export type SpellTarget = 'allyMonster' | 'enemyMonster' | 'anyMonster' | 'allyLeader' | 'enemyLeader' | 'none';

export interface SpellCard extends BaseCard {
  type: 'Spell';
  effect: SpellEffect;
  target?: SpellTarget;
  summary?: string; // 手札の小さなカードに表示する効果の要約（例: 'FA +1'）
}

// 対象を選ばずに使う効果
const UNTARGETED_EFFECT_KINDS: SpellEffect['kind'][] = [
  'drawDiscard', 'disableLeader', 'catchUpEnergy', 'damageFrontAll', 'lastStand', 'guardLeader',
  'freeSummon', 'spellDiscount', 'summonDiscount', 'delayedEnergy', 'discardForEnergy', 'raiseMaxEnergy', 'drainEnergy',
  'lifeToEnergy', 'draw', 'spoils', 'graveRob', 'discardDraw', 'randomDiscard', 'reveal', 'reshuffle',
];

// 対象を選ばずに使うスペルか（相手の大将など、対象が1つに決まるものも含む）
export const isUntargetedSpell = (spell: SpellCard): boolean =>
  UNTARGETED_EFFECT_KINDS.includes(spell.effect.kind)
  || (spell.effect.kind === 'custom' && (spell.target ?? 'none') === 'none');

// 数値を使わない効果（カード作成画面で数値の欄を出さない）
export const effectHasAmount = (kind: SpellEffect['kind']): boolean =>
  !['disableLeader', 'forceMove', 'catchUpEnergy', 'swapColumn', 'pullForward', 'sacrificeForEnergy', 'supplyLine',
    'graveRob', 'reveal', 'reshuffle', 'custom'].includes(kind);

// スペルの対象が味方モンスターか相手のモンスターか
export const getSpellTargetSide = (spell: SpellCard): 'ally' | 'enemy' => {
  if (['damage', 'damageBack', 'forceMove', 'volley', 'pullForward', 'firebomb'].includes(spell.effect.kind)) return 'enemy';
  if (spell.effect.kind === 'custom') return spell.target?.startsWith('enemy') ? 'enemy' : 'ally';
  return 'ally';
};

// スペルの対象（実装済みの効果は効果の種類から決まる。まだない効果は spell.target）
export const getSpellTarget = (spell: SpellCard): SpellTarget => {
  switch (spell.effect.kind) {
    case 'damage':
    case 'damageBack':
    case 'forceMove':
    case 'volley':
    case 'pullForward':
    case 'firebomb': return 'enemyMonster';
    case 'heal':
    case 'buffFa':
    case 'buffBa':
    case 'retreat':
    case 'swapColumn':
    case 'sacrificeSummon':
    case 'sacrificeForEnergy':
    case 'supplyLine': return 'allyMonster';
    case 'drawDiscard':
    case 'catchUpEnergy':
    case 'damageFrontAll':
    case 'lastStand':
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
    case 'reshuffle': return 'none';
    case 'guardLeader': return 'allyLeader';
    case 'disableLeader': return 'enemyLeader';
    case 'custom': return spell.target ?? 'none';
  }
};

// 実装済みのスペルの効果の種類（JSON やチェックで使う）
export const IMPLEMENTED_EFFECT_KINDS: Exclude<SpellEffect['kind'], 'custom'>[] = [
  'damage', 'heal', 'buffFa', 'buffBa', 'drawDiscard', 'disableLeader', 'damageBack', 'forceMove', 'catchUpEnergy',
  'damageFrontAll', 'volley', 'retreat', 'swapColumn', 'pullForward', 'lastStand', 'guardLeader',
  'freeSummon', 'spellDiscount', 'summonDiscount', 'sacrificeSummon', 'delayedEnergy', 'discardForEnergy', 'raiseMaxEnergy',
  'drainEnergy', 'lifeToEnergy', 'sacrificeForEnergy', 'draw', 'supplyLine', 'spoils', 'graveRob', 'discardDraw',
  'randomDiscard', 'firebomb', 'reveal', 'reshuffle',
];

export const isImplementedEffect = (effect: SpellEffect): effect is Exclude<SpellEffect, { kind: 'custom' }> =>
  effect.kind !== 'custom';

// 大将カード：大将ゾーンに置かれ、HPが0になると負け
// 大将カードの効果
export type LeaderAbility =
  | { kind: 'raceHpBonus'; race: string; amount: number } // ずっと：種族が race の自分のモンスターの HP を amount 上げる
  | { kind: 'rallyEnergy'; amount: number; hpThreshold?: number; hpRatio?: number } // 1回だけ：大将の HP が条件以下のとき、使うとエネルギーを amount 増やす（hpRatio：最大 HP に対する割合、hpThreshold：HP の値）
  | { kind: 'healOnMove'; amount: number } // ずっと：自分のモンスターが移動したとき、そのモンスターの HP を amount 回復
  | { kind: 'backRowBaBonus'; amount: number; hpRatio?: number } // ずっと：自分の後衛のモンスターの BA を amount 上げる（hpRatio があれば、大将の HP が最大 HP × hpRatio 以下のときだけ）
  | { kind: 'extraDrawWhenBehind'; margin: number; amount: number } // ずっと：ターン開始時、自分の場のモンスターが相手より margin 体以上少なければ amount 枚多く引く
  | { kind: 'spellEnergy'; amount: number } // ずっと：1ターンに1回、スペルを使ったときエネルギー +amount
  | { kind: 'extraDrawWhenFewCards'; handSize: number; amount: number }; // ずっと：ターン開始時、手札が handSize 枚以下なら amount 枚多く引く

export interface LeaderCard extends CardNotes {
  id: string;
  name: string;
  race?: string;
  ability?: LeaderAbility; // 実装済みの効果（なければ効果なし、または未実装）
  description: string;
  maxHp: number;
  image?: string;
}

export type Card = MonsterCard | SpellCard;
export type CardType = Card['type'];

export const isMonster = (card: Card): card is MonsterCard => card.type === 'Monster';
