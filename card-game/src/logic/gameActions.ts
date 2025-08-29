import { GameState } from '../types/gameState';
import { Card } from '../types/card';
import { allCardsData } from '../data/cards'; // Add this import

export const healMonster = (
  gameState: GameState,
  monkCardId: string,
  targetMonsterId: string
): { newState: GameState, message: string | null } => {
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
    return { newState: gameState, message: '僧侶カードが見つからないか、効果が既に使用されています。' }; // Return original state if conditions not met
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
    return { newState: gameState, message: 'ターゲットは有効なモンスターではありません。' }; // Return original state if conditions not met
  }

  // Find the target monster's original definition to get its max HP
  const originalTargetCardDefinition = allCardsData.find(card => card.id === targetMonsterId.split('-')[0]); // Split ID to get original ID (e.g., 'm014-instance-25' -> 'm014')

  if (!originalTargetCardDefinition || originalTargetCardDefinition.type !== 'Monster' || typeof originalTargetCardDefinition.cardHp === 'undefined') {
    console.warn('Original target card definition not found or invalid for healing.');
    return { newState: gameState, message: 'ターゲットの元のカード定義が見つかりません。' };
  }

  const maxHp = originalTargetCardDefinition.cardHp;

  // Apply healing effect
  const newField = { ...currentPlayerState.field };
  const newTargetRow = [...newField[targetRow!]];
  
  // Check if monster is already at max HP
  if (targetMonster.cardHp === maxHp) {
    return { newState: gameState, message: 'このモンスターは回復できません' }; // Return original state, preventing healing
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

  return { newState: newGameState, message: 'モンスターのHPが1回復しました。' };
};