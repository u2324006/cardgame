import React from 'react';
import { MonsterCard } from '../types/card';
import { Row } from '../types/gameState';
import Card, { HoverHandlers } from './Card';
import '../styles/CardSlot.css';

interface CardSlotProps extends HoverHandlers {
  card: MonsterCard | null;
  row: Row;
  onClick: () => void;
  isSelected?: boolean;
}

const CardSlot: React.FC<CardSlotProps> = ({ card, row, onClick, isSelected = false, onMouseEnter, onMouseLeave }) => (
  <div className={`card-slot ${card ? '' : 'empty'}`} onClick={onClick}>
    {card && (
      <Card card={card} row={row} isSelected={isSelected} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} />
    )}
  </div>
);

export default CardSlot;
