import React, { useState } from 'react';
import ConfirmDialog from './ConfirmDialog';
import { Phase } from '../types/gameState';

interface ControlPanelProps {
  turn: number;
  phase: Phase;
  isPlayerTurn: boolean;
  onNextPhase: () => void;
  onEndTurn: () => void;
  onExit?: () => void;
}

const PHASES: { phase: Phase; label: string }[] = [
  { phase: 'Draw', label: 'ドロー' },
  { phase: 'Play', label: 'プレイ' },
  { phase: 'Attack', label: 'アタック' },
];

const ControlPanel: React.FC<ControlPanelProps> = ({ turn, phase, isPlayerTurn, onNextPhase, onEndTurn, onExit }) => {
  // ドローフェイズは自動で進むので、その間は操作できないようにする
  const canAct = isPlayerTurn && phase !== 'Draw';
  const [isConfirmingExit, setIsConfirmingExit] = useState(false);
  return (
    <div className="control-panel">
      <div className="turn-info">ターン {turn}</div>
      <div className={`current-player ${isPlayerTurn ? 'self' : 'opponent'}`}>
        {isPlayerTurn ? 'あなたのターン' : '相手のターン'}
      </div>
      <ol className="phase-steps">
        {PHASES.map((step, i) => (
          <li key={step.phase} className={step.phase === phase ? 'active' : ''} aria-current={step.phase === phase ? 'step' : undefined}>
            <span className="phase-step-no">{i + 1}</span>{step.label}
          </li>
        ))}
      </ol>
      {isPlayerTurn && (
        <>
          <button onClick={onNextPhase} className="primary-button" disabled={!canAct}>次のフェイズへ</button>
          <button onClick={onEndTurn} className="secondary-button" disabled={!canAct}>ターン終了</button>
        </>
      )}
      {onExit && (
        <button onClick={() => setIsConfirmingExit(true)} className="text-button">
          メニューへ戻る
        </button>
      )}
      {onExit && isConfirmingExit && (
        <ConfirmDialog
          message="対戦をやめてメニューへ戻りますか？"
          confirmLabel="メニューへ戻る"
          onConfirm={onExit}
          onCancel={() => setIsConfirmingExit(false)}
        />
      )}
    </div>
  );
};

export default ControlPanel;
