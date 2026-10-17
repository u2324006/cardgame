import { Dispatch, SetStateAction, useEffect } from 'react';
import { GameState, PlayerId } from '../types/gameState';
import { endTurn, nextPhase } from '../logic/gameLogic';
import { runAiAttackPhase, runAiPlayPhase } from '../logic/ai';

const AI_STEP_DELAY_MS = 1000;
const AUTO_DRAW_DELAY_MS = 500;

// 人が操作しない進行を自動で行う：
// 自分のドローフェイズと、AI のターン全体（ドロー → 召喚など → 攻撃 → ターン終了）
export const useAutoProgress = (
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  aiPlayer: PlayerId,
) => {
  const { phase, currentPlayer, winner } = gameState;

  useEffect(() => {
    if (winner) return;
    let step: ((state: GameState) => GameState) | null = null;
    let delay = AI_STEP_DELAY_MS;

    if (currentPlayer === aiPlayer) {
      if (phase === 'Draw') step = nextPhase;
      else if (phase === 'Play') step = state => nextPhase(runAiPlayPhase(state, aiPlayer));
      else step = state => endTurn(runAiAttackPhase(state, aiPlayer));
    } else if (phase === 'Draw') {
      step = nextPhase;
      delay = AUTO_DRAW_DELAY_MS;
    }
    if (!step) return;

    const action = step;
    const timerId = setTimeout(() => setGameState(action), delay);
    return () => clearTimeout(timerId);
  }, [phase, currentPlayer, winner, aiPlayer, setGameState]);
};
