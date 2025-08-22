import React, { useState, useEffect, useCallback } from 'react';
import '../styles/GameBoard.css';
import { initialGameState } from '../logic/initialState';
import { GameState } from '../types/gameState';
import Hand from './Hand';
import CardSlot from './CardSlot';
import EnergyZone from './EnergyZone';

const GameBoard: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);

  const { players, turn, phase, currentPlayer } = gameState;
  const isPlayer1Turn = currentPlayer === 'player1';

  const handleNextPhase = useCallback(() => {
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
        case 'Play':
          newPhase = 'Attack';
          break;
        case 'Attack':
          return {
            ...prevState,
            turn: prevState.turn + 1,
            currentPlayer: prevState.currentPlayer === 'player1' ? 'player2' : 'player1',
            phase: 'Draw',
          };
      }
      return { ...prevState, phase: newPhase };
    });
  }, []);

  const handleEndTurn = useCallback(() => {
    setGameState(prevState => ({
      ...prevState,
      turn: prevState.turn + 1,
      currentPlayer: prevState.currentPlayer === 'player1' ? 'player2' : 'player1',
      phase: 'Draw',
    }));
  }, []);

  useEffect(() => {
    let isCancelled = false;

    // 相手(player2)のターン処理
    if (currentPlayer === 'player2') {
      const opponentTurnFlow = async () => {
        if (isCancelled) return;

        // Drawフェイズの処理
        if (phase === 'Draw') {
          console.log("相手ターン: Draw Phase");
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (isCancelled) return;
          handleNextPhase(); // -> Play Phase に移行
          return;
        }

        // Playフェイズの処理
        if (phase === 'Play') {
          console.log("相手ターン: Play Phase");
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (isCancelled) return;

          // AIのカード召喚ロジック
          setGameState(prevState => {
            if (prevState.currentPlayer !== 'player2') return prevState;

            const newState = { ...prevState };
            const opponentState = { ...newState.players.player2 };

            // ループ内で変更を追跡するための変数
            let currentEnergy = opponentState.currentEnergy;
            let hand = [...opponentState.hand];
            let field = { 
              frontRow: [...opponentState.field.frontRow],
              backRow: [...opponentState.field.backRow],
            };
            let hasPlayed = false;

            while (true) {
              const playableCards = hand.filter(card => card.type === 'Monster' && card.cost <= currentEnergy);
              const slotIndex = field.frontRow.findIndex(slot => slot === null);

              if (playableCards.length === 0 || slotIndex === -1) {
                break; // プレイできるカードがないか、スロットがなければループ終了
              }

              const cardToPlay = playableCards[0];
              console.log(`AIが ${cardToPlay.name} を召喚！`);
              
              // ローカル変数を更新して、次のループの判断材料にする
              currentEnergy -= cardToPlay.cost;
              hand = hand.filter(card => card.id !== cardToPlay.id);
              field.frontRow[slotIndex] = cardToPlay;
              hasPlayed = true;

              // 1体召喚したら少し待つ（見せるため）
              // await new Promise(resolve => setTimeout(resolve, 500));
            }

            // ループが終わったら、最終的な状態でstateを更新
            if (hasPlayed) {
              opponentState.currentEnergy = currentEnergy;
              opponentState.hand = hand;
              opponentState.field = field;
              newState.players.player2 = opponentState;
              return newState;
            }
            
            return prevState; // 何もプレイしなかった場合
          });

          // 召喚処理が終わったらAttackフェイズに進む
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (isCancelled) return;
          handleNextPhase(); // -> Attack Phase に移行
          return;
        }

        // Attackフェイズの処理
        if (phase === 'Attack') {
          console.log("相手ターン: Attack Phase");
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (isCancelled) return;
          handleEndTurn(); // -> player1のDraw Phaseに移行
        }
      };

      opponentTurnFlow();

      return () => {
        isCancelled = true;
      };
    }

    // 自分(player1)のターン処理
    if (currentPlayer === 'player1' && phase === 'Draw') {
      const timerId = setTimeout(() => handleNextPhase(), 500);
      return () => clearTimeout(timerId);
    }
  }, [phase, currentPlayer, handleNextPhase, handleEndTurn]);

  const handleSelectCard = (cardIndex: number) => {
    if (!isPlayer1Turn) return;
    setSelectedCardIndex(cardIndex);
  };

  const handlePlayCard = (row: 'frontRow' | 'backRow', slotIndex: number) => {
    if (selectedCardIndex === null || !isPlayer1Turn) return;

    const currentPlayerId = gameState.currentPlayer;
    const currentPlayerState = gameState.players[currentPlayerId];
    const selectedCard = currentPlayerState.hand[selectedCardIndex];

    if (gameState.phase !== 'Play') return;
    if (currentPlayerState.currentEnergy < selectedCard.cost) {
      alert('エネルギーが足りません！');
      return;
    }
    if (currentPlayerState.field[row][slotIndex] !== null) return;

    setGameState(prevState => {
      const newPlayerState = { ...prevState.players[currentPlayerId] };
      newPlayerState.currentEnergy -= selectedCard.cost;
      newPlayerState.hand = newPlayerState.hand.filter((_, i) => i !== selectedCardIndex);
      const newField = { ...newPlayerState.field };
      newField[row] = newField[row].map((card, i) => (i === slotIndex ? selectedCard : card));
      newPlayerState.field = newField;

      return { ...prevState, players: { ...prevState.players, [currentPlayerId]: newPlayerState } };
    });

    setSelectedCardIndex(null);
  };

  return (
    <div className="game-board">
      <div className="info-panel"><div className="card-info">カード情報</div></div>
      <div className="main-area">
        <div className="player-area opponent-area">
          <Hand cards={players.player2.hand} onCardClick={() => {}} />
          <div className="field-and-deck">
            <div className="field">
              <div className="row back-row">{players.player2.field.backRow.map((card, i) => <CardSlot key={i} card={card} onClick={() => {}} />)}</div>
              <div className="row front-row">{players.player2.field.frontRow.map((card, i) => <CardSlot key={i} card={card} onClick={() => {}} />)}</div>
            </div>
            <div className="deck-graveyard">
              <div className="deck">山札: {players.player2.deck.length}</div>
              <div className="graveyard">墓地: {players.player2.graveyard.length}</div>
            </div>
            <div className="special-card-hp">HP: {players.player2.specialCardHp}</div>
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
              <div className="row front-row">{players.player1.field.frontRow.map((card, i) => <CardSlot key={i} card={card} onClick={() => handlePlayCard('frontRow', i)} />)}</div>
              <div className="row back-row">{players.player1.field.backRow.map((card, i) => <CardSlot key={i} card={card} onClick={() => handlePlayCard('backRow', i)} />)}</div>
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

