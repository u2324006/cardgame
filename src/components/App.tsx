import React, { useCallback, useState } from 'react';
import GameBoard from './GameBoard';
import MenuScreen, { Destination } from '../screens/MenuScreen';
import CardListScreen from '../screens/CardListScreen';
import DeckBuilderScreen from '../screens/DeckBuilderScreen';
import CardEditorScreen from '../screens/CardEditorScreen';
import {
  DeckList,
  createDefaultDeckList,
  isValidDeck,
  loadSavedDeck,
  sanitizeDeck,
  saveDeck,
} from '../logic/deck';
import { clearSavedBattle, loadSavedBattle, saveBattle } from '../logic/savedBattle';
import { GameState } from '../types/gameState';
import '../styles/Screens.css';

type Screen = 'menu' | 'cards' | 'deck' | 'editor' | 'battle';

// 'saved'：保存したデッキを使う / 'auto'：保存したデッキがない / 'invalid'：保存したデッキがルールに合わなくなった
export type DeckStatus = 'saved' | 'auto' | 'invalid';

interface DeckState {
  deck: DeckList; // 対戦で使うデッキ
  status: DeckStatus;
  draft: DeckList; // デッキ作成画面で最初に開くデッキ
}

const loadInitialDeck = (): DeckState => {
  const saved = loadSavedDeck();
  if (!saved) {
    const deck = createDefaultDeckList();
    return { deck, status: 'auto', draft: deck };
  }
  if (isValidDeck(saved)) return { deck: saved, status: 'saved', draft: saved };
  // ルールに合わなくなった保存デッキは対戦に使わず、直せる部分を直してデッキ作成画面で開く
  return { deck: createDefaultDeckList(), status: 'invalid', draft: sanitizeDeck(saved) };
};

function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [{ deck, status, draft }, setDeckState] = useState(loadInitialDeck);
  const [savedBattle, setSavedBattle] = useState<GameState | null>(loadSavedBattle);
  const [battleKey, setBattleKey] = useState(0); // 対戦画面を作り直すためのキー
  const [resumeFrom, setResumeFrom] = useState<GameState | undefined>(undefined);

  const handleSaveDeck = (newDeck: DeckList): boolean => {
    const ok = saveDeck(newDeck);
    setDeckState({ deck: newDeck, status: ok ? 'saved' : 'auto', draft: newDeck });
    return ok;
  };

  const handleBattleStateChange = useCallback((state: GameState) => {
    saveBattle(state);
    setSavedBattle(state.winner ? null : state);
  }, []);

  const handleNavigate = (destination: Destination) => {
    if (destination === 'resume' || destination === 'battle') {
      if (destination === 'battle') clearSavedBattle();
      setResumeFrom(destination === 'resume' ? savedBattle ?? undefined : undefined);
      setBattleKey(key => key + 1);
      setScreen('battle');
    } else {
      setScreen(destination);
    }
  };

  const toMenu = () => setScreen('menu');

  // カードを変更・削除すると保存したデッキが使えなくなることがあるので、デッキの状態を読み直す
  const leaveEditor = () => {
    setDeckState(loadInitialDeck());
    toMenu();
  };

  return (
    <div className="App">
      {screen === 'menu' && (
        <MenuScreen deck={deck} deckStatus={status} savedBattle={savedBattle} onNavigate={handleNavigate} />
      )}
      {screen === 'cards' && <CardListScreen onBack={toMenu} />}
      {screen === 'editor' && <CardEditorScreen onBack={leaveEditor} />}
      {screen === 'deck' && (
        <DeckBuilderScreen initialDeck={draft} isSaved={status === 'saved'} onSave={handleSaveDeck} onBack={toMenu} />
      )}
      {screen === 'battle' && (
        <div className="battle-viewport">
          <GameBoard
            key={battleKey}
            deck={deck}
            initialState={resumeFrom}
            onStateChange={handleBattleStateChange}
            onExit={toMenu}
          />
        </div>
      )}
    </div>
  );
}

export default App;
