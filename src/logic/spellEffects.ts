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
    case 'custom': return '効果未実装';
  }
};
