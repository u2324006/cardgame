import React from 'react';
import { Card as CardType } from '../types/card';
import '../styles/Card.css';

interface CardProps {
  card: CardType;
  onClick: () => void;
  isSelected: boolean;
  isDiscarding?: boolean;
  hasEffect?: boolean; // Make prop optional
}

const Card: React.FC<CardProps> = ({ card, onClick, isSelected, isDiscarding, hasEffect }) => {
  return (
    <div className={`card ${card.type.toLowerCase()} ${isSelected ? 'selected' : ''} ${isDiscarding ? 'discarding' : ''} ${card.hasUsedEffectThisTurn ? 'used-effect' : ''}`} onClick={onClick}>
      {/* Top section: HP, Race, Cost */}
      <div className="card-top-section">
        <div className="card-hp">HP: {card.cardHp}</div>
        <div className="card-name">{card.name}</div>
        {(hasEffect || card.hasEffect) && <div className="card-effect-label">効果</div>} {/* Check both prop and card property */}
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
      {card.type === 'Monster' && (
        <div className="card-stats-bottom">
          <span>FA: {card.frontAttack}</span>
          <span>BA: {card.backAttack}</span>
        </div>
      )}
    </div>
  );
};

export default Card;
