import React, { useState } from 'react';
import { Card as CardType } from '../types/card';
import { BASE_CARDS, LEADER_CARDS, findLeader } from '../logic/cards';
import {
  DeckList,
  addCard,
  countDeckCards,
  fillDeck,
  getCardCount,
  removeCard,
  validateDeck,
} from '../logic/deck';
import { RULES } from '../logic/rules';
import Card from '../components/Card';
import LeaderCard from '../components/LeaderCard';
import CardPreview, { InspectTarget } from '../components/CardPreview';
import ScreenHeader from './ScreenHeader';

type Step = 'leader' | 'cards';
type Filter = 'all' | 'Monster' | 'Spell';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'Monster', label: 'モンスター' },
  { value: 'Spell', label: 'スペル' },
];

interface DeckBuilderScreenProps {
  initialDeck: DeckList;
  isSaved: boolean; // initialDeck が保存済みのデッキか（自動で作ったデッキなら false）
  onSave: (deck: DeckList) => boolean;
  onBack: () => void;
}

const COSTS = Array.from(new Set(BASE_CARDS.map(card => card.cost))).sort((a, b) => a - b);

const sameDeck = (a: DeckList, b: DeckList) =>
  a.leaderId === b.leaderId && BASE_CARDS.every(card => getCardCount(a, card.id) === getCardCount(b, card.id));

