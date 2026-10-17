import React, { useState } from 'react';
import GameBoard from './GameBoard';
import MenuScreen from '../screens/MenuScreen';
import CardListScreen from '../screens/CardListScreen';
import DeckBuilderScreen from '../screens/DeckBuilderScreen';
import { DeckList, createDefaultDeckList, isValidDeck, loadSavedDeck, saveDeck } from '../logic/deck';
import '../styles/Screens.css';

type Screen = 'menu' | 'cards' | 'deck' | 'battle';

// 保存済みのデッキがルールを満たしていればそれを、なければ自動のデッキを使う
const loadInitialDeck = (): { deck: DeckList; isSaved: boolean } => {
  const saved = loadSavedDeck();
  return saved && isValidDeck(saved) ? { deck: saved, isSaved: true } : { deck: createDefaultDeckList(), isSaved: false };
};

function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [{ deck, isSaved }, setDeckState] = useState(loadInitialDeck);

  const handleSaveDeck = (newDeck: DeckList): boolean => {
    const ok = saveDeck(newDeck);
    setDeckState({ deck: newDeck, isSaved: ok });
    return ok;
  };

  const toMenu = () => setScreen('menu');

  return (
    <div className="App">
      {screen === 'menu' && <MenuScreen deck={deck} isSavedDeck={isSaved} onNavigate={setScreen} />}
      {screen === 'cards' && <CardListScreen onBack={toMenu} />}
      {screen === 'deck' && <DeckBuilderScreen initialDeck={deck} isSaved={isSaved} onSave={handleSaveDeck} onBack={toMenu} />}
      {screen === 'battle' && <GameBoard deck={deck} onExit={toMenu} />}
    </div>
  );
}

export default App;
