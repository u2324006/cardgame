import React from 'react';
import { Card as CardType } from '../types/card';
import Card from './Card';
import '../styles/CardSlot.css';

interface CardSlotProps {
  card: CardType | null;
  onClick: () => void;
  isAwaitingAction: boolean; // New prop
  onActivateEffect?: (card: CardType) => void; // New prop for effect activation
  onMoveCard?: (card: CardType) => void; // New prop for card movement
}

const CardSlot: React.FC<CardSlotProps> = ({ card, onClick, isAwaitingAction, onActivateEffect, onMoveCard }) => {
  return (
    <div className="card-slot" onClick={onClick}>
      {card ? (
        <>
          <Card card={card} onClick={() => {}} isSelected={false} />
          {isAwaitingAction && card.name === '僧侶' && (
            <div className="action-buttons-overlay">
              <button onClick={(e) => { e.stopPropagation(); console.log('onActivateEffect called for card:', card); onActivateEffect && onActivateEffect(card); }}>効果発動</button>
              <button onClick={(e) => { e.stopPropagation(); onMoveCard && onMoveCard(card); }}>移動</button>
            </div>
          )}
        </>
      ) : (
        <div className="empty-slot"></div>
      )}
    </div>
  );
};

export default CardSlot;
