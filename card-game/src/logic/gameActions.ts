import { GameState } from '../types/gameState';
import { Card } from '../types/card';
import { allCardsData } from '../data/cards'; // Add this import

export const healMonster = (
  gameState: GameState,
  monkCardId: string,
  targetMonsterId: string
): GameState => {
  const newGameState = { ...gameState };
  const currentPlayerId = newGameState.currentPlayer;
  const currentPlayerState = newGameState.players[currentPlayerId];

  // Find the Monk card on the field
  let monkCard: Card | null = null;
  let monkRow: 'frontRow' | 'backRow' | null = null;
  let monkIndex: number = -1;

  for (const row of ['frontRow', 'backRow'] as const) {
    const index = currentPlayerState.field[row].findIndex(
      (card) => card?.id === monkCardId
    );
    if (index !== -1) {
      monkCard = currentPlayerState.field[row][index];
      monkRow = row;
      monkIndex = index;
      break;
    }
  }

  // Validate Monk card and its effect usage
  if (
    !monkCard ||
    monkCard.type !== 'Monster' ||
    monkCard.name !== '僧侶' || // Assuming '僧侶' is the exact name
    monkCard.hasUsedEffectThisTurn
  ) {
    console.warn('Monk card not found, not a Monk, or effect already used.');
    return gameState; // Return original state if conditions not met
  }

  // Find the target monster on the field
  let targetMonster: Card | null = null;
  let targetRow: 'frontRow' | 'backRow' | null = null;
  let targetIndex: number = -1;

  for (const row of ['frontRow', 'backRow'] as const) {
    const index = currentPlayerState.field[row].findIndex(
      (card) => card?.id === targetMonsterId
    );
    if (index !== -1) {
      targetMonster = currentPlayerState.field[row][index];
      targetRow = row;
      targetIndex = index;
      break;
    }
  }

  // Validate target monster
  if (!targetMonster || targetMonster.type !== 'Monster' || typeof targetMonster.cardHp === 'undefined') {
    console.warn('Target is not a valid monster or has no HP.');
    return gameState; // Return original state if conditions not met
  }

  // Find the target monster's original definition to get its max HP
  const originalTargetCardDefinition = allCardsData.find(card => card.id === targetMonsterId.split('-')[0]); // Split ID to get original ID (e.g., 'm014-instance-25' -> 'm014')

  if (!originalTargetCardDefinition || originalTargetCardDefinition.type !== 'Monster' || typeof originalTargetCardDefinition.cardHp === 'undefined') {
    console.warn('Original target card definition not found or invalid for healing.');
    return gameState;
  }

  const maxHp = originalTargetCardDefinition.cardHp;

  // Apply healing effect
  const newField = { ...currentPlayerState.field };
  const newTargetRow = [...newField[targetRow!]];
  
  // Check if monster is already at max HP
  if (targetMonster.cardHp === maxHp) {
    console.warn('このモンスターは回復できません'); // Message for the user
    return gameState; // Return original state, preventing healing
  }

  // Calculate new HP, capping at maxHp
  const healedHp = targetMonster.cardHp + 1;
  const finalHp = Math.min(healedHp, maxHp);

  const updatedTargetMonster = { ...targetMonster, cardHp: finalHp };
  newTargetRow[targetIndex!] = updatedTargetMonster;
  newField[targetRow!] = newTargetRow;

  // Mark Monk as used
  const newMonkRow = [...newField[monkRow!]];
  const updatedMonkCard = { ...monkCard, hasUsedEffectThisTurn: true };
  newMonkRow[monkIndex!] = updatedMonkCard;
  newField[monkRow!] = newMonkRow;

  newGameState.players[currentPlayerId] = {
    ...currentPlayerState,
    field: newField,
  };

  return newGameState;
};