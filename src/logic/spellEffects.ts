import { SpellEffect } from '../types/card';

// スペルの効果の文章（実装済みの効果は、カードに表示し、対戦でもこのとおりに動く）

// 効果の説明文。まだない効果は空
export const describeEffect = (effect: SpellEffect): string => {
  switch (effect.kind) {
    case 'damage': return `相手のモンスター1体に${effect.amount}ダメージを与える。`;
    case 'heal': return `味方モンスター1体のHPを${effect.amount}回復する（最大HPまで）。`;
    case 'buffFa': return `味方モンスター1体のFAを、ターン終了まで${effect.amount}上げる。`;
    case 'custom': return '';
  }
};

// 手札の小さいカードに出す効果の要約
export const summarizeEffect = (effect: SpellEffect): string => {
  switch (effect.kind) {
    case 'damage': return `${effect.amount}ダメージ`;
    case 'heal': return `HP +${effect.amount}`;
    case 'buffFa': return `FA +${effect.amount}`;
    case 'custom': return '効果未実装';
  }
};
