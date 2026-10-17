import React from 'react';
import { Card as CardType, LeaderCard as LeaderCardType, getSpellTargetSide, isMonster } from '../types/card';
import { Row } from '../types/gameState';
import Card from './Card';
import LeaderCard from './LeaderCard';

// カード情報欄に大きく表示するもの
export type InspectTarget =
  | { kind: 'card'; card: CardType; row?: Row; hpBonus?: number }
  | { kind: 'leader'; leader: LeaderCardType; hp: number; isDisabled?: boolean };

const previewNote = (target: InspectTarget): string => {
  if (target.kind === 'leader') return '大将カードのHPが0になると負けです。';
  if (!isMonster(target.card)) {
    const side = getSpellTargetSide(target.card) === 'enemy' ? '相手' : '味方';
    return `手札で選んでから、対象の${side}モンスターをクリックして使います。`;
  }
  return '前衛にいるときは FA、後衛にいるときは BA で攻撃します。';
};

const CardPreview: React.FC<{ target: InspectTarget | null }> = ({ target }) => {
  if (!target) {
    return <div className="card-preview-empty">カードにマウスを乗せるか選択すると、ここに詳細が表示されます。</div>;
  }
  return (
    <>
      {target.kind === 'leader'
        ? <LeaderCard leader={target.leader} hp={target.hp} isDisabled={target.isDisabled} size="large" />
        : <Card card={target.card} row={target.row} hpBonus={target.hpBonus} size="large" />}
      <div className="card-preview-note">{previewNote(target)}</div>
    </>
  );
};

export default CardPreview;
