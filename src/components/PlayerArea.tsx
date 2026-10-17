import React from 'react';
import { FieldPosition, PlayerState, Row } from '../types/gameState';
import Hand from './Hand';
import CardSlot from './CardSlot';
import EnergyZone from './EnergyZone';

interface PlayerAreaProps {
  playerState: PlayerState;
  isOpponent: boolean;
  onSlotClick: (row: Row, index: number) => void;
  onSpecialCardClick?: () => void;
  onHandCardClick?: (index: number) => void;
  selectedCardIndex?: number | null;
  selectedPosition?: FieldPosition | null;
}

// 1人分の盤面（手札・フィールド・山札/墓地・大将カード・エネルギー）
const PlayerArea: React.FC<PlayerAreaProps> = ({
  playerState,
  isOpponent,
  onSlotClick,
  onSpecialCardClick,
  onHandCardClick,
  selectedCardIndex,
  selectedPosition,
}) => {
  // 自分から見て前衛が中央側になるよう、相手は後衛→前衛の順に並べる
  const rows: Row[] = isOpponent ? ['backRow', 'frontRow'] : ['frontRow', 'backRow'];
  const hand = isOpponent
    ? <Hand cards={playerState.hand} faceDown />
    : <Hand cards={playerState.hand} onCardClick={onHandCardClick} selectedCardIndex={selectedCardIndex} />;

  return (
    <div className={`player-area ${isOpponent ? 'opponent-area' : 'self-area'}`}>
      {isOpponent && hand}
      <div className="field-and-deck">
        <div className="field">
          {rows.map(row => (
            <div key={row} className={`row ${row === 'frontRow' ? 'front-row' : 'back-row'}`}>
              {playerState.field[row].map((card, i) => (
                <CardSlot
                  key={i}
                  card={card}
                  onClick={() => onSlotClick(row, i)}
                  isSelected={selectedPosition?.row === row && selectedPosition.index === i}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="deck-graveyard">
          <div className="deck">山札: {playerState.deck.length}</div>
          <div className="graveyard">墓地: {playerState.graveyard.length}</div>
        </div>
        <div className="special-card-hp" onClick={onSpecialCardClick}>HP: {playerState.specialCardHp}</div>
        <EnergyZone
          currentEnergy={playerState.currentEnergy}
          maxEnergy={playerState.maxEnergy}
          className={isOpponent ? 'rotated' : undefined}
        />
      </div>
      {!isOpponent && hand}
    </div>
  );
};

export default PlayerArea;
