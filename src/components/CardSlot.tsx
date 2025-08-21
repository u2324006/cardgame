import React from 'react';
import { Card as CardType } from '../types/card';
import Card from './Card';
import '../styles/CardSlot.css';

interface CardSlotProps {
  card: CardType | null;
  onClick: () => void;
}

const CardSlot: React.FC<CardSlotProps> = ({ card, onClick }) => {
  return (
    <div className="card-slot" onClick={onClick}>
      {card ? <Card card={card} onClick={() => {}} isSelected={false} /> : <div className="empty-slot"></div>}
    </div>
  );
};

export default CardSlot;
