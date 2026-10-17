import React, { useEffect, useState } from 'react';
import { CardSet } from '../logic/cards';
import { CardRecords, parseRecords, toRecords } from '../logic/cardData';
import { getCardStatus } from '../logic/cardEditor';

interface CardSetTransferDialogProps {
  cardSet: CardSet;
  onImport: (records: CardRecords) => void;
  onClose: () => void;
}

type Category = keyof CardRecords | 'all';
type Scope = 'changed' | 'all';

const CATEGORIES: { value: Category; label: string; file: string }[] = [
  { value: 'monsters', label: 'モンスター', file: 'monsters.json' },
  { value: 'spells', label: 'スペル', file: 'spells.json' },
  { value: 'leaders', label: '大将', file: 'leaders.json' },
  { value: 'all', label: '3つまとめて', file: '' },
];

// カードの情報を、カテゴリごとの JSON で書き出す・読み込む（AI に効果の実装やイラストの作成を頼むため）
const CardSetTransferDialog: React.FC<CardSetTransferDialogProps> = ({ cardSet, onImport, onClose }) => {
  const [category, setCategory] = useState<Category>('monsters');
  const [scope, setScope] = useState<Scope>('changed');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [importText, setImportText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const isTarget = (card: { id: string }) => scope === 'all' || getCardStatus(card as Parameters<typeof getCardStatus>[0]) !== 'builtin';
  const records = toRecords(cardSet.cards.filter(isTarget), cardSet.leaders.filter(isTarget));
  const exported = JSON.stringify(category === 'all' ? records : records[category], null, 2);
  const count = category === 'all'
    ? records.monsters.length + records.spells.length + records.leaders.length
    : records[category].length;
  const current = CATEGORIES.find(c => c.value === category)!;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exported);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  const handleImport = () => {
    const parsed = parseRecords(importText);
    if (!parsed) {
      setError('読み込めませんでした。書き出した文字をそのまま全部貼り付けてください。');
      return;
    }
    onImport(parsed);
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog transfer-dialog" role="dialog" aria-modal="true" aria-label="書き出し・読み込み" onClick={e => e.stopPropagation()}>
        <h2 className="panel-title">書き出し・読み込み</h2>

        <section className="transfer-section">
          <div className="filter-tabs" role="group" aria-label="カテゴリ">
            {CATEGORIES.map(c => (
              <button
                key={c.value}
                type="button"
                className={`filter-tab small ${category === c.value ? 'active' : ''}`}
                aria-pressed={category === c.value}
                onClick={() => { setCategory(c.value); setCopyState('idle'); }}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="segmented scope-toggle" role="group" aria-label="書き出す範囲">
            <button type="button" className={scope === 'changed' ? 'active' : ''} aria-pressed={scope === 'changed'} onClick={() => { setScope('changed'); setCopyState('idle'); }}>
              作成・変更したカード
            </button>
            <button type="button" className={scope === 'all' ? 'active' : ''} aria-pressed={scope === 'all'} onClick={() => { setScope('all'); setCopyState('idle'); }}>
              すべてのカード
            </button>
          </div>
          <label htmlFor="card-export">
            {current.label}（{count}枚）{current.file && <span className="transfer-file">→ src/data/cards/{current.file}</span>}
          </label>
          <textarea id="card-export" readOnly value={exported} onFocus={e => e.target.select()} />
          <div className="transfer-actions">
            <button type="button" className="secondary-button" onClick={handleCopy} disabled={count === 0}>コピーする</button>
            {copyState === 'copied' && <span className="deck-ok">コピーしました。</span>}
            {copyState === 'failed' && <span className="deck-notice">コピーできませんでした。上の文字を選んでコピーしてください。</span>}
          </div>
          <p className="step-hint">
            この文字を AI に渡すと、「効果」の文章どおりに効果を実装したり、「イラストのイメージ」から絵を作ったりしてもらえます。
          </p>
        </section>

        <section className="transfer-section">
          <label htmlFor="card-import">読み込む（書き出した文字を貼り付け）</label>
          <textarea id="card-import" value={importText} onChange={e => { setImportText(e.target.value); setError(null); }} />
          <div className="transfer-actions">
            <button type="button" className="primary-button" onClick={handleImport} disabled={!importText.trim()}>取り込む</button>
            <button type="button" className="text-button" onClick={onClose}>閉じる</button>
          </div>
          <p className="step-hint">同じ ID のカードは上書きし、新しいカードは追加します。</p>
          {error && <p className="deck-error">{error}</p>}
        </section>
      </div>
    </div>
  );
};

export default CardSetTransferDialog;
