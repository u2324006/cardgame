import React, { useState } from 'react';
import ConfirmDialog from './ConfirmDialog';
import { Phase } from '../types/gameState';
import { getRound } from '../logic/gameLogic';

interface ControlPanelProps {
  turn: number;
  phase: Phase;
  isPlayerTurn: boolean;
  canAttack: boolean; // このターンにアタックフェイズがあるか（先手の1ターン目はない）
  isBusy?: boolean; // 捨てるカードを選んでいる途中など、フェイズを進められないとき
  onNextPhase: () => void;
  onEndTurn: () => void;
  onExit?: () => void;
}

const PHASES: { phase: Phase; label: string }[] = [
  { phase: 'Draw', label: 'ドロー' },
  { phase: 'Play', label: 'プレイ' },
  { phase: 'Attack', label: 'アタック' },
];

const ControlPanel: React.FC<ControlPanelProps> = ({ turn, phase, isPlayerTurn, canAttack, isBusy = false, onNextPhase, onEndTurn, onExit }) => {
  // ドローフェイズは自動で進むので、その間は操作できないようにする
  const canAct = isPlayerTurn && phase !== 'Draw' && !isBusy;
  // アタックフェイズがないターンのプレイフェイズでは「次のフェイズへ」は出さない（ターン終了のみ）
  const hasNextPhase = !(phase === 'Play' && !canAttack);
  const [isConfirmingExit, setIsConfirmingExit] = useState(false);
  return (
    <div className="control-panel">
      <div className="turn-info">ラウンド {getRound(turn)}</div>
      <div className={`current-player ${isPlayerTurn ? 'self' : 'opponent'}`}>
        {isPlayerTurn ? 'あなたのターン' : '相手のターン'}
      </div>
      <ol className="phase-steps">
        {PHASES.map((step, i) => (
          <li
            key={step.phase}
            className={[step.phase === phase && 'active', step.phase === 'Attack' && !canAttack && 'skipped'].filter(Boolean).join(' ')}
            aria-current={step.phase === phase ? 'step' : undefined}
          >
            <span className="phase-step-no">{i + 1}</span>{step.label}
            {step.phase === 'Attack' && !canAttack && <span className="phase-step-note">先手1ターン目はなし</span>}
          </li>
        ))}
      </ol>
      {isPlayerTurn && (
        <>
          {hasNextPhase && <button onClick={onNextPhase} className="primary-button" disabled={!canAct}>次のフェイズへ</button>}
          <button onClick={onEndTurn} className={hasNextPhase ? 'secondary-button' : 'primary-button'} disabled={!canAct}>ターン終了</button>
        </>
      )}
      {onExit && (
        <button onClick={() => setIsConfirmingExit(true)} className="text-button">
          メニューへ戻る
        </button>
      )}
      {onExit && isConfirmingExit && (
        <ConfirmDialog
          message="対戦を中断してメニューへ戻りますか？メニューの「続きから」で再開できます。"
          confirmLabel="メニューへ戻る"
          onConfirm={onExit}
          onCancel={() => setIsConfirmingExit(false)}
        />
      )}
    </div>
  );
};

export default ControlPanel;
