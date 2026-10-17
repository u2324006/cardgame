import React from 'react';
import { Card as CardType, LeaderCard as LeaderCardType } from '../types/card';
import { Row } from '../types/gameState';
import Card from './Card';
import LeaderCard from './LeaderCard';

// カード情報欄に大きく表示するもの
export type InspectTarget =
  | { kind: 'card'; card: CardType; row?: Row }
  | { kind: 'leader'; leader: LeaderCardType; hp: number };

const CardPreview: React.FC<{ target: InspectTarget | null }> = ({ target }) => {
  if (!target) {
    return <div className="card-preview-empty">カードにマウスを乗せるか選択すると、ここに詳細が表示されます。</div>;
  }
  return (
    <>
      {target.kind === 'leader'
        ? <LeaderCard leader={target.leader} hp={target.hp} size="large" />
        : <Card card={target.card} row={target.row} size="large" />}
      <div className="card-preview-note">
        {target.kind === 'leader'
          ? '大将カードのHPが0になると負けです。'
          : '前衛にいるときは FA、後衛にいるときは BA で攻撃します。'}
      </div>
    </>
  );
};

export default CardPreview;
