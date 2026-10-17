import React from 'react';
import { Phase } from '../types/gameState';

interface ControlPanelProps {
  turn: number;
  phase: Phase;
  isPlayerTurn: boolean;
  onNextPhase: () => void;
  onEndTurn: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ turn, phase, isPlayerTurn, onNextPhase, onEndTurn }) => {
  // ドローフェイズは自動で進むので、その間は操作できないようにする
  const canAct = isPlayerTurn && phase !== 'Draw';
  return (
    <div className="control-panel">
      <div className="turn-info">ターン {turn}</div>
      <div className="phase-label">{phase} フェイズ</div>
      <div className="current-player-info">{isPlayerTurn ? 'あなたのターン' : '相手のターン'}</div>
      {isPlayerTurn && (
        <>
          <button onClick={onNextPhase} className="phase-button" disabled={!canAct}>次のフェイズへ</button>
          <button onClick={onEndTurn} className="turn-button" disabled={!canAct}>ターン終了</button>
        </>
      )}
    </div>
  );
};

export default ControlPanel;
