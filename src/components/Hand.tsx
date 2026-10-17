import React from 'react';
import { Card as CardType } from '../types/card';
import Card, { CardBack } from './Card';
import '../styles/Hand.css';

interface HandProps {
  cards: CardType[];
  onCardClick?: (index: number) => void;
  onCardHover?: (card: CardType | null) => void;
  selectedCardIndex?: number | null;
  faceDown?: boolean;
}

const Hand: React.FC<HandProps> = ({ cards, onCardClick, onCardHover, selectedCardIndex, faceDown = false }) => {
  if (faceDown) {
    return (
      <div className="hand-container face-down">
        {cards.map(card => <CardBack key={card.id} />)}
      </div>
    );
  }
  return (
    <div className="hand-container">
      {cards.map((card, index) => (
        <Card
          key={card.id}
          card={card}
          onClick={() => onCardClick?.(index)}
          onMouseEnter={() => onCardHover?.(card)}
          onMouseLeave={() => onCardHover?.(null)}
          isSelected={selectedCardIndex === index}
        />
      ))}
    </div>
  );
};

export default Hand;
