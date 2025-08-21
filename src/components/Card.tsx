import React from 'react';
import { Card as CardType } from '../types/card';
import '../styles/Card.css';

interface CardProps {
  card: CardType;
  onClick: () => void;
  isSelected: boolean;
}

const Card: React.FC<CardProps> = ({ card, onClick, isSelected }) => {
  return (
    <div className={`card ${card.type.toLowerCase()} ${isSelected ? 'selected' : ''}`} onClick={onClick}>
      <div className="card-name">{card.name}</div>
      <div className="card-cost">Cost: {card.cost}</div>
      <div className="card-description">{card.description}</div>
      {card.type === 'Monster' && (
        <div className="card-stats">
          <span>ATK: {card.attack}</span>
          <span>DEF: {card.defense}</span>
        </div>
      )}
    </div>
  );
};

export default Card;
