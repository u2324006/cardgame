import React from 'react';
import { FieldPosition, PlayerState, Row } from '../types/gameState';
import Hand from './Hand';
import CardSlot from './CardSlot';
import EnergyZone from './EnergyZone';
import LeaderCard from './LeaderCard';
import { InspectTarget } from './CardPreview';

interface PlayerAreaProps {
  playerState: PlayerState;
  isOpponent: boolean;
  onSlotClick: (row: Row, index: number) => void;
  onLeaderClick?: () => void;
  isLeaderTargetable?: boolean;
  onHandCardClick?: (index: number) => void;
  onInspect: (target: InspectTarget | null) => void;
  selectedCardIndex?: number | null;
  selectedPosition?: FieldPosition | null;
}

const ROW_LABELS: Record<Row, string> = { frontRow: '前衛', backRow: '後衛' };

// 1人分の盤面（手札・フィールド・大将カード・エネルギー・山札/墓地）
const PlayerArea: React.FC<PlayerAreaProps> = ({
  playerState,
  isOpponent,
  onSlotClick,
  onLeaderClick,
  isLeaderTargetable,
  onHandCardClick,
  onInspect,
  selectedCardIndex,
  selectedPosition,
}) => {
  // 自分から見て前衛が中央側になるよう、相手は後衛→前衛の順に並べる
  const rows: Row[] = isOpponent ? ['backRow', 'frontRow'] : ['frontRow', 'backRow'];
  const { leader, specialCardHp } = playerState;
  const hand = isOpponent
    ? <Hand cards={playerState.hand} faceDown />
    : (
      <Hand
        cards={playerState.hand}
        onCardClick={onHandCardClick}
        onCardHover={card => onInspect(card ? { kind: 'card', card } : null)}
        selectedCardIndex={selectedCardIndex}
      />
    );

  return (
    <div className={`player-area ${isOpponent ? 'opponent-area' : 'self-area'}`}>
      {isOpponent && hand}
      <div className="field-and-side">
        <div className="field">
          {rows.map(row => (
            <div key={row} className={`row ${row === 'frontRow' ? 'front-row' : 'back-row'}`}>
              <div className="row-label">{ROW_LABELS[row]}</div>
              {playerState.field[row].map((card, i) => (
                <CardSlot
                  key={i}
                  card={card}
                  row={row}
                  onClick={() => onSlotClick(row, i)}
                  isSelected={selectedPosition?.row === row && selectedPosition.index === i}
                  onMouseEnter={() => card && onInspect({ kind: 'card', card, row })}
                  onMouseLeave={() => onInspect(null)}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="side-panel">
          <div className="side-label">{isOpponent ? '相手' : 'あなた'}</div>
          <LeaderCard
            leader={leader}
            hp={specialCardHp}
            onClick={onLeaderClick}
            isTargetable={isLeaderTargetable}
            onMouseEnter={() => onInspect({ kind: 'leader', leader, hp: specialCardHp })}
            onMouseLeave={() => onInspect(null)}
          />
          <EnergyZone currentEnergy={playerState.currentEnergy} maxEnergy={playerState.maxEnergy} />
          <div className="piles">山札 {playerState.deck.length} ・ 墓地 {playerState.graveyard.length}</div>
        </div>
      </div>
      {!isOpponent && hand}
    </div>
  );
};

export default PlayerArea;