const DeckBuilderScreen: React.FC<DeckBuilderScreenProps> = ({ initialDeck, isSaved, onSave, onBack }) => {
  // 最後に保存した（または開いた時点の）デッキと、それが保存済みかどうか
  const [baseline, setBaseline] = useState(initialDeck);
  const [isBaselineSaved, setIsBaselineSaved] = useState(isSaved);
  const [deck, setDeck] = useState(initialDeck);
  const [step, setStep] = useState<Step>('leader');
  const [filter, setFilter] = useState<Filter>('all');
  const [hovered, setHovered] = useState<InspectTarget | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const total = countDeckCards(deck);
  const errors = validateDeck(deck);
  const hasEdits = !sameDeck(deck, baseline);
  const canSave = errors.length === 0 && (hasEdits || !isBaselineSaved);
  const leader = findLeader(deck.leaderId);
  const pool = BASE_CARDS.filter(card => filter === 'all' || card.type === filter);
  const deckEntries = BASE_CARDS
    .filter(card => getCardCount(deck, card.id) > 0)
    .sort((a, b) => a.cost - b.cost);
  const costCurve = COSTS.map(cost => ({
    cost,
    count: deckEntries.filter(card => card.cost === cost).reduce((sum, card) => sum + getCardCount(deck, card.id), 0),
  }));
  const maxCurve = Math.max(1, ...costCurve.map(c => c.count));

  const updateDeck = (next: DeckList) => {
    setDeck(next);
    setNotice(null);
  };

  const handleAdd = (card: CardType) => {
    if (getCardCount(deck, card.id) >= RULES.maxCopiesPerCard) {
      setNotice(`「${card.name}」は${RULES.maxCopiesPerCard}枚までです。`);
    } else if (total >= RULES.deckSize) {
      setNotice(`デッキは${RULES.deckSize}枚までです。`);
    } else {
      updateDeck(addCard(deck, card.id));
    }
  };

  const handleSave = () => {
    if (!canSave) return;
    if (onSave(deck)) {
      setBaseline(deck);
      setIsBaselineSaved(true);
      setNotice('デッキを保存しました。');
    } else {
      setNotice('保存できませんでした（ブラウザの設定で保存が無効になっている可能性があります）。');
    }
  };

  const handleBack = () => {
    if (hasEdits && !window.confirm('保存していない変更があります。破棄してメニューへ戻りますか？')) return;
    onBack();
  };

  return (
    <div className="screen deck-builder">
      <ScreenHeader title="デッキ作成" onBack={handleBack}>
        <button type="button" className="primary-button save-button" onClick={handleSave} disabled={!canSave}>
          {canSave || errors.length > 0 ? '保存する' : '保存済み'}
        </button>
      </ScreenHeader>

      <ol className="step-tabs">
        <li>
          <button type="button" className={`step-tab ${step === 'leader' ? 'active' : ''}`} aria-current={step === 'leader' ? 'step' : undefined} onClick={() => setStep('leader')}>
            <span className="phase-step-no">1</span>大将を選ぶ
            <span className="step-tab-value">{leader?.name ?? '未選択'}</span>
          </button>
        </li>
        <li>
          <button type="button" className={`step-tab ${step === 'cards' ? 'active' : ''}`} aria-current={step === 'cards' ? 'step' : undefined} onClick={() => setStep('cards')}>
            <span className="phase-step-no">2</span>カードを選ぶ
            <span className="step-tab-value">{total} / {RULES.deckSize}枚</span>
          </button>
        </li>
      </ol>

      {step === 'leader' ? (
        <section className="leader-step" aria-label="大将を選ぶ">
          <p className="step-hint">デッキの大将カードを1枚選んでください。</p>
          <div className="leader-choices">
            {LEADER_CARDS.map(l => (
              <button
                key={l.id}
                type="button"
                className={`leader-choice ${deck.leaderId === l.id ? 'selected' : ''}`}
                aria-pressed={deck.leaderId === l.id}
                onClick={() => updateDeck({ ...deck, leaderId: l.id })}
              >
                <LeaderCard leader={l} hp={l.maxHp} size="large" />
                <span className="leader-choice-label">{deck.leaderId === l.id ? '選択中' : 'この大将にする'}</span>
              </button>
            ))}
          </div>
          <button type="button" className="primary-button next-step-button" onClick={() => setStep('cards')}>
            次へ：カードを選ぶ
          </button>
        </section>
      ) : (
        <div className="cards-step">
          <aside className="info-panel">
            <h2 className="panel-title">カード情報</h2>
            <div className="card-info">
              <CardPreview target={hovered} />
            </div>
          </aside>

          <section className="card-pool" aria-label="カードを選ぶ">
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
              <span className="step-hint">カードをクリックすると1枚追加します（同名{RULES.maxCopiesPerCard}枚まで）</span>
            </div>
            <div className="pool-grid">
              {pool.map(card => {
                const count = getCardCount(deck, card.id);
                return (
                  <div key={card.id} className={`pool-item ${count >= RULES.maxCopiesPerCard ? 'maxed' : ''}`}>
                    <Card
                      card={card}
                      onClick={() => handleAdd(card)}
                      onMouseEnter={() => setHovered({ kind: 'card', card })}
                      onMouseLeave={() => setHovered(null)}
                    />
                    <div className="pool-controls">
                      <button type="button" className="count-button" onClick={() => updateDeck(removeCard(deck, card.id))} disabled={count === 0} aria-label={`${card.name}を1枚外す`}>−</button>
                      <span className="pool-count">{count} / {RULES.maxCopiesPerCard}</span>
                      <button type="button" className="count-button" onClick={() => handleAdd(card)} disabled={count >= RULES.maxCopiesPerCard || total >= RULES.deckSize} aria-label={`${card.name}を1枚追加`}>＋</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="deck-panel" aria-label="デッキの内容">
            <div className="deck-total">
              <span>デッキ</span>
              <span className={total === RULES.deckSize ? 'complete' : ''}><b>{total}</b> / {RULES.deckSize}枚</span>
            </div>
            <div className="deck-progress" aria-hidden="true">
              <div style={{ width: `${(total / RULES.deckSize) * 100}%` }}></div>
            </div>

            <button type="button" className="deck-leader-row" onClick={() => setStep('leader')}>
              <span className="leader-badge">大将</span>
              <span className="deck-leader-name">{leader?.name ?? '未選択'}</span>
              <span className="deck-leader-change">変更</span>
            </button>

            <ul className="deck-list">
              {deckEntries.length === 0 && <li className="deck-empty">カードがまだありません</li>}
              {deckEntries.map(card => (
                <li key={card.id} className="deck-row" onMouseEnter={() => setHovered({ kind: 'card', card })} onMouseLeave={() => setHovered(null)}>
                  <span className="card-cost">{card.cost}</span>
                  <span className={`deck-row-name ${card.type === 'Spell' ? 'spell' : ''}`}>{card.name}</span>
                  <span className="deck-row-count">×{getCardCount(deck, card.id)}</span>
                  <button type="button" className="count-button small" onClick={() => updateDeck(removeCard(deck, card.id))} aria-label={`${card.name}を1枚外す`}>−</button>
                  <button type="button" className="count-button small" onClick={() => handleAdd(card)} aria-label={`${card.name}を1枚追加`}>＋</button>
                </li>
              ))}
            </ul>

            <div className="cost-curve" aria-label="コストごとの枚数">
              {costCurve.map(({ cost, count }) => (
                <div key={cost} className="cost-curve-item">
                  <div className="cost-curve-bar"><div style={{ height: `${(count / maxCurve) * 100}%` }}></div></div>
                  <span className="cost-curve-count">{count}</span>
                  <span className="cost-curve-label">コスト{cost}</span>
                </div>
              ))}
            </div>

            <div className="deck-status" role="status">
              {notice && <p className="deck-notice">{notice}</p>}
              {errors.map(error => <p key={error} className="deck-error">{error}</p>)}
              {errors.length === 0 && !notice && <p className="deck-ok">このデッキで対戦できます。</p>}
            </div>

            <div className="deck-actions">
              <button type="button" className="secondary-button" onClick={() => updateDeck(fillDeck(deck))} disabled={total >= RULES.deckSize}>
                残りを自動で埋める
              </button>
              <button type="button" className="text-button" onClick={() => updateDeck({ ...deck, cards: {} })} disabled={total === 0}>
                すべて外す
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

export default DeckBuilderScreen;
