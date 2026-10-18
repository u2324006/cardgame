import React from 'react';
import { Card as CardType } from '../types/card';
import Card from './Card';

interface PickDialogProps {
  title: string;
  message: string;
  cards: CardType[];
  isPickable: (card: CardType) => boolean;
  onPick: (index: number) => void;
  onSkip?: () => void; // 選べるカードがないとき（「確認した」で閉じる）
}

// 墓地や相手の手札を並べて、1枚選ぶダイアログ（墓荒らし・情報戦）
const PickDialog: React.FC<PickDialogProps> = ({ title, message, cards, isPickable, onPick, onSkip }) => (
  <div className="dialog-backdrop">
    <div className="dialog pick-dialog" role="dialog" aria-modal="true" aria-label={title}>
      <p className="dialog-message"><b>{title}</b>：{message}</p>
      <div className="pick-cards">
        {cards.map((card, index) => (
          <div key={card.id} className={`pick-card ${isPickable(card) ? 'pickable' : 'unpickable'}`}>
            <Card card={card} onClick={isPickable(card) ? () => onPick(index) : undefined} />
          </div>
        ))}
        {cards.length === 0 && <p>カードがありません。</p>}
      </div>
      {onSkip && (
        <div className="dialog-actions">
          <button type="button" className="primary-button" onClick={onSkip}>確認した</button>
        </div>
      )}
    </div>
  </div>
);

export default PickDialog;
