import React from 'react';
import { Card as CardType } from '../types/card';
import Card, { CardBack } from './Card';
import '../styles/Hand.css';

interface HandProps {
  cards: CardType[];
  onCardClick?: (index: number) => void;
  selectedCardIndex?: number | null;
  faceDown?: boolean;
}

const Hand: React.FC<HandProps> = ({ cards, onCardClick, selectedCardIndex, faceDown = false }) => {
  return (
    <div className="hand-container">
      {cards.map((card, index) => faceDown ? (
        <CardBack key={card.id} />
      ) : (
        <Card 
          key={card.id} 
          card={card} 
          onClick={() => onCardClick?.(index)} 
          isSelected={selectedCardIndex === index}
        />
      ))}
    </div>
  );
};

export default Hand;
