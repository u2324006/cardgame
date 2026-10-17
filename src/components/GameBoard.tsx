import React, { useState, useEffect } from 'react';
import '../styles/GameBoard.css';
import { createInitialGameState } from '../logic/initialState';
import {
  ActionResult,
  attack,
  castSpell,
  endTurn,
  getCardAt,
  moveMonster,
  nextPhase,
  playCard,
} from '../logic/gameLogic';
import { runAiAttackPhase, runAiPlayPhase } from '../logic/ai';
import { FieldPosition, GameState, PlayerId, Row } from '../types/gameState';
import PlayerArea from './PlayerArea';
import ControlPanel from './ControlPanel';

const HUMAN: PlayerId = 'player1';
const AI: PlayerId = 'player2';
const AI_STEP_DELAY_MS = 1000;
const AUTO_DRAW_DELAY_MS = 500;
const MESSAGE_DURATION_MS = 3000;

const GameBoard: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(createInitialGameState);
  // UI上の選択状態（ゲームのルールには関係しない）
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const [attackerPosition, setAttackerPosition] = useState<FieldPosition | null>(null);
  const [movingFrom, setMovingFrom] = useState<FieldPosition | null>(null);
  // 画面に一定時間表示するメッセージ（id は同じ文言が続いたときもタイマーを延長するため）
  const [message, setMessage] = useState<{ id: number; text: string } | null>(null);

  const { players, turn, phase, currentPlayer, winner } = gameState;
  const isPlayer1Turn = currentPlayer === HUMAN;
  const attackerCard = attackerPosition ? getCardAt(gameState, HUMAN, attackerPosition) : null;

  // ターンが変わったら選択状態をリセット
  useEffect(() => {
    setSelectedCardIndex(null);
    setAttackerPosition(null);
    setMovingFrom(null);
  }, [turn]);

  useEffect(() => {
    if (!message) return;
    const timerId = setTimeout(() => setMessage(null), MESSAGE_DURATION_MS);
    return () => clearTimeout(timerId);
  }, [message]);

  const showMessage = (text: string) => setMessage(prev => ({ id: (prev?.id ?? 0) + 1, text }));

  // ドローフェイズの自動進行と AI の行動
  useEffect(() => {
    if (winner) return;
    let action: ((state: GameState) => GameState) | null = null;
    let delay = AI_STEP_DELAY_MS;

    if (currentPlayer === AI) {
      if (phase === 'Draw') action = nextPhase;
      else if (phase === 'Play') action = state => nextPhase(runAiPlayPhase(state, AI));
      else if (phase === 'Attack') action = state => endTurn(runAiAttackPhase(state, AI));
    } else if (phase === 'Draw') {
      action = nextPhase;
      delay = AUTO_DRAW_DELAY_MS;
    }
    if (!action) return;

    const step = action;
    const timerId = setTimeout(() => setGameState(step), delay);
    return () => clearTimeout(timerId);
  }, [phase, currentPlayer, winner]);

  // ルール違反ならメッセージを表示し、成功なら state を更新する
  const apply = (result: ActionResult): boolean => {
    if (!result.ok) {
      showMessage(result.error);
      return false;
    }
    setGameState(result.state);
    return true;
  };

  const handleNextPhase = () => setGameState(nextPhase);
  const handleEndTurn = () => setGameState(endTurn);
  const handleRestart = () => {
    setGameState(createInitialGameState());
    setMessage(null);
  };

  // 手札のカードを選択
  const handleSelectCard = (cardIndex: number) => {
    if (!isPlayer1Turn || winner) return;
    setSelectedCardIndex(cardIndex);
  };

  const handlePlayPhaseClick = (position: FieldPosition) => {
    const clickedCard = getCardAt(gameState, HUMAN, position);
    const selectedCard = selectedCardIndex !== null ? players.player1.hand[selectedCardIndex] : null;

    // スペルカードを味方モンスターに使用
    if (selectedCardIndex !== null && selectedCard?.type === 'Spell' && clickedCard) {
      if (apply(castSpell(gameState, HUMAN, selectedCardIndex, position))) setSelectedCardIndex(null);
      return;
    }

    // 移動するモンスターを選択
    if (clickedCard) {
      if (gameState.turnState.summonedThisTurnIds.includes(clickedCard.id)) {
        showMessage('このモンスターは召喚されたターンには移動できません。');
        return;
      }
      setMovingFrom(position);
      return;
    }

    // 空きスロットへ移動（同じ列内のクリックはキャンセル扱い）
    if (movingFrom) {
      if (movingFrom.row === position.row) {
        setMovingFrom(null);
        return;
      }
      if (apply(moveMonster(gameState, HUMAN, movingFrom, position))) setMovingFrom(null);
      return;
    }

    // 召喚
    if (selectedCardIndex !== null) {
      if (apply(playCard(gameState, HUMAN, selectedCardIndex, position))) setSelectedCardIndex(null);
    }
  };

  const handleAttackPhaseClick = (player: PlayerId, position: FieldPosition) => {
    const clickedCard = getCardAt(gameState, player, position);
    if (player === HUMAN && clickedCard) {
      if (gameState.turnState.attackedMonsterIds.includes(clickedCard.id)) {
        showMessage('このモンスターは既に攻撃済みです。');
        return;
      }
      setAttackerPosition(position);
    } else if (player === AI && clickedCard && attackerPosition) {
      if (apply(attack(gameState, HUMAN, attackerPosition, { type: 'monster', position }))) {
        setAttackerPosition(null);
      }
    } else {
      setAttackerPosition(null);
    }
  };

  // フィールドのカードをクリック
  const handleFieldClick = (player: PlayerId, row: Row, index: number) => {
    if (!isPlayer1Turn || winner) return;
    const position = { row, index };
    if (phase === 'Attack') handleAttackPhaseClick(player, position);
    else if (phase === 'Play' && player === HUMAN) handlePlayPhaseClick(position);
  };

  // 相手プレイヤーのHPをクリック（ダイレクトアタック）
  const handlePlayerHpClick = () => {
    if (!isPlayer1Turn || phase !== 'Attack' || !attackerPosition || winner) return;
    if (apply(attack(gameState, HUMAN, attackerPosition, { type: 'player' }))) setAttackerPosition(null);
  };

  if (winner) {
    return (
      <div className="game-over-message">
        {winner === HUMAN ? 'Player 1' : 'Player 2'} の勝利！
        <button onClick={handleRestart} className="turn-button">もう一度遊ぶ</button>
      </div>
    );
  }

  return (
    <div className="game-board">
      <div className="info-panel">
        <div className="card-info">カード情報 {attackerCard ? `${attackerCard.name}を選択中` : ''}</div>
        <div className="message-area" role="status">
          {message && <div key={message.id} className="message">{message.text}</div>}
        </div>
      </div>
      <div className="main-area">
        <PlayerArea
          playerState={players[AI]}
          isOpponent
          onSlotClick={(row, index) => handleFieldClick(AI, row, index)}
          onSpecialCardClick={handlePlayerHpClick}
        />
        <PlayerArea
          playerState={players[HUMAN]}
          isOpponent={false}
          onSlotClick={(row, index) => handleFieldClick(HUMAN, row, index)}
          onHandCardClick={handleSelectCard}
          selectedCardIndex={selectedCardIndex}
        />
      </div>
      <ControlPanel
        turn={turn}
        phase={phase}
        isPlayerTurn={isPlayer1Turn}
        onNextPhase={handleNextPhase}
        onEndTurn={handleEndTurn}
      />
    </div>
  );
};

export default GameBoard;
