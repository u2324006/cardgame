import React, { useEffect, useState } from 'react';
import '../styles/GameBoard.css';
import { createInitialGameState } from '../logic/initialState';
import {
  ActionResult,
  activateLeaderAbility,
  attack,
  canUseLeaderAbility,
  castSpell,
  discardCards,
  endTurn,
  canAttackThisTurn,
  getCardAt,
  getHpBonus,
  getMonsterPositions,
  isLeaderActive,
  hasFrontRowMonsters,
  moveMonster,
  nextPhase,
  playCard,
  skipFreeSpell,
} from '../logic/gameLogic';
import { getSpellTargetSide, isMonster, isUntargetedSpell } from '../types/card';
import { DeckList } from '../logic/deck';
import { FieldPosition, GameState, PlayerId, Row } from '../types/gameState';
import { useAutoProgress } from '../hooks/useAutoProgress';
import { useTimedMessage } from '../hooks/useTimedMessage';
import PlayerArea from './PlayerArea';
import ControlPanel from './ControlPanel';
import CardPreview, { InspectTarget } from './CardPreview';

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

interface GameBoardProps {
  deck?: DeckList; // プレイヤーが使うデッキ（なければ自動のデッキ）
  initialState?: GameState; // 中断した対戦を再開するときの状態
  onStateChange?: (state: GameState) => void; // 状態が変わるたびに呼ばれる（途中経過の保存用）
  onExit?: () => void; // メニューへ戻る
}

