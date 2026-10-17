import { GameState, PlayerState, TurnState } from '../types/gameState';
import { Card, LeaderCard, MonsterCard } from '../types/card';
import { DEFAULT_LEADER, findLeader } from './cards';
import { DeckList, createDefaultDeckList, expandDeck } from './deck';
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

// デッキの構成からカードを作ってシャッフルする
export const createDeck = (deck: DeckList = createDefaultDeckList()): Card[] => shuffle(expandDeck(deck));

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
  movedMonsterId: null,
  attackBuffs: {},
});

const createPlayerFromDeck = (deck: DeckList): PlayerState =>
  createInitialPlayerState(createDeck(deck), findLeader(deck.leaderId) ?? DEFAULT_LEADER);

// 呼び出すたびに新しくシャッフルしたデッキでゲームを作成する（リスタート用）
// player1 は渡されたデッキ（なければ自動のデッキ）、player2（AI）は自動のデッキを使う
export const createInitialGameState = (playerDeck: DeckList = createDefaultDeckList()): GameState => ({
  players: {
    player1: createPlayerFromDeck(playerDeck),
    player2: createPlayerFromDeck(createDefaultDeckList()),
  },
  currentPlayer: 'player1',
  turn: 1,
  phase: 'Draw',
  turnState: createInitialTurnState(),
  winner: null,
});
