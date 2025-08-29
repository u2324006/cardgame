import React, { useState, useEffect, useCallback } from 'react';
import '../styles/GameBoard.css';
import { initialGameState } from '../logic/initialState';
import { healMonster } from '../logic/gameActions';
import { GameState } from '../types/gameState';
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
  | { type: 'monster', card: Card; position: { player: 'player1' | 'player2', row: 'frontRow' | 'backRow', index: number } }
  | { type: 'player', player: 'player1' | 'player2' };

const GameBoard: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const [attackerInfo, setAttackerInfo] = useState<AttackerInfo | null>(null);
  const [gameOver, setGameOver] = useState<string | null>(null);
  const [attackedMonsterIds, setAttackedMonsterIds] = useState<string[]>([]);
  const [movingCardInfo, setMovingCardInfo] = useState<AttackerInfo | null>(null);
  const [movedMonstersThisTurnIds, setMovedMonstersThisTurnIds] = useState<Set<string>>(new Set());
  const [summonedThisTurnIds, setSummonedThisTurnIds] = useState<string[]>([]);
  const [attackBuffs, setAttackBuffs] = useState<Record<string, number>>({}); // { [cardId]: buffValue }

  const [isMoveTargetingMode, setIsMoveTargetingMode] = useState<boolean>(false); 
  const [monkCardForEffect, setMonkCardForEffect] = useState<Card | null>(null);
  const [targetingMonkHeal, setTargetingMonkHeal] = useState<boolean>(false); 
  const [cardAwaitingAction, setCardAwaitingAction] = useState<{ card: Card, position: { row: 'frontRow' | 'backRow', index: number } } | null>(null);
  const [spellBeingCast, setSpellBeingCast] = useState<Card | null>(null);
  const [cardsToDiscard, setCardsToDiscard] = useState<Card[]>([]);

  const isCardAwaitingAction = useCallback((card: Card | null, row: 'frontRow' | 'backRow', index: number) => {
    return cardAwaitingAction?.card?.id === card?.id &&
           cardAwaitingAction?.position.row === row &&
           cardAwaitingAction?.position.index === index;
  }, [cardAwaitingAction]);

  const handleMoveCard = useCallback((cardToMove: Card, fromPosition: { row: 'frontRow' | 'backRow', index: number }, toPosition?: { row: 'frontRow' | 'backRow', index: number }) => {
    if (toPosition) {
      if (movedMonstersThisTurnIds.has(cardToMove.id)) {
        alert("このモンスターは既に移動済みです。");
        return;
      }
      if (fromPosition.row === toPosition.row && fromPosition.index === toPosition.index) {
        setMovingCardInfo(null);
        return;
      }

      setGameState(prevState => {
        const newPlayerState = { ...prevState.players.player1 };
        const newField = { ...newPlayerState.field };
        newField[fromPosition.row][fromPosition.index] = null;
        newField[toPosition.row][toPosition.index] = cardToMove;
        newPlayerState.field = newField;
        return { ...prevState, players: { ...prevState.players, player1: newPlayerState } };
      });

      setMovedMonstersThisTurnIds(prev => new Set(prev).add(cardToMove.id));
      setMovingCardInfo(null);
    } else {
      if (summonedThisTurnIds.includes(cardToMove.id)) {
        alert("このモンスターは召喚されたターンには移動できません。");
        return;
      }
      setMovingCardInfo({ card: cardToMove, position: fromPosition });
    }
  }, [summonedThisTurnIds, movedMonstersThisTurnIds]);

  const handleActivateMonkEffect = useCallback((card: Card) => {
    if (!cardAwaitingAction) return;

    setMonkCardForEffect(card);
    setTargetingMonkHeal(true);
    setGameState(prevState => {
      const newPlayers = { ...prevState.players };
      const playerState = newPlayers[prevState.currentPlayer];
      const newField = { ...playerState.field };
      newField[cardAwaitingAction.position.row][cardAwaitingAction.position.index] = { ...card };
      newPlayers[prevState.currentPlayer] = { ...playerState, field: newField };
      return { ...prevState, players: newPlayers };
    });
    setCardAwaitingAction(null);
  }, [cardAwaitingAction]);

  const handleStartMoveTargeting = useCallback((card: Card, fromPosition: { row: 'frontRow' | 'backRow', index: number }) => {
      if (summonedThisTurnIds.includes(card.id)) {
        alert("このモンスターは召喚されたターンには移動できません。");
        return;
      }
      setIsMoveTargetingMode(true);
      setMovingCardInfo({ card: card, position: fromPosition });
      setCardAwaitingAction(null);
  }, [summonedThisTurnIds]);

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

  const handleEndTurn = useCallback(() => {
    if (gameOver) return;
    setGameState(prevState => ({
      ...prevState, turn: prevState.turn + 1, currentPlayer: prevState.currentPlayer === 'player1' ? 'player2' : 'player1', phase: 'Draw',
    }));
  }, [gameOver]);

  const handleCancelAction = useCallback(() => {
    setCardAwaitingAction(null);
    setIsMoveTargetingMode(false);
    setMovingCardInfo(null);
  }, []);

  const { players, turn, phase, currentPlayer } = gameState;
  const isPlayer1Turn = currentPlayer === 'player1';

  useEffect(() => {
    setAttackedMonsterIds([]);
    setAttackerInfo(null);
    setMovingCardInfo(null);
    setSummonedThisTurnIds([]);
    setAttackBuffs({});
    setMovedMonstersThisTurnIds(new Set());

    setGameState(prevState => {
      const newPlayers = { ...prevState.players };
      for (const playerId of ['player1', 'player2'] as const) {
        const playerState = newPlayers[playerId];
        const newField = { ...playerState.field };
        for (const row of ['frontRow', 'backRow'] as const) {
          newField[row] = newField[row].map(card =>
            card ? { ...card, hasUsedEffectThisTurn: false } : null
          );
        }
        newPlayers[playerId] = { ...playerState, field: newField };
      }
      return { ...prevState, players: newPlayers };
    });
  }, [turn]);

  useEffect(() => {
    if (players.player1.specialCardHp <= 0) {
      setGameOver('Player 2');
    } else if (players.player2.specialCardHp <= 0) {
      setGameOver('Player 1');
    }
  }, [players]);

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
            // eslint-disable-next-line no-constant-condition
            // eslint-disable-next-line no-constant-condition
            // eslint-disable-next-line no-loop-func
            while (true) {
              // eslint-disable-next-line no-loop-func
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
          const aiAttackedMonsterIdsThisTurn: string[] = [];
          setGameState(prevState => {
            if (prevState.currentPlayer !== 'player2') return prevState;
            const newState = { ...prevState };
            const player2State = { ...newState.players.player2 };
            const player1State = { ...newState.players.player1 };
            const player2Monsters: { card: Card; position: { row: 'frontRow' | 'backRow'; index: number; }; }[] = [];
            player2State.field.frontRow.forEach((card, index) => {
              if (card && card.type === 'Monster') player2Monsters.push({ card, position: { row: 'frontRow', index } });
            });
            player2State.field.backRow.forEach((card, index) => {
              if (card && card.type === 'Monster') player2Monsters.push({ card, position: { row: 'backRow', index } });
            });
            const player1FrontRowMonsters = player1State.field.frontRow.filter(card => card !== null);
            player2Monsters.forEach(attacker => {
              if (aiAttackedMonsterIdsThisTurn.includes(attacker.card.id)) {
                return;
              }
              let target: AttackTarget | null = null;
              if (player1FrontRowMonsters.length > 0) {
                const targetCard = player1FrontRowMonsters[0];
                const targetIndex = player1State.field.frontRow.findIndex(card => card === targetCard);
                if (targetCard && targetIndex !== -1) {
                  target = { type: 'monster', card: targetCard, position: { player: 'player1', row: 'frontRow', index: targetIndex } };
                }
              } else {
                target = { type: 'player', player: 'player1' };
              }
              if (target) {
                const baseAttack = (attacker.position.row === 'frontRow' ? attacker.card.frontAttack : attacker.card.backAttack) || 0;
                const buff = attackBuffs[attacker.card.id] || 0;
                const attackPower = baseAttack + buff;
                if (target.type === 'monster') {
                  const newHp = target.card.cardHp! - attackPower;
                  const newField = { ...player1State.field };
                  if (newHp <= 0) {
                    newField[target.position.row][target.position.index] = null;
                    player1State.graveyard = [...player1State.graveyard, target.card];
                  } else {
                    const newTargetCard = { ...target.card, cardHp: newHp };
                    newField[target.position.row][target.position.index] = newTargetCard;
                  }
                  player1State.field = newField;
                } else if (target.type === 'player') {
                  player1State.specialCardHp -= attackPower;
                }
                aiAttackedMonsterIdsThisTurn.push(attacker.card.id);
              }
            });
            newState.players.player1 = player1State;
            newState.players.player2 = player2State;
            return newState;
          });
          setAttackedMonsterIds(prevIds => [...prevIds, ...aiAttackedMonsterIdsThisTurn]);
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
  }, [phase, currentPlayer, handleNextPhase, handleEndTurn, gameOver, attackBuffs]);

  const handleSelectCard = (cardIndex: number) => {
    if (!isPlayer1Turn || gameOver) return;

    if (spellBeingCast && spellBeingCast.id.startsWith('s003')) {
      const cardToDiscard = players.player1.hand[cardIndex];
      if (cardToDiscard.id === spellBeingCast.id) {
        alert("「取捨選択」自体を捨てることはできません。");
        return;
      }
      if (cardsToDiscard.find(card => card.id === cardToDiscard.id)) {
        // Deselect card
        setCardsToDiscard(cardsToDiscard.filter(card => card.id !== cardToDiscard.id));
      } else {
        // Select card
        const newCardsToDiscard = [...cardsToDiscard, cardToDiscard];
        setCardsToDiscard(newCardsToDiscard);

        if (newCardsToDiscard.length === 2) {
          if (window.confirm("選択したカードでよろしいですか？")) {
            // Execute the spell effect
            setGameState(prevState => {
              const newPlayerState = { ...prevState.players.player1 };
              // Move discarded cards to graveyard
              newPlayerState.graveyard = [...newPlayerState.graveyard, ...newCardsToDiscard];
              // Remove discarded cards from hand
              newPlayerState.hand = newPlayerState.hand.filter(card => !newCardsToDiscard.some(dCard => dCard.id === card.id));
              // Draw 2 cards
              for (let i = 0; i < 2; i++) {
                if (newPlayerState.deck.length > 0) {
                  const drawnCard = newPlayerState.deck[0];
                  newPlayerState.deck = newPlayerState.deck.slice(1);
                  newPlayerState.hand = [...newPlayerState.hand, drawnCard];
                } else {
                  alert("山札がありません！");
                }
              }
              // Move spell card to graveyard and remove from hand
              newPlayerState.graveyard = [...newPlayerState.graveyard, spellBeingCast];
              newPlayerState.hand = newPlayerState.hand.filter(card => card.id !== spellBeingCast.id);
              // Pay energy cost
              newPlayerState.currentEnergy -= spellBeingCast.cost;

              return {
                ...prevState,
                players: { ...prevState.players, player1: newPlayerState },
              };
            });

            // Reset state
            setSpellBeingCast(null);
            setCardsToDiscard([]);
            setSelectedCardIndex(null);
          } else {
            // User clicked "No", so reset the selection
            setCardsToDiscard([]);
          }
        }
      }
      return;
    }

    const cardToSelect = players.player1.hand[cardIndex];
    if (selectedCardIndex === cardIndex) {
      if (cardToSelect && (cardToSelect.id.startsWith('s002') || cardToSelect.id.startsWith('s003')) && phase === 'Play') {
        executeSpell(cardToSelect, null);
        setSelectedCardIndex(null);
        return;
      }
      setSelectedCardIndex(null);
    } else {
      setSelectedCardIndex(cardIndex);
    }
  };

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
    setSummonedThisTurnIds(prevIds => [...prevIds, selectedCard.id]);
    setSelectedCardIndex(null);
  };

  const executeAttack = (attacker: AttackerInfo, target: AttackTarget) => {
    if (gameOver) return;
    if (attacker.card.type !== 'Monster' || typeof attacker.card.frontAttack === 'undefined' || typeof attacker.card.backAttack === 'undefined') return;
    const baseAttack = attacker.position.row === 'frontRow' ? attacker.card.frontAttack : attacker.card.backAttack;
    const buff = attackBuffs[attacker.card.id] || 0;
    const attackPower = baseAttack + buff;
    if (target.type === 'monster' && typeof target.card.cardHp === 'undefined') {
      return;
    }
    setGameState(prevState => {
      const newPlayers = { ...prevState.players };
      const targetPlayerState = { ...newPlayers.player2 };
      if (target.type === 'monster') {
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
    setAttackedMonsterIds(prevIds => [...prevIds, attacker.card.id]);
    setAttackerInfo(null);
  };

  const executeSpell = (spellCard: Card, targetCard: Card | null) => {
    if (gameOver || !isPlayer1Turn) return;
    if (players.player1.currentEnergy < spellCard.cost) {
      alert("エネルギーが足りません！");
      return;
    }
    switch (true) {
      case spellCard.id.startsWith('s001'):
        if (targetCard) {
          console.log(`${targetCard.name} のFAを1上げます。`);
          setAttackBuffs(prevBuffs => ({
            ...prevBuffs,
            [targetCard.id]: (prevBuffs[targetCard.id] || 0) + 1,
          }));
        } else {
          alert("ターゲットが必要です！");
          return;
        }
        break;
      case spellCard.id.startsWith('s002'):
        setGameState(prevState => {
          const newPlayers = { ...prevState.players };
          const currentPlayerState = { ...newPlayers[prevState.currentPlayer] };
          if (currentPlayerState.deck.length > 0) {
            const drawnCard = currentPlayerState.deck[0];
            currentPlayerState.deck = currentPlayerState.deck.slice(1);
            currentPlayerState.hand = [...currentPlayerState.hand, drawnCard];
          } else {
            alert("山札がありません！");
          }
          if (currentPlayerState.deck.length > 0) {
            const drawnCard = currentPlayerState.deck[0];
            currentPlayerState.deck = currentPlayerState.deck.slice(1);
            currentPlayerState.hand = [...currentPlayerState.hand, drawnCard];
          } else {
            alert("山札がありません！");
          }
          currentPlayerState.currentEnergy -= spellCard.cost;
          currentPlayerState.hand = currentPlayerState.hand.filter(card => card.id !== spellCard.id);
          currentPlayerState.graveyard = [...currentPlayerState.graveyard, spellCard];
          newPlayers[prevState.currentPlayer] = currentPlayerState;
          return { ...prevState, players: newPlayers };
        });
        break;
      case spellCard.id.startsWith('s003'):
        if (players.player1.hand.length < 3) { // 2 to discard + the spell itself
          alert("手札が足りません。");
          return;
        }
        setSpellBeingCast(spellCard);
        break;
      default:
        console.warn(`Unknown spell card ID: ${spellCard.id}`);
        break;
    }
    setSelectedCardIndex(null);
  };

  const handleFieldClick = (player: 'player1' | 'player2', row: 'frontRow' | 'backRow', index: number) => {
    if (!isPlayer1Turn || gameOver) return;
    const clickedCard = players[player].field[row][index];
    if (targetingMonkHeal && monkCardForEffect) {
      if (player === 'player1' && clickedCard && clickedCard.type === 'Monster' && clickedCard.cardHp !== undefined) {
        const result = healMonster(gameState, monkCardForEffect.id, clickedCard.id);
        setGameState(result.newState);
        if (result.message) {
            alert(result.message);
        }
        setTargetingMonkHeal(false);
        setMonkCardForEffect(null);
        return;
      } else {
        alert("僧侶の効果は味方のモンスターにのみ使用できます。");
        setTargetingMonkHeal(false);
        setMonkCardForEffect(null);
        return;
      }
    }
    if (isMoveTargetingMode && movingCardInfo) {
      if (player === 'player1' && clickedCard === null) {
        handleMoveCard(movingCardInfo.card, movingCardInfo.position, { row, index });
        setIsMoveTargetingMode(false);
        setMovingCardInfo(null);
        return;
      } else {
        alert("モンスターは空のスロットにのみ移動できます。");
        setIsMoveTargetingMode(false);
        setMovingCardInfo(null);
        return;
      }
    }
    if (phase === 'Attack') {
      if (player === 'player1' && clickedCard) {
        if (attackedMonsterIds.includes(clickedCard.id)) {
          alert("このモンスターは既に攻撃済みです。");
          return;
        }
        setAttackerInfo({ card: clickedCard, position: { row, index } });
      } else if (player === 'player2' && clickedCard && attackerInfo) {
        const opponentFrontRow = players.player2.field.frontRow;
        const frontRowHasMonsters = opponentFrontRow.some(card => card !== null);
        if (row === 'backRow' && frontRowHasMonsters) {
          alert("前衛にモンスターがいるため、後衛を攻撃できません。");
          return;
        }
        executeAttack(attackerInfo, { type: 'monster', card: clickedCard, position: { player, row, index } });
      } else {
        setAttackerInfo(null);
      }
    } 
    else if (phase === 'Play') {
      if (player === 'player1') {
        const selectedCard = selectedCardIndex !== null ? players.player1.hand[selectedCardIndex] : null;
        if (selectedCardIndex !== null) {
          if (selectedCard && selectedCard.type === 'Spell' && clickedCard) {
            executeSpell(selectedCard, clickedCard);
            return;
          }
          else if (selectedCard && selectedCard.type === 'Monster' && !clickedCard) {
            handlePlayCard(row, index);
            return;
          }
        }
        else if (clickedCard && clickedCard.type === 'Monster') {
          setCardAwaitingAction({ card: clickedCard, position: { row, index } });
          return;
        }
      }
    }
  };

  const handlePlayerHpClick = () => {
    if (!isPlayer1Turn || phase !== 'Attack' || !attackerInfo || gameOver) return;
    const opponentFrontRow = players.player2.field.frontRow;
    const frontRowHasMonsters = opponentFrontRow.some(c => c !== null);
    if (frontRowHasMonsters) {
      alert("前衛にモンスターがいるため、直接攻撃できません。");
      return;
    }
    executeAttack(attackerInfo, { type: 'player', player: 'player2' });
  };

  const handleGoBack = () => {
    if (window.confirm('対戦を中止しますか？')) {
      window.location.href = '../../deck_selection.html?mode=battle';
    }
  };

  if (gameOver) {
    const handlePlayAgain = () => {
      setGameState(initialGameState);
      setGameOver(null);
    };

    const handleGoToDeckSelection = () => {
      window.location.href = '../../deck_selection.html?mode=battle';
    };

    const handleGoToMainMenu = () => {
      window.location.href = '../../index.html';
    };

    return (
      <div className="game-over-message">
        <h1>{gameOver} の勝利！</h1>
        <button onClick={handlePlayAgain}>もう一度対戦する</button>
        <button onClick={handleGoToDeckSelection}>デッキを選ぶ</button>
        <button onClick={handleGoToMainMenu}>メインメニューに戻る</button>
      </div>
    );
  }

  return (
    <div className="game-board">
      <div className="info-panel"><div className="card-info">カード情報 {attackerInfo ? `${attackerInfo.card.name}を選択中` : ''}</div></div>
      <div className="main-area">
        <div className="player-area opponent-area">
          <Hand cards={players.player2.hand} onCardClick={() => {}} />
          <div className="field-and-deck">
            <div className="field">
              <div className="row back-row">{players.player2.field.backRow.map((card, i) => <CardSlot key={i} card={card} onClick={() => handleFieldClick('player2', 'backRow', i)} isAwaitingAction={false} isSummonedThisTurn={false} row={'backRow'} index={i} onCancelAction={handleCancelAction} />)}</div>
              <div className="row front-row">{players.player2.field.frontRow.map((card, i) => <CardSlot key={i} card={card} onClick={() => handleFieldClick('player2', 'frontRow', i)} isAwaitingAction={false} isSummonedThisTurn={false} row={'frontRow'} index={i} onCancelAction={handleCancelAction} />)}</div>
            </div>
            <div className="deck-graveyard">
              <div className="deck">山札: {players.player2.deck.length}</div>
              <div className="graveyard">墓地: {players.player2.graveyard.length}</div>
            </div>
            <div className="special-card-hp" onClick={handlePlayerHpClick}>HP: {players.player2.specialCardHp}</div>
            <EnergyZone currentEnergy={players.player2.currentEnergy} maxEnergy={players.player2.maxEnergy} className="rotated" />
          </div>
        </div>
        <div className="player-area self-area">
          <div className="field-and-deck">
            <div className="deck-graveyard">
              <div className="deck">山札: {players.player1.deck.length}</div>
              <div className="graveyard">墓地: {players.player1.graveyard.length}</div>
            </div>
            <div className="field">
              <div className="row front-row">{players.player1.field.frontRow.map((card, i) => <CardSlot key={i} card={card} onClick={() => handleFieldClick('player1', 'frontRow', i)} isAwaitingAction={isCardAwaitingAction(card, 'frontRow', i)} onActivateEffect={handleActivateMonkEffect} onStartMoveTargeting={handleStartMoveTargeting} isSummonedThisTurn={card ? summonedThisTurnIds.includes(card.id) : false} row={'frontRow'} index={i} onCancelAction={handleCancelAction} />)}</div>
              <div className="row back-row">{players.player1.field.backRow.map((card, i) => <CardSlot key={i} card={card} onClick={() => handleFieldClick('player1', 'backRow', i)} isAwaitingAction={isCardAwaitingAction(card, 'backRow', i)} onActivateEffect={handleActivateMonkEffect} onStartMoveTargeting={handleStartMoveTargeting} isSummonedThisTurn={card ? summonedThisTurnIds.includes(card.id) : false} row={'backRow'} index={i} onCancelAction={handleCancelAction} />)}</div>
            </div>
            <div className="special-card-hp">HP: {players.player1.specialCardHp}</div>
            <EnergyZone currentEnergy={players.player1.currentEnergy} maxEnergy={players.player1.maxEnergy} />
          </div>
          <Hand cards={players.player1.hand} onCardClick={handleSelectCard} selectedCardIndex={selectedCardIndex} cardsToDiscard={cardsToDiscard} />
        </div>
      </div>
      <div className="control-panel">
        <button onClick={handleGoBack} className="back-button">戻る</button>
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
