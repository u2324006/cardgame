import React from 'react';
import { Card as CardType, isMonster } from '../types/card';
import { Row } from '../types/gameState';
import { getMaxHp } from '../logic/cards';
import '../styles/Card.css';

export interface HoverHandlers {
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

interface CardProps extends HoverHandlers {
  card: CardType;
  onClick?: () => void;
  isSelected?: boolean;
  row?: Row; // 場にいる列。使われない方の攻撃力（前衛なら BA）を薄く表示する
  size?: 'normal' | 'large'; // large はカード情報欄用で、説明文も表示する
  usedLabel?: string; // 行動済みのとき（例: '攻撃済み'）。カードを薄く表示してラベルを出す
}

// 裏向きのカード（相手の手札など）
export const CardBack: React.FC = () => (
  <div className="card-back">
    <div className="card-back-inner" />
  </div>
);

// カードの絵。未設定なら種族名を表示する
export const CardArt: React.FC<{ image?: string; label?: string; children?: React.ReactNode }> = ({ image, label, children }) => (
  <div className="card-art">
    {image ? <img src={image} alt="" /> : <span className="card-art-label">{label}</span>}
    {children}
  </div>
);

const Card: React.FC<CardProps> = ({ card, onClick, isSelected = false, row, size = 'normal', usedLabel, onMouseEnter, onMouseLeave }) => {
  const monster = isMonster(card) ? card : null;
  const spell = isMonster(card) ? null : card;
  const classes = ['card', card.type.toLowerCase(), size, isSelected && 'selected', usedLabel && 'used'].filter(Boolean).join(' ');
  return (
    <div className={classes} onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {usedLabel && <div className="card-used-label">{usedLabel}</div>}
      <div className="card-header">
        <div className="card-cost">{card.cost}</div>
        <div className="card-name">{card.name}</div>
      </div>

      <CardArt image={card.image} label={card.race}>
        {monster && (
          <div className={`card-hp ${monster.cardHp < getMaxHp(monster) ? 'damaged' : ''}`}>HP {monster.cardHp}</div>
        )}
      </CardArt>

      {size === 'large' && <div className="card-description">{card.description}</div>}

      {monster && (
        <div className="card-stats">
          <span className={`card-stat fa ${row === 'backRow' ? 'inactive' : ''}`}>FA {monster.frontAttack}</span>
          <span className={`card-stat ba ${row === 'frontRow' ? 'inactive' : ''}`}>BA {monster.backAttack}</span>
        </div>
      )}
      {spell && size === 'normal' && <div className="card-summary">{spell.summary ?? 'スペル'}</div>}
    </div>
  );
};

export default Card;
