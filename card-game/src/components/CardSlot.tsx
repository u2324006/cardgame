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
  onCancelAction: () => void;
  hasEffect?: boolean; // Keep this prop for compatibility with GameBoard
}

const CardSlot: React.FC<CardSlotProps> = ({ card, onClick, isAwaitingAction, onActivateEffect, onStartMoveTargeting, isSummonedThisTurn, row, index, onCancelAction }) => {
  console.log(`Card ID: ${card?.id}, hasEffect: ${card?.hasEffect}`); // この行を追加
  return (
    <div className="card-slot" onClick={onClick}>
      {card ? (
        <>
          <Card card={card} onClick={() => {}} isSelected={false} hasEffect={card.hasEffect} />
          {isAwaitingAction && card && (
            <div className="action-buttons-overlay">
              {card.hasEffect && onActivateEffect && (
                <button onClick={(e) => { e.stopPropagation(); onActivateEffect(card); }}>効果発動</button>
              )}
              {onStartMoveTargeting && (
                <button 
                  className={isSummonedThisTurn ? 'summoned-this-turn' : ''} 
                  onClick={(e) => { e.stopPropagation(); onStartMoveTargeting(card, { row, index }); }}
                >
                  移動
                </button>
              )}
              <button onClick={(e) => { e.stopPropagation(); onCancelAction(); }}>戻る</button>
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
