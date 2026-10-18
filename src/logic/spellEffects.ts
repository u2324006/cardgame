import { SpellEffect } from '../types/card';

// スペルの効果の文章（実装済みの効果は、カードに表示し、対戦でもこのとおりに動く）

// 効果の説明文。まだない効果は空
export const describeEffect = (effect: SpellEffect): string => {
  switch (effect.kind) {
    case 'damage': return `相手のモンスター1体に${effect.amount}ダメージを与える。`;
    case 'heal': return `味方モンスター1体のHPを${effect.amount}回復する（最大HPまで）。`;
    case 'buffFa': return `味方モンスター1体のFAを、ターン終了まで${effect.amount}上げる。`;
    case 'buffBa': return `味方モンスター1体のBAを、ターン終了まで${effect.amount}上げる。`;
    case 'drawDiscard': return `カードを${effect.amount}枚引き、その後手札から${effect.amount}枚を選んで墓地に置く。`;
    case 'disableLeader': return 'このターンの間、相手の大将カードの効果をなくす。';
    case 'damageBack': return `相手の後衛のモンスター1体に${effect.amount}ダメージを与える。`;
    case 'forceMove': return '相手のモンスター1体を反対の列へ移動させる。相手は次のターン、そのモンスターを移動できない。';
    case 'catchUpEnergy': return '相手のモンスターの数が自分より多いとき、その差だけエネルギーを増やす。';
    case 'damageFrontAll': return `相手の前衛のモンスターすべてに${effect.amount}ダメージを与える。`;
    case 'volley': return `相手の前衛のモンスター1体に、自分の後衛にいるモンスターの数×${effect.amount}ダメージを与える。`;
    case 'retreat': return `自分の前衛のモンスター1体を後衛へ下げ、HPを${effect.amount}回復する（移動の回数を使わない）。`;
    case 'swapColumn': return '自分のモンスター1体がいる位置の、前衛と後衛のモンスターを入れ替える（移動の回数を使わない）。';
    case 'pullForward': return '相手の後衛のモンスター1体を同じ位置の前衛へ移動させる（前衛にモンスターがいれば入れ替える）。移動したモンスターは次のターン移動できない。';
    case 'lastStand': return `自分の場のモンスターが相手より少ないとき、このターン自分の全モンスターのFA・BAを${effect.amount}上げる。`;
    case 'guardLeader': return `次の相手のターン、自分の大将が受けるダメージを1回につき${effect.amount}減らす。`;
    case 'custom': return '';
  }
};

// 手札の小さいカードに出す効果の要約
export const summarizeEffect = (effect: SpellEffect): string => {
  switch (effect.kind) {
    case 'damage': return `${effect.amount}ダメージ`;
    case 'heal': return `HP +${effect.amount}`;
    case 'buffFa': return `FA +${effect.amount}`;
    case 'buffBa': return `BA +${effect.amount}`;
    case 'drawDiscard': return `${effect.amount}枚引いて${effect.amount}枚捨てる`;
    case 'disableLeader': return '大将の効果を消す';
    case 'damageBack': return `後衛に${effect.amount}ダメージ`;
    case 'forceMove': return '相手を移動';
    case 'catchUpEnergy': return '数の差だけエネルギー';
    case 'damageFrontAll': return `前衛すべてに${effect.amount}ダメージ`;
    case 'volley': return `後衛の数×${effect.amount}ダメージ`;
    case 'retreat': return `後衛へ下げてHP +${effect.amount}`;
    case 'swapColumn': return '前衛と後衛を入れ替え';
    case 'pullForward': return '相手の後衛を前衛へ';
    case 'lastStand': return `劣勢なら全員 +${effect.amount}`;
    case 'guardLeader': return `大将へのダメージ -${effect.amount}`;
    case 'custom': return '効果未実装';
  }
};
