import React, { useEffect, useState } from 'react';
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
import { isMonster } from '../types/card';
import { FieldPosition, GameState, PlayerId, Row } from '../types/gameState';
import { useAutoProgress } from '../hooks/useAutoProgress';
import { useTimedMessage } from '../hooks/useTimedMessage';
import PlayerArea from './PlayerArea';
import ControlPanel from './ControlPanel';

const HUMAN: PlayerId = 'player1';
const AI: PlayerId = 'player2';
const MESSAGE_DURATION_MS = 3000;

// プレイヤーが今選んでいるもの（同時に選べるのは1つだけ）
type Selection =
  | { kind: 'none' }
  | { kind: 'hand'; index: number } // 召喚・スペルに使う手札
  | { kind: 'move'; from: FieldPosition } // 移動させるモンスター
  | { kind: 'attacker'; from: FieldPosition }; // 攻撃させるモンスター

const NO_SELECTION: Selection = { kind: 'none' };

const samePosition = (a: FieldPosition, b: FieldPosition) => a.row === b.row && a.index === b.index;

const GameBoard: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(createInitialGameState);
  const [selection, setSelection] = useState<Selection>(NO_SELECTION);
  const { message, showMessage, clearMessage } = useTimedMessage(MESSAGE_DURATION_MS);

  const { players, turn, phase, currentPlayer, winner, turnState } = gameState;
  const isPlayerTurn = currentPlayer === HUMAN && !winner;
  const selectedFieldPosition = selection.kind === 'move' || selection.kind === 'attacker' ? selection.from : null;
  const attackerCard = selection.kind === 'attacker' ? getCardAt(gameState, HUMAN, selection.from) : null;

  useAutoProgress(gameState, setGameState, AI);

  // フェイズやターンが変わったら選択を解除
  useEffect(() => setSelection(NO_SELECTION), [phase, turn]);

  // ルール違反ならメッセージを表示し、成功なら state を更新して選択を解除する
  const apply = (result: ActionResult) => {
    if (!result.ok) {
      showMessage(result.error);
      return;
    }
    setGameState(result.state);
    setSelection(NO_SELECTION);
  };

  const handleRestart = () => {
    setGameState(createInitialGameState());
    setSelection(NO_SELECTION);
    clearMessage();
  };

  // 手札のカードを選択（もう一度クリックで解除）
  const handleHandCardClick = (index: number) => {
    if (!isPlayerTurn || phase !== 'Play') return;
    setSelection(selection.kind === 'hand' && selection.index === index ? NO_SELECTION : { kind: 'hand', index });
  };

  // 移動させるモンスターを選択
  const selectMoveSource = (position: FieldPosition) => {
    const card = getCardAt(gameState, HUMAN, position);
    if (!card) return;
    if (turnState.summonedThisTurnIds.includes(card.id)) {
      showMessage('このモンスターは召喚されたターンには移動できません。');
    } else if (turnState.hasMoved) {
      showMessage('モンスターの移動は1ターンに1回までです。');
    } else {
      setSelection({ kind: 'move', from: position });
    }
  };

  const handlePlayPhaseClick = (position: FieldPosition) => {
    const clickedCard = getCardAt(gameState, HUMAN, position);

    if (selection.kind === 'hand') {
      const selectedCard = players[HUMAN].hand[selection.index];
      if (!clickedCard) apply(playCard(gameState, HUMAN, selection.index, position));
      else if (selectedCard && !isMonster(selectedCard)) apply(castSpell(gameState, HUMAN, selection.index, position));
      else selectMoveSource(position);
      return;
    }

    if (selection.kind === 'move') {
      if (clickedCard) {
        if (samePosition(selection.from, position)) setSelection(NO_SELECTION);
        else selectMoveSource(position);
      } else if (selection.from.row === position.row) {
        setSelection(NO_SELECTION); // 同じ列の空きスロットをクリックしたら取り消し
      } else {
        apply(moveMonster(gameState, HUMAN, selection.from, position));
      }
      return;
    }

    selectMoveSource(position);
  };

  const handleAttackPhaseClick = (player: PlayerId, position: FieldPosition) => {
    const clickedCard = getCardAt(gameState, player, position);
    if (player === HUMAN && clickedCard) {
      if (selection.kind === 'attacker' && samePosition(selection.from, position)) {
        setSelection(NO_SELECTION);
      } else if (turnState.attackedMonsterIds.includes(clickedCard.id)) {
        showMessage('このモンスターは既に攻撃済みです。');
      } else {
        setSelection({ kind: 'attacker', from: position });
      }
    } else if (player === AI && clickedCard && selection.kind === 'attacker') {
      apply(attack(gameState, HUMAN, selection.from, { type: 'monster', position }));
    } else {
      setSelection(NO_SELECTION);
    }
  };

  const handleFieldClick = (player: PlayerId, row: Row, index: number) => {
    if (!isPlayerTurn) return;
    const position = { row, index };
    if (phase === 'Attack') handleAttackPhaseClick(player, position);
    else if (phase === 'Play' && player === HUMAN) handlePlayPhaseClick(position);
  };

  // 相手の大将カードをクリック（ダイレクトアタック）
  const handleOpponentSpecialCardClick = () => {
    if (!isPlayerTurn || phase !== 'Attack' || selection.kind !== 'attacker') return;
    apply(attack(gameState, HUMAN, selection.from, { type: 'player' }));
  };

  if (winner) {
    return (
      <div className="game-over-message">
        {winner === HUMAN ? 'あなたの勝利！' : '相手の勝利…'}
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
          onSpecialCardClick={handleOpponentSpecialCardClick}
        />
        <PlayerArea
          playerState={players[HUMAN]}
          isOpponent={false}
          onSlotClick={(row, index) => handleFieldClick(HUMAN, row, index)}
          onHandCardClick={handleHandCardClick}
          selectedCardIndex={selection.kind === 'hand' ? selection.index : null}
          selectedPosition={selectedFieldPosition}
        />
      </div>
      <ControlPanel
        turn={turn}
        phase={phase}
        isPlayerTurn={isPlayerTurn}
        onNextPhase={() => setGameState(nextPhase)}
        onEndTurn={() => setGameState(endTurn)}
      />
    </div>
  );
};

export default GameBoard;
