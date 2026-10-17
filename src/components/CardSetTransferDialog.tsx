import React, { useEffect, useState } from 'react';
import { CardSet, exportCardSet, parseCardSet } from '../logic/cards';

interface CardSetTransferDialogProps {
  cardSet: CardSet;
  onImport: (set: CardSet) => void;
  onClose: () => void;
}

// カードの一覧を文字（JSON）で書き出し・読み込みする
const CardSetTransferDialog: React.FC<CardSetTransferDialogProps> = ({ cardSet, onImport, onClose }) => {
  const exported = exportCardSet(cardSet);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [importText, setImportText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exported);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  const handleImport = () => {
    const set = parseCardSet(importText);
    if (!set) {
      setError('読み込めませんでした。書き出した文字をそのまま全部貼り付けてください。');
      return;
    }
    onImport(set);
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog transfer-dialog" role="dialog" aria-modal="true" aria-label="書き出し・読み込み" onClick={e => e.stopPropagation()}>
        <h2 className="panel-title">書き出し・読み込み</h2>

        <section className="transfer-section">
          <label htmlFor="card-export">今のカード一覧（{cardSet.cards.length + cardSet.leaders.length}枚）</label>
          <textarea id="card-export" readOnly value={exported} onFocus={e => e.target.select()} />
          <div className="transfer-actions">
            <button type="button" className="secondary-button" onClick={handleCopy}>コピーする</button>
            {copyState === 'copied' && <span className="deck-ok">コピーしました。</span>}
            {copyState === 'failed' && <span className="deck-notice">コピーできませんでした。上の文字を選んでコピーしてください。</span>}
          </div>
          <p className="step-hint">この文字を開発者に渡すと、ゲームの最初から入っているカードとして取り込めます。</p>
        </section>

        <section className="transfer-section">
          <label htmlFor="card-import">読み込む（書き出した文字を貼り付け）</label>
          <textarea id="card-import" value={importText} onChange={e => { setImportText(e.target.value); setError(null); }} />
          <div className="transfer-actions">
            <button type="button" className="primary-button" onClick={handleImport} disabled={!importText.trim()}>読み込んで置き換える</button>
            <button type="button" className="text-button" onClick={onClose}>閉じる</button>
          </div>
          {error && <p className="deck-error">{error}</p>}
        </section>
      </div>
    </div>
  );
};

export default CardSetTransferDialog;
