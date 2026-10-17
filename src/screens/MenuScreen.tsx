import React from 'react';
import { DeckList, countDeckCards } from '../logic/deck';
import { findLeader } from '../logic/cards';
import { getRound } from '../logic/gameLogic';
import { GameState } from '../types/gameState';
import type { DeckStatus } from '../components/App';

export type Destination = 'resume' | 'battle' | 'deck' | 'cards';

interface MenuScreenProps {
  deck: DeckList;
  deckStatus: DeckStatus;
  savedBattle: GameState | null; // 中断した対戦（あれば「続きから」を出す）
  onNavigate: (destination: Destination) => void;
}

const DECK_STATUS_LABELS: Record<DeckStatus, string> = {
  saved: '保存したデッキ',
  auto: '自動で作ったデッキ',
  invalid: '自動で作ったデッキ',
};

const MenuScreen: React.FC<MenuScreenProps> = ({ deck, deckStatus, savedBattle, onNavigate }) => {
  const leader = findLeader(deck.leaderId);
  const items: { destination: Destination; label: string; description: string }[] = [
    ...(savedBattle
      ? [
        { destination: 'resume' as const, label: '続きから', description: `中断した対戦（ラウンド${getRound(savedBattle.turn)}）を再開する` },
        { destination: 'battle' as const, label: '新しく対戦', description: '中断した対戦は破棄されます' },
      ]
      : [{ destination: 'battle' as const, label: '対戦', description: 'AI と対戦する' }]),
    { destination: 'deck', label: 'デッキ作成', description: '大将とカードを選んでデッキを組む' },
    { destination: 'cards', label: 'カード一覧', description: 'すべてのカードを見る' },
  ];

  return (
    <main className="menu-screen">
      <div className="menu-title-block">
        <div className="menu-ornament" aria-hidden="true"></div>
        <h1 className="menu-title">カードゲーム</h1>
        <div className="menu-ornament" aria-hidden="true"></div>
      </div>
      {deckStatus === 'invalid' && (
        <div className="menu-warning" role="alert">
          <p>保存したデッキが今のカードやルールに合わなくなったため、対戦では自動で作ったデッキを使います。</p>
          <button type="button" className="secondary-button" onClick={() => onNavigate('deck')}>デッキを組み直す</button>
        </div>
      )}
      <nav className="menu-buttons" aria-label="メニュー">
        {items.map((item, i) => (
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
        使用するデッキ：{DECK_STATUS_LABELS[deckStatus]}
        （{countDeckCards(deck)}枚・大将「{leader?.name ?? '未選択'}」）
      </p>
    </main>
  );
};

export default MenuScreen;
