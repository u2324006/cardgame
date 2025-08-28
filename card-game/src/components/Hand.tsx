import React from 'react';
import { Card as CardType } from '../types/card';
import Card from './Card';
import '../styles/Hand.css';

interface HandProps {
  cards: CardType[];
  onCardClick: (index: number) => void;
  selectedCardIndex?: number | null;
}

const Hand: React.FC<HandProps> = ({ cards, onCardClick, selectedCardIndex }) => {
  return (
    <div className="hand-container">
      {cards.map((card, index) => (
        <Card 
          key={card.id} 
          card={card} 
          onClick={() => onCardClick(index)} 
          isSelected={selectedCardIndex === index}
          hasEffect={card.hasEffect || false}
        />
      ))}
    </div>
  );
};

export default Hand;
