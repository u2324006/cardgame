import React from 'react';
import { Card as CardType } from '../types/card';
import Card from './Card';
import '../styles/CardSlot.css';

interface CardSlotProps {
  card: CardType | null;
  onClick: () => void;
  isAwaitingAction: boolean;
  onActivateEffect?: (card: CardType) => void;
  onStartMoveTargeting?: (card: CardType, fromPosition: { row: 'frontRow' | 'backRow', index: number }) => void;
  isSummonedThisTurn: boolean;
  row: 'frontRow' | 'backRow';
  index: number;
  hasEffect: boolean; // New prop
  onCancelAction: () => void; // New prop
}

const CardSlot: React.FC<CardSlotProps> = ({ card, onClick, isAwaitingAction, onActivateEffect, onStartMoveTargeting, isSummonedThisTurn, row, index, hasEffect, onCancelAction }) => {
  return (
    <div className="card-slot" onClick={onClick}>
      {card ? (
        <>
          <Card card={card} onClick={() => {}} isSelected={false} hasEffect={hasEffect} />
          {isAwaitingAction && (
            <div className="action-buttons-overlay">
              {onActivateEffect && hasEffect && (
                <button onClick={(e) => { e.stopPropagation(); console.log('onActivateEffect called for card:', card); onActivateEffect(card); }}>効果発動</button>
              )}
              {onStartMoveTargeting && card && (
                <button className={isSummonedThisTurn ? 'summoned-this-turn' : ''} onClick={(e) => { e.stopPropagation(); onStartMoveTargeting(card, { row, index }); }}>移動</button>
              )}
              <button onClick={(e) => { e.stopPropagation(); onCancelAction(); }}>戻る</button> {/* New button */}
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
