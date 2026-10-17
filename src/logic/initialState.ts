import { GameState, PlayerState, TurnState } from '../types/gameState';
import { Card, LeaderCard, MonsterCard } from '../types/card';
import { BASE_CARDS, DEFAULT_LEADER } from './cards';
import { RULES } from './rules';

// Fisher–Yates シャッフル（元の配列は変更しない）
export const shuffle = <T,>(items: T[], random: () => number = Math.random): T[] => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

// 元カードを順番に複製してデッキ枚数をそろえ、シャッフルする。
// 複製したカードには `${元のID}-${番号}` の個別IDを振る。
export const createDeck = (baseCards: Card[] = BASE_CARDS): Card[] =>
  shuffle(Array.from({ length: RULES.deckSize }, (_, i) => {
    const card = baseCards[i % baseCards.length];
    return { ...card, id: `${card.id}-${i}` };
  }));

const createInitialPlayerState = (fullDeck: Card[], leader: LeaderCard = DEFAULT_LEADER): PlayerState => {
  const emptyRow = () => Array<MonsterCard | null>(RULES.slotsPerRow).fill(null);
  return {
    leader,
    specialCardHp: leader.maxHp,
    currentEnergy: 0,
    maxEnergy: RULES.maxEnergy,
    // 山札の先頭から初期手札を引く
    deck: fullDeck.slice(RULES.initialHandSize),
    hand: fullDeck.slice(0, RULES.initialHandSize),
    graveyard: [],
    field: {
      frontRow: emptyRow(),
      backRow: emptyRow(),
    },
  };
};

export const createInitialTurnState = (): TurnState => ({
  attackedMonsterIds: [],
  summonedThisTurnIds: [],
  hasMoved: false,
  attackBuffs: {},
});

// 呼び出すたびに新しいデッキでゲームを作成する（リスタート用）
export const createInitialGameState = (): GameState => ({
  players: {
    player1: createInitialPlayerState(createDeck()),
    player2: createInitialPlayerState(createDeck()),
  },
  currentPlayer: 'player1',
  turn: 1,
  phase: 'Draw',
  turnState: createInitialTurnState(),
  winner: null,
});
