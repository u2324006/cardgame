import React, { useState } from 'react';
import '../styles/GameBoard.css';
import { initialGameState } from '../logic/initialState';
import { GameState } from '../types/gameState';
import Hand from './Hand';
import CardSlot from './CardSlot';
import { Card } from '../types/card';

const GameBoard: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);

  const { players, turn, phase } = gameState;
  const player = players.player1;
  const opponent = players.player2;

  const handleDrawCard = () => {
    setGameState(prevState => {
      const newPlayerState = { ...prevState.players.player1 };
      if (newPlayerState.deck.length > 0) {
        const drawnCard = newPlayerState.deck.pop();
        if (drawnCard) {
            newPlayerState.hand.push(drawnCard);
        }
      }
      return {
        ...prevState,
        players: {
          ...prevState.players,
          player1: newPlayerState,
        },
      };
    });
  };

  const handleSelectCard = (cardIndex: number) => {
    setSelectedCardIndex(cardIndex);
  };

  const handlePlayCard = (row: 'frontRow' | 'backRow', slotIndex: number) => {
    if (selectedCardIndex === null) return; // No card selected

    setGameState(prevState => {
        const newPlayerState = { ...prevState.players.player1 };
        const selectedCard = newPlayerState.hand[selectedCardIndex];

        if (newPlayerState.field[row][slotIndex] === null) { // If the slot is empty
            newPlayerState.field[row][slotIndex] = selectedCard;
            newPlayerState.hand.splice(selectedCardIndex, 1); // Remove from hand
            setSelectedCardIndex(null); // Deselect card
        }

        return {
            ...prevState,
            players: {
                ...prevState.players,
                player1: newPlayerState,
            },
        };
    });
  };

  return (
    <div className="game-board">
      {/* Left Info Panel */}
      <div className="info-panel">
        <div className="card-info">カード情報</div>
        <button onClick={handleDrawCard} className="draw-button">Draw Card</button>
      </div>

      {/* Main Game Area */}
      <div className="main-area">
        {/* Opponent's Area */}
        <div className="player-area opponent-area">
            <div className="field-and-deck">
                <div className="field">
                  <div className="row back-row">
                    {opponent.field.backRow.map((card, i) => <CardSlot key={i} card={card} onClick={() => {}} />)}
                  </div>
                  <div className="row front-row">
                    {opponent.field.frontRow.map((card, i) => <CardSlot key={i} card={card} onClick={() => {}} />)}
                  </div>
                </div>
                <div className="deck-graveyard">
                    <div className="deck">山札: {opponent.deck.length}</div>
                    <div className="graveyard">墓地: {opponent.graveyard.length}</div>
                </div>
                <div className="special-card-hp">HP: {opponent.specialCardHp}</div>
            </div>
        </div>

        <Hand cards={opponent.hand} onCardClick={() => {}} />
        <Hand cards={player.hand} onCardClick={handleSelectCard} selectedCardIndex={selectedCardIndex} />

        {/* Player's Area */}
        <div className="player-area self-area">
            <div className="field-and-deck">
                <div className="deck-graveyard">
                    <div className="deck">山札: {player.deck.length}</div>
                    <div className="graveyard">墓地: {player.graveyard.length}</div>
                </div>
                <div className="field">
                  <div className="row front-row">
                    {player.field.frontRow.map((card, i) => <CardSlot key={i} card={card} onClick={() => handlePlayCard('frontRow', i)} />)}
                  </div>
                  <div className="row back-row">
                    {player.field.backRow.map((card, i) => <CardSlot key={i} card={card} onClick={() => handlePlayCard('backRow', i)} />)}
                  </div>
                </div>
                <div className="special-card-hp">HP: {player.specialCardHp}</div>
            </div>
        </div>
      </div>

      {/* Right Control Panel */}
      <div className="control-panel">
        <div className="turn-info">ターン {turn}</div>
        <button className="phase-button">{phase} フェイズ</button>
        <button className="phase-button">次のフェイズへ</button>
        <button className="turn-button">次のターンへ</button>
      </div>
    </div>
  );
};

export default GameBoard;
