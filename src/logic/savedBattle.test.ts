import { createInitialGameState } from './initialState';
import { clearSavedBattle, loadSavedBattle, saveBattle } from './savedBattle';

describe('saved battle', () => {
  beforeEach(() => window.localStorage.clear());

  it('restores a battle in progress', () => {
    const state = { ...createInitialGameState(), turn: 5 };
    saveBattle(state);
    expect(loadSavedBattle()).toEqual(state);
    clearSavedBattle();
    expect(loadSavedBattle()).toBeNull();
  });

  it('forgets a finished battle', () => {
    saveBattle(createInitialGameState());
    saveBattle({ ...createInitialGameState(), winner: 'player1' });
    expect(loadSavedBattle()).toBeNull();
  });

  it('ignores broken or outdated data', () => {
    window.localStorage.setItem('cardgame.battle', '{not json');
    expect(loadSavedBattle()).toBeNull();
    window.localStorage.setItem('cardgame.battle', JSON.stringify({ version: 0, state: createInitialGameState() }));
    expect(loadSavedBattle()).toBeNull();
  });
});
