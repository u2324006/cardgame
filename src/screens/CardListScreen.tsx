import React, { useState } from 'react';
import { BASE_CARDS, LEADER_CARDS } from '../logic/cards';
import Card from '../components/Card';
import LeaderCard from '../components/LeaderCard';
import ScreenHeader from './ScreenHeader';

type Filter = 'all' | 'Monster' | 'Spell' | 'leader';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'Monster', label: 'モンスター' },
  { value: 'Spell', label: 'スペル' },
  { value: 'leader', label: '大将' },
];

const CardListScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [filter, setFilter] = useState<Filter>('all');
  const showLeaders = filter === 'all' || filter === 'leader';
  const cards = filter === 'leader' ? [] : BASE_CARDS.filter(card => filter === 'all' || card.type === filter);
  const total = cards.length + (showLeaders ? LEADER_CARDS.length : 0);

  return (
    <div className="screen">
      <ScreenHeader title="カード一覧" onBack={onBack}>
        <span className="screen-count">{total}種類</span>
      </ScreenHeader>
      <div className="filter-tabs" role="group" aria-label="カードの種類">
        {FILTERS.map(f => (
          <button
            key={f.value}
            type="button"
            className={`filter-tab ${filter === f.value ? 'active' : ''}`}
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="card-gallery">
        {showLeaders && LEADER_CARDS.map(leader => (
          <LeaderCard key={leader.id} leader={leader} hp={leader.maxHp} size="large" />
        ))}
        {cards.map(card => <Card key={card.id} card={card} size="large" />)}
      </div>
    </div>
  );
};

export default CardListScreen;
