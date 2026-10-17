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
  usedLabel?: string;
}

const CardSlot: React.FC<CardSlotProps> = ({ card, row, onClick, isSelected = false, usedLabel, onMouseEnter, onMouseLeave }) => (
  <div className={`card-slot ${card ? '' : 'empty'}`} onClick={onClick}>
    {card && (
      <Card card={card} row={row} isSelected={isSelected} usedLabel={usedLabel} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} />
    )}
  </div>
);

export default CardSlot;