const GameBoard: React.FC<GameBoardProps> = ({ deck, initialState, onStateChange, onExit }) => {
  const [gameState, setGameState] = useState<GameState>(() => initialState ?? createInitialGameState(deck));
  const [selection, setSelection] = useState<Selection>(NO_SELECTION);
  const [hovered, setHovered] = useState<InspectTarget | null>(null); // マウスを乗せているカード
  const { message, showMessage, clearMessage } = useTimedMessage(MESSAGE_DURATION_MS);

  const { players, turn, phase, currentPlayer, winner, turnState } = gameState;
  const isPlayerTurn = currentPlayer === HUMAN && !winner;
  const selectedFieldPosition = selection.kind === 'move' || selection.kind === 'attacker' ? selection.from : null;
  // 自分のターンで行動済みのモンスター（攻撃済み・移動済み）は薄く表示する
  const usedLabels: Record<string, string> = {};
  if (isPlayerTurn && phase === 'Play' && turnState.movedMonsterId) usedLabels[turnState.movedMonsterId] = '移動済み';
  if (isPlayerTurn && phase === 'Play') {
    gameState.moveLocks.filter(lock => lock.player === HUMAN).forEach(lock => { usedLabels[lock.cardId] = '移動不可'; });
  }
  if (isPlayerTurn && phase === 'Attack') turnState.attackedMonsterIds.forEach(id => { usedLabels[id] = '攻撃済み'; });

  // 大将カードの効果が働いていないときのラベル
  const leaderStatusOf = (player: PlayerId): string | undefined => {
    if (!isLeaderActive(gameState, player)) return '効果停止中';
    return players[player].leaderAbilityUsed ? '効果使用済み' : undefined;
  };

  // 大将カードの効果で上がっている HP（両方のプレイヤーの場のモンスター）
  const hpBonusesOf = (owner: PlayerId): Record<string, number> => {
    const bonuses: Record<string, number> = {};
    getMonsterPositions(gameState, owner).forEach(position => {
      const card = getCardAt(gameState, owner, position);
      const bonus = card ? getHpBonus(gameState, owner, card) : 0;
      if (card && bonus > 0) bonuses[card.id] = bonus;
    });
    return bonuses;
  };

  const canDirectAttack = isPlayerTurn && phase === 'Attack' && selection.kind === 'attacker' && selection.from.row === 'frontRow' && !hasFrontRowMonsters(players[AI]);

  // カード情報欄：マウスを乗せているカード、なければ選択中のカード
  const selectedTarget = ((): InspectTarget | null => {
    if (selection.kind === 'hand') {
      const card = players[HUMAN].hand[selection.index];
      return card ? { kind: 'card', card } : null;
    }
    if (selection.kind === 'none') return null;
    const card = getCardAt(gameState, HUMAN, selection.from);
    return card ? { kind: 'card', card, row: selection.from.row } : null;
  })();
  const previewTarget = hovered ?? selectedTarget;

  useAutoProgress(gameState, setGameState, AI);

  useEffect(() => {
    onStateChange?.(gameState);
  }, [gameState, onStateChange]);

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
    setGameState(createInitialGameState(deck));
    setSelection(NO_SELECTION);
    setHovered(null);
    clearMessage();
  };

  // 手札のカードを選択（もう一度クリックで解除）
  // 「引いて捨てる」効果で、墓地に置くカードを選んでいるところ
  const pendingDiscard = gameState.pendingDiscard?.player === HUMAN ? gameState.pendingDiscard : null;
  const [discardIndices, setDiscardIndices] = useState<number[]>([]);
  useEffect(() => setDiscardIndices([]), [pendingDiscard]);

  const handleConfirmDiscard = () => {
    const result = discardCards(gameState, HUMAN, discardIndices);
    if (!result.ok) {
      showMessage(result.error);
      return;
    }
    setGameState(result.state);
  };

  // モンスターの効果で、コストなしで使うスペルを選んでいるところ
  const pendingFreeSpell = gameState.pendingFreeSpell?.player === HUMAN ? gameState.pendingFreeSpell : null;
  const leaderAbility = players[HUMAN].leader.ability;

  // 選んだ手札が、対象を選ばずに使うスペルなら「使う」ボタンを出す
  const selectedHandCard = selection.kind === 'hand' ? players[HUMAN].hand[selection.index] : undefined;
  const untargetedSpell = selectedHandCard && !isMonster(selectedHandCard) && isUntargetedSpell(selectedHandCard) ? selectedHandCard : null;

  const handleHandCardClick = (index: number) => {
    if (pendingDiscard) {
      setDiscardIndices(current => current.includes(index)
        ? current.filter(i => i !== index)
        : current.length < pendingDiscard.count ? [...current, index] : current);
      return;
    }
    if (!isPlayerTurn || phase !== 'Play') return;
    setSelection(selection.kind === 'hand' && selection.index === index ? NO_SELECTION : { kind: 'hand', index });
  };

  // 移動させるモンスターを選択
  const selectMoveSource = (position: FieldPosition) => {
    const card = getCardAt(gameState, HUMAN, position);
    if (!card) return;
    if (turnState.summonedThisTurnIds.includes(card.id)) {
      showMessage('このモンスターは召喚されたターンには移動できません。');
    } else if (turnState.movedMonsterId) {
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

  // 相手のモンスターを対象にするスペル（炎の呪文など）
  const handleEnemyTargetSpell = (position: FieldPosition) => {
    if (selection.kind !== 'hand') return;
    const selectedCard = players[HUMAN].hand[selection.index];
    if (!selectedCard || isMonster(selectedCard) || getSpellTargetSide(selectedCard) !== 'enemy') return;
    apply(castSpell(gameState, HUMAN, selection.index, position));
  };

  const handleFieldClick = (player: PlayerId, row: Row, index: number) => {
    if (!isPlayerTurn) return;
    if (pendingDiscard) {
      showMessage(`先に、墓地に置くカードを${pendingDiscard.count}枚選んでください。`);
      return;
    }
    const position = { row, index };
    if (phase === 'Attack') handleAttackPhaseClick(player, position);
    else if (phase === 'Play' && player === HUMAN) handlePlayPhaseClick(position);
    else if (phase === 'Play' && player === AI) handleEnemyTargetSpell(position);
  };

  // 相手の大将カードをクリック（ダイレクトアタック）
  const handleOpponentLeaderClick = () => {
    if (!isPlayerTurn || phase !== 'Attack' || selection.kind !== 'attacker') return;
    apply(attack(gameState, HUMAN, selection.from, { type: 'player' }));
  };

  if (winner) {
    return (
      <div className="game-over-message">
        {winner === HUMAN ? 'あなたの勝利！' : '相手の勝利…'}
        <div className="game-over-actions">
          <button onClick={handleRestart} className="primary-button">もう一度遊ぶ</button>
          {onExit && <button onClick={onExit} className="secondary-button">メニューへ戻る</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="game-board">
      <aside className="info-panel">
        <h2 className="panel-title">カード情報</h2>
        <div className="card-info">
          <CardPreview target={previewTarget} />
        </div>
        {untargetedSpell && selection.kind === 'hand' && !pendingDiscard && (
          <button type="button" className="primary-button cast-button" onClick={() => apply(castSpell(gameState, HUMAN, selection.index))}>
            「{untargetedSpell.name}」を使う
          </button>
        )}
        {pendingFreeSpell && !pendingDiscard && (
          <div className="discard-panel" role="alert">
            <p>「{pendingFreeSpell.source}」の効果：手札のコスト{pendingFreeSpell.maxCost}以下のスペルを1枚、<b>コストを払わずに</b>使えます。</p>
            <button type="button" className="secondary-button" onClick={() => apply(skipFreeSpell(gameState, HUMAN))}>
              使わない
            </button>
          </div>
        )}
        {leaderAbility?.kind === 'rallyEnergy' && canUseLeaderAbility(gameState, HUMAN) && (
          <button type="button" className="primary-button cast-button" onClick={() => apply(activateLeaderAbility(gameState, HUMAN))}>
            大将の効果を使う（エネルギー +{leaderAbility.amount}）
          </button>
        )}
        {pendingDiscard && (
          <div className="discard-panel" role="alert">
            <p>手札から墓地に置くカードを<b>{pendingDiscard.count}枚</b>選んでください（{discardIndices.length} / {pendingDiscard.count}）。</p>
            <button
              type="button"
              className="primary-button"
              onClick={handleConfirmDiscard}
              disabled={discardIndices.length !== pendingDiscard.count}
            >
              墓地に置く
            </button>
          </div>
        )}
        <div className="message-area" role="status">
          {message && <div key={message.id} className="message">{message.text}</div>}
        </div>
      </aside>
      <div className="main-area">
        <PlayerArea
          playerState={players[AI]}
          isOpponent
          onSlotClick={(row, index) => handleFieldClick(AI, row, index)}
          onLeaderClick={handleOpponentLeaderClick}
          isLeaderTargetable={canDirectAttack}
          onInspect={setHovered}
          hpBonuses={hpBonusesOf(AI)}
          leaderStatus={leaderStatusOf(AI)}
        />
        <div className="front-line" aria-hidden="true"><span>前線</span></div>
        <PlayerArea
          playerState={players[HUMAN]}
          isOpponent={false}
          onSlotClick={(row, index) => handleFieldClick(HUMAN, row, index)}
          onHandCardClick={handleHandCardClick}
          onInspect={setHovered}
          selectedCardIndex={selection.kind === 'hand' ? selection.index : null}
          selectedPosition={selectedFieldPosition}
          usedLabels={usedLabels}
          markedHandIndices={discardIndices}
          hpBonuses={hpBonusesOf(HUMAN)}
          leaderStatus={leaderStatusOf(HUMAN)}
        />
      </div>
      <ControlPanel
        turn={turn}
        phase={phase}
        isPlayerTurn={isPlayerTurn}
        canAttack={canAttackThisTurn(gameState)}
        isBusy={!!pendingDiscard || !!pendingFreeSpell}
        onNextPhase={() => setGameState(nextPhase)}
        onEndTurn={() => setGameState(endTurn)}
        onExit={onExit}
      />
    </div>
  );
};

export default GameBoard;
