import React, { useState, useEffect, useCallback } from 'react';
import '../styles/GameBoard.css';
import { initialGameState } from '../logic/initialState';
import { GameState, PlayerState } from '../types/gameState';
import { Card } from '../types/card';
import Hand from './Hand';
import CardSlot from './CardSlot';
import EnergyZone from './EnergyZone';

// 型定義
interface AttackerInfo {
  card: Card;
  position: { row: 'frontRow' | 'backRow'; index: number; };
}
type AttackTarget = 
  | { type: 'monster', card: Card; position: { player: 'player2', row: 'frontRow' | 'backRow', index: number } }
  | { type: 'player', player: 'player2' };

const GameBoard: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const [attackerInfo, setAttackerInfo] = useState<AttackerInfo | null>(null);
  const [gameOver, setGameOver] = useState<string | null>(null);
  const [attackedMonsterIds, setAttackedMonsterIds] = useState<string[]>([]);

  const { players, turn, phase, currentPlayer } = gameState;
  const isPlayer1Turn = currentPlayer === 'player1';

  // フェイズを進める処理
  const handleNextPhase = useCallback(() => {
    if (gameOver) return;
    setGameState(prevState => {
      if (prevState.phase === 'Draw') {
        const currentPlayerId = prevState.currentPlayer;
        const newPlayers = { ...prevState.players };
        const currentPlayerState = { ...newPlayers[currentPlayerId] };
        if (currentPlayerState.deck.length > 0) {
          const drawnCard = currentPlayerState.deck[0];
          currentPlayerState.deck = currentPlayerState.deck.slice(1);
          currentPlayerState.hand = [...currentPlayerState.hand, drawnCard];
        }
        if (currentPlayerState.currentEnergy < currentPlayerState.maxEnergy) {
          currentPlayerState.currentEnergy += 1;
        }
        newPlayers[currentPlayerId] = currentPlayerState;
        return { ...prevState, phase: 'Play', players: newPlayers };
      }
      let newPhase: GameState['phase'] = prevState.phase;
      switch (prevState.phase) {
        case 'Play': newPhase = 'Attack'; break;
        case 'Attack': return { ...prevState, turn: prevState.turn + 1, currentPlayer: prevState.currentPlayer === 'player1' ? 'player2' : 'player1', phase: 'Draw' };
      }
      return { ...prevState, phase: newPhase };
    });
  }, [gameOver]);

  // ターンを終了する処理
  const handleEndTurn = useCallback(() => {
    if (gameOver) return;
    setGameState(prevState => ({
      ...prevState, turn: prevState.turn + 1, currentPlayer: prevState.currentPlayer === 'player1' ? 'player2' : 'player1', phase: 'Draw',
    }));
  }, [gameOver]);

  // ターン開始時に攻撃済みリストをリセット
  useEffect(() => {
    setAttackedMonsterIds([]);
    setAttackerInfo(null);
  }, [turn]);

  // 勝利判定
  useEffect(() => {
    if (players.player1.specialCardHp <= 0) {
      setGameOver('Player 2');
    } else if (players.player2.specialCardHp <= 0) {
      setGameOver('Player 1');
    }
  }, [players]);

  // AI とゲーム進行を管理
  useEffect(() => {
    if (gameOver) return;
    let isCancelled = false;

    if (currentPlayer === 'player2') {
      const opponentTurnFlow = async () => {
        if (isCancelled) return;

        if (phase === 'Draw') {
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (isCancelled) return;
          handleNextPhase();
          return;
        }

        if (phase === 'Play') {
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (isCancelled) return;

          setGameState(prevState => {
            if (prevState.currentPlayer !== 'player2') return prevState;

            const newState = { ...prevState };
            const opponentState = { ...newState.players.player2 };

            let currentEnergy = opponentState.currentEnergy;
            let hand = [...opponentState.hand];
            let field = { 
              frontRow: [...opponentState.field.frontRow],
              backRow: [...opponentState.field.backRow],
            };
            let hasPlayed = false;

            while (true) {
              const playableCards = hand.filter(card => card.type === 'Monster' && card.cost <= currentEnergy);
              if (playableCards.length === 0) {
                break;
              }

              const cardToPlay = playableCards[0];
              let targetRow: 'frontRow' | 'backRow' = 'frontRow';

              if (typeof cardToPlay.backAttack !== 'undefined' && typeof cardToPlay.frontAttack !== 'undefined') {
                if (cardToPlay.backAttack > cardToPlay.frontAttack) {
                  targetRow = 'backRow';
                }
              }

              const slotIndex = field[targetRow].findIndex(slot => slot === null);

              if (slotIndex === -1) {
                hand = hand.filter(card => card.id !== cardToPlay.id);
                continue;
              }
              
              currentEnergy -= cardToPlay.cost;
              hand = hand.filter(card => card.id !== cardToPlay.id);
              field[targetRow][slotIndex] = cardToPlay;
              hasPlayed = true;
            }

            if (hasPlayed) {
              opponentState.currentEnergy = currentEnergy;
              opponentState.field = field;
              opponentState.hand = hand;
              newState.players.player2 = opponentState;
              return newState;
            }
            
            return prevState;
          });

          await new Promise(resolve => setTimeout(resolve, 1000));
          if (isCancelled) return;
          handleNextPhase();
          return;
        }

        if (phase === 'Attack') {
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (isCancelled) return;
          handleEndTurn();
        }
      };
      opponentTurnFlow();
      return () => { isCancelled = true; };
    }

    if (currentPlayer === 'player1' && phase === 'Draw') {
      const timerId = setTimeout(() => handleNextPhase(), 500);
      return () => clearTimeout(timerId);
    }
  }, [phase, currentPlayer, handleNextPhase, handleEndTurn, gameOver]);

  // 手札のカードを選択
  const handleSelectCard = (cardIndex: number) => {
    if (!isPlayer1Turn || gameOver) return;
    setSelectedCardIndex(cardIndex);
  };

  // カードをフィールドにプレイ
  const handlePlayCard = (row: 'frontRow' | 'backRow', slotIndex: number) => {
    if (selectedCardIndex === null || !isPlayer1Turn || gameOver) return;
    const selectedCard = players.player1.hand[selectedCardIndex];
    if (players.player1.currentEnergy < selectedCard.cost) { alert('エネルギーが足りません！'); return; }
    if (players.player1.field[row][slotIndex] !== null) return;
    setGameState(prevState => {
      const newPlayerState = { ...prevState.players.player1 };
      newPlayerState.currentEnergy -= selectedCard.cost;
      newPlayerState.hand = newPlayerState.hand.filter((_, i) => i !== selectedCardIndex);
      const newField = { ...newPlayerState.field };
      newField[row][slotIndex] = selectedCard;
      newPlayerState.field = newField;
      return { ...prevState, players: { ...prevState.players, player1: newPlayerState } };
    });
    setSelectedCardIndex(null);
  };

  // 攻撃を実行
  const executeAttack = (attacker: AttackerInfo, target: AttackTarget) => {
    if (gameOver) return;
    if (attacker.card.type !== 'Monster' || typeof attacker.card.frontAttack === 'undefined' || typeof attacker.card.backAttack === 'undefined') return;

    const attackPower = attacker.position.row === 'frontRow' ? attacker.card.frontAttack : attacker.card.backAttack;

    // ターゲットがHPを持つモンスターか事前にチェック
    if (target.type === 'monster' && typeof target.card.cardHp === 'undefined') {
      return;
    }

    setGameState(prevState => {
      const newPlayers = { ...prevState.players };
      const targetPlayerState = { ...newPlayers.player2 };

      if (target.type === 'monster') {
        // このスコープでは target.card.cardHp は number であることが保証される
        const newHp = target.card.cardHp! - attackPower;
        const newField = { ...targetPlayerState.field };

        if (newHp <= 0) {
          newField[target.position.row][target.position.index] = null;
          targetPlayerState.graveyard = [...targetPlayerState.graveyard, target.card];
        } else {
          const newTargetCard = { ...target.card, cardHp: newHp };
          newField[target.position.row][target.position.index] = newTargetCard;
        }
        targetPlayerState.field = newField;

      } else if (target.type === 'player') {
        targetPlayerState.specialCardHp -= attackPower;
      }
      
      newPlayers.player2 = targetPlayerState;
      return { ...prevState, players: newPlayers };
    });

    // 攻撃済みリストにIDを追加
    setAttackedMonsterIds(prevIds => [...prevIds, attacker.card.id]);
    setAttackerInfo(null);
  };

  // フィールドのカードをクリック
  const handleFieldClick = (player: 'player1' | 'player2', row: 'frontRow' | 'backRow', index: number) => {
    if (!isPlayer1Turn || gameOver) return;
    const clickedCard = players[player].field[row][index];
    
    if (phase === 'Attack') {
      // 攻撃者を選択 (自分のモンスターをクリック)
      if (player === 'player1' && clickedCard) {
        if (attackedMonsterIds.includes(clickedCard.id)) {
          alert("このモンスターは既に攻撃済みです。");
          return;
        }
        setAttackerInfo({ card: clickedCard, position: { row, index } });
      } 
      // 攻撃対象を選択 (相手のモンスターをクリック)
      else if (player === 'player2' && clickedCard && attackerInfo) {
        const opponentFrontRow = players.player2.field.frontRow;
        const frontRowHasMonsters = opponentFrontRow.some(card => card !== null);

        // 後衛を攻撃しようとした時に、前衛にモンスターがいる場合は攻撃不可
        if (row === 'backRow' && frontRowHasMonsters) {
          alert("前衛にモンスターがいるため、後衛を攻撃できません。");
          return;
        }
        
        executeAttack(attackerInfo, { type: 'monster', card: clickedCard, position: { player, row, index } });
      } 
      // それ以外の場所をクリックしたら選択解除
      else {
        setAttackerInfo(null);
      }
    } 
    // プレイフェイズの処理
    else if (phase === 'Play') {
      if (player === 'player1') handlePlayCard(row, index);
    }
  };

  // 相手プレイヤーのHPをクリック（ダイレクトアタック）
  const handlePlayerHpClick = () => {
    if (!isPlayer1Turn || phase !== 'Attack' || !attackerInfo || gameOver) return;

    const opponentFrontRow = players.player2.field.frontRow;
    const frontRowHasMonsters = opponentFrontRow.some(c => c !== null);

    // 前衛にモンスターがいる場合は直接攻撃できない
    if (frontRowHasMonsters) {
      alert("前衛にモンスターがいるため、直接攻撃できません。");
      return;
    }

    executeAttack(attackerInfo, { type: 'player', player: 'player2' });
  };

  if (gameOver) {
    return <div className="game-over-message">{gameOver} の勝利！</div>;
  }

  return (
    <div className="game-board">
      <div className="info-panel"><div className="card-info">カード情報 {attackerInfo ? `${attackerInfo.card.name}を選択中` : ''}</div></div>
      <div className="main-area">
        <div className="player-area opponent-area">
          <Hand cards={players.player2.hand} onCardClick={() => {}} />
          <div className="field-and-deck">
            <div className="field">
              <div className="row back-row">{players.player2.field.backRow.map((card, i) => <CardSlot key={i} card={card} onClick={() => handleFieldClick('player2', 'backRow', i)} />)}</div>
              <div className="row front-row">{players.player2.field.frontRow.map((card, i) => <CardSlot key={i} card={card} onClick={() => handleFieldClick('player2', 'frontRow', i)} />)}</div>
            </div>
            <div className="deck-graveyard">
              <div className="deck">山札: {players.player2.deck.length}</div>
              <div className="graveyard">墓地: {players.player2.graveyard.length}</div>
            </div>
            <div className="special-card-hp" onClick={handlePlayerHpClick}>HP: {players.player2.specialCardHp}</div>
            <EnergyZone currentEnergy={players.player2.currentEnergy} maxEnergy={players.player2.maxEnergy} />
          </div>
        </div>
        <div className="player-area self-area">
          <div className="field-and-deck">
            <div className="deck-graveyard">
              <div className="deck">山札: {players.player1.deck.length}</div>
              <div className="graveyard">墓地: {players.player1.graveyard.length}</div>
            </div>
            <div className="field">
              <div className="row front-row">{players.player1.field.frontRow.map((card, i) => <CardSlot key={i} card={card} onClick={() => handleFieldClick('player1', 'frontRow', i)} />)}</div>
              <div className="row back-row">{players.player1.field.backRow.map((card, i) => <CardSlot key={i} card={card} onClick={() => handleFieldClick('player1', 'backRow', i)} />)}</div>
            </div>
            <div className="special-card-hp">HP: {players.player1.specialCardHp}</div>
            <EnergyZone currentEnergy={players.player1.currentEnergy} maxEnergy={players.player1.maxEnergy} />
          </div>
          <Hand cards={players.player1.hand} onCardClick={handleSelectCard} selectedCardIndex={selectedCardIndex} />
        </div>
      </div>
      <div className="control-panel">
        <div className="turn-info">ターン {turn}</div>
        <div className="phase-button">{phase} フェイズ</div>
        <div className="current-player-info">{isPlayer1Turn ? 'あなたのターン' : "相手のターン"}</div>
        {isPlayer1Turn && (
          <>
            {phase !== 'Draw' && <button onClick={handleNextPhase} className="phase-button">次のフェイズへ</button>}
            <button onClick={handleEndTurn} className="turn-button">ターン終了</button>
          </>
        )}
      </div>
    </div>
  );
};

export default GameBoard;


