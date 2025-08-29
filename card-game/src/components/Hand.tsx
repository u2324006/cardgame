import React from 'react';
import { Card as CardType } from '../types/card';
import Card from './Card';
import '../styles/Hand.css';

interface HandProps {
  cards: CardType[];
  onCardClick: (index: number) => void;
  selectedCardIndex?: number | null;
  cardsToDiscard?: CardType[];
}

const Hand: React.FC<HandProps> = ({ cards, onCardClick, selectedCardIndex, cardsToDiscard }) => {
  return (
    <div className="hand-container">
      {cards.map((card, index) => {
        const isDiscarding = cardsToDiscard?.some(dCard => dCard.id === card.id) ?? false;
        return (
          <Card 
            key={card.id} 
            card={card} 
            onClick={() => onCardClick(index)} 
            isSelected={selectedCardIndex === index}
            isDiscarding={isDiscarding}
            hasEffect={card.hasEffect || false}
          />
        );
      })}
    </div>
  );
};

export default Hand;
