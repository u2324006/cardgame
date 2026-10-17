import React from 'react';
import { Phase } from '../types/gameState';

interface ControlPanelProps {
  turn: number;
  phase: Phase;
  isPlayerTurn: boolean;
  onNextPhase: () => void;
  onEndTurn: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ turn, phase, isPlayerTurn, onNextPhase, onEndTurn }) => (
  <div className="control-panel">
    <div className="turn-info">ターン {turn}</div>
    <div className="phase-button">{phase} フェイズ</div>
    <div className="current-player-info">{isPlayerTurn ? 'あなたのターン' : '相手のターン'}</div>
    {isPlayerTurn && (
      <>
        {phase !== 'Draw' && <button onClick={onNextPhase} className="phase-button">次のフェイズへ</button>}
        <button onClick={onEndTurn} className="turn-button">ターン終了</button>
      </>
    )}
  </div>
);

export default ControlPanel;
