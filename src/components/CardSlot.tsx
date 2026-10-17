import React from 'react';
import { MonsterCard } from '../types/card';
import Card from './Card';
import '../styles/CardSlot.css';

interface CardSlotProps {
  card: MonsterCard | null;
  onClick: () => void;
  isSelected?: boolean;
}

const CardSlot: React.FC<CardSlotProps> = ({ card, onClick, isSelected = false }) => {
  return (
    <div className="card-slot" onClick={onClick}>
      {card ? <Card card={card} isSelected={isSelected} /> : <div className="empty-slot"></div>}
    </div>
  );
};

export default CardSlot;
