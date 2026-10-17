import React from 'react';
import { Card as CardType, isMonster } from '../types/card';
import '../styles/Card.css';

interface CardProps {
  card: CardType;
  onClick?: () => void;
  isSelected?: boolean;
}

// 裏向きのカード（相手の手札など）
export const CardBack: React.FC = () => <div className="card card-back" />;

const Card: React.FC<CardProps> = ({ card, onClick, isSelected = false }) => {
  const monster = isMonster(card) ? card : null;
  return (
    <div className={`card ${card.type.toLowerCase()} ${isSelected ? 'selected' : ''}`} onClick={onClick}>
      {/* Top section: HP, Race, Cost */}
      <div className="card-top-section">
        <div className="card-hp" style={{ visibility: monster ? undefined : 'hidden' }}>HP: {monster?.cardHp}</div>
        <div className="card-race">{card.race}</div>
        <div className="card-cost-circle">
          <div className="card-cost-value">{card.cost}</div>
        </div>
      </div>

      {/* Image/Art Area */}
      <div className="card-image-area">
        {/* Placeholder for image */}
      </div>

      {/* Description Area */}
      <div className="card-description-area">
        {card.description}
      </div>

      {/* Bottom section: FA/BA */}
      {monster && (
        <div className="card-stats-bottom">
          <span>FA: {monster.frontAttack}</span>
          <span>BA: {monster.backAttack}</span>
        </div>
      )}
    </div>
  );
};

export default Card;
