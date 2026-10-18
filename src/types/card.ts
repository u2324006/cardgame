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
  | { kind: 'pierce'; amount: number } // 前衛から攻撃したとき、相手の後衛のモンスター1体（HP が一番低いもの）にも amount ダメージ
  | { kind: 'frontGuard'; amount: number } // 前衛にいるとき、受けるダメージを amount 減らす
  | { kind: 'medic'; amount: number } // 後衛にいるとき、自分のターン終了時に同じ位置の前衛の味方の HP を amount 回復
  | { kind: 'commander'; amount: number } // 後衛にいるとき、1ターンに1回、前衛の味方1体の FA をそのターンだけ amount 上げる
  | { kind: 'charge'; amount: number } // 後衛から前衛へ移動したターン、FA が amount 上がる
  | { kind: 'rearguard'; amount: number } // 前衛で攻撃されて倒されたとき、攻撃したモンスターに amount ダメージ
  | { kind: 'ambush'; amount: number }; // 相手の場のモンスターが自分より多いとき、召喚のコストが amount 下がる

export const MONSTER_ABILITY_KINDS: MonsterAbility['kind'][] = [
  'freeSpellOnSummon', 'sniper', 'pierce', 'frontGuard', 'medic', 'commander', 'charge', 'rearguard', 'ambush',
];

export interface MonsterCard extends BaseCard {
  type: 'Monster';
  ability?: MonsterAbility; // 実装済みの効果（なければ効果なし、または未実装）
  frontAttack: number; // FA: 前衛にいるときの攻撃力
  backAttack: number; // BA: 後衛にいるときの攻撃力
  cardHp: number;
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
  | { kind: 'custom' }; // まだ実装されていない効果（effectText に文章で書く。対戦では使えない）

// スペルの対象（まだ実装されていない効果のときに指定する。実装済みの効果は効果の種類から決まる）
export type SpellTarget = 'allyMonster' | 'enemyMonster' | 'anyMonster' | 'allyLeader' | 'enemyLeader' | 'none';

export interface SpellCard extends BaseCard {
  type: 'Spell';
  effect: SpellEffect;
  target?: SpellTarget;
  summary?: string; // 手札の小さなカードに表示する効果の要約（例: 'FA +1'）
}

// 対象を選ばずに使うスペルか（相手の大将など、対象が1つに決まるものも含む）
export const isUntargetedSpell = (spell: SpellCard): boolean =>
  ['drawDiscard', 'disableLeader', 'catchUpEnergy', 'damageFrontAll', 'lastStand', 'guardLeader'].includes(spell.effect.kind)
  || (spell.effect.kind === 'custom' && (spell.target ?? 'none') === 'none');

// 数値を使わない効果（カード作成画面で数値の欄を出さない）
export const effectHasAmount = (kind: SpellEffect['kind']): boolean =>
  !['disableLeader', 'forceMove', 'catchUpEnergy', 'swapColumn', 'pullForward', 'custom'].includes(kind);

// スペルの対象が味方モンスターか相手のモンスターか
export const getSpellTargetSide = (spell: SpellCard): 'ally' | 'enemy' => {
  if (['damage', 'damageBack', 'forceMove', 'volley', 'pullForward'].includes(spell.effect.kind)) return 'enemy';
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
    case 'pullForward': return 'enemyMonster';
    case 'heal':
    case 'buffFa':
    case 'buffBa':
    case 'retreat':
    case 'swapColumn': return 'allyMonster';
    case 'drawDiscard':
    case 'catchUpEnergy':
    case 'damageFrontAll':
    case 'lastStand': return 'none';
    case 'guardLeader': return 'allyLeader';
    case 'disableLeader': return 'enemyLeader';
    case 'custom': return spell.target ?? 'none';
  }
};

// 実装済みのスペルの効果の種類（JSON やチェックで使う）
export const IMPLEMENTED_EFFECT_KINDS: Exclude<SpellEffect['kind'], 'custom'>[] = [
  'damage', 'heal', 'buffFa', 'buffBa', 'drawDiscard', 'disableLeader', 'damageBack', 'forceMove', 'catchUpEnergy',
  'damageFrontAll', 'volley', 'retreat', 'swapColumn', 'pullForward', 'lastStand', 'guardLeader',
];

export const isImplementedEffect = (effect: SpellEffect): effect is Exclude<SpellEffect, { kind: 'custom' }> =>
  effect.kind !== 'custom';

// 大将カード：大将ゾーンに置かれ、HPが0になると負け
// 大将カードの効果
export type LeaderAbility =
  | { kind: 'raceHpBonus'; race: string; amount: number } // ずっと：種族が race の自分のモンスターの HP を amount 上げる
  | { kind: 'rallyEnergy'; hpThreshold: number; amount: number } // 1回だけ：大将の HP が hpThreshold 以下のとき、使うとエネルギーを amount 増やす
  | { kind: 'healOnMove'; amount: number } // ずっと：自分のモンスターが移動したとき、そのモンスターの HP を amount 回復
  | { kind: 'backRowBaBonus'; amount: number } // ずっと：自分の後衛のモンスターの BA を amount 上げる
  | { kind: 'extraDrawWhenBehind'; margin: number; amount: number }; // ずっと：ターン開始時、自分の場のモンスターが相手より margin 体以上少なければ amount 枚多く引く

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
