import React from 'react';
import { DeckList, countDeckCards } from '../logic/deck';
import { findLeader } from '../logic/cards';

type Destination = 'battle' | 'deck' | 'cards';

interface MenuScreenProps {
  deck: DeckList;
  isSavedDeck: boolean;
  onNavigate: (destination: Destination) => void;
}

const MENU_ITEMS: { destination: Destination; label: string; description: string }[] = [
  { destination: 'battle', label: '対戦', description: 'AI と対戦する' },
  { destination: 'deck', label: 'デッキ作成', description: '大将とカードを選んでデッキを組む' },
  { destination: 'cards', label: 'カード一覧', description: 'すべてのカードを見る' },
];

const MenuScreen: React.FC<MenuScreenProps> = ({ deck, isSavedDeck, onNavigate }) => {
  const leader = findLeader(deck.leaderId);
  return (
    <main className="menu-screen">
      <div className="menu-title-block">
        <div className="menu-ornament" aria-hidden="true"></div>
        <h1 className="menu-title">カードゲーム</h1>
        <div className="menu-ornament" aria-hidden="true"></div>
      </div>
      <nav className="menu-buttons" aria-label="メニュー">
        {MENU_ITEMS.map((item, i) => (
          <button
            key={item.destination}
            type="button"
            className={`menu-button ${i === 0 ? 'primary' : ''}`}
            onClick={() => onNavigate(item.destination)}
          >
            <span className="menu-button-label">{item.label}</span>
            <span className="menu-button-description">{item.description}</span>
          </button>
        ))}
      </nav>
      <p className="menu-deck-status">
        使用するデッキ：{isSavedDeck ? '保存したデッキ' : '自動で作ったデッキ'}
        （{countDeckCards(deck)}枚・大将「{leader?.name ?? '未選択'}」）
      </p>
    </main>
  );
};

export default MenuScreen;
