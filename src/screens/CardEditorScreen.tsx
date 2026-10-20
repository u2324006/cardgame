import React, { useState } from 'react';
import { LeaderCard as LeaderCardType, MonsterCard, SpellCard } from '../types/card';
import { CardSet, getCardSet, mergeById, resetCardSet, saveCardSet } from '../logic/cards';
import { CardRecords, recordsToCards } from '../logic/cardData';
import {
  Draft,
  EditorKind,
  changeCardType,
  createBlankDraft,
  deleteFromSet,
  draftFromCard,
  draftFromLeader,
  duplicateDraft,
  finalizeDraft,
  getImplementationStatus,
  summarizeEffect,
  LIMITS,
  findBuiltin,
  getBalance,
  getCardStatus,
  hasEnoughKinds,
  minimumKinds,
  upsertDraft,
  validateDraft,
} from '../logic/cardEditor';
import EditableCard from '../components/EditableCard';
import Card from '../components/Card';
import LeaderCard from '../components/LeaderCard';
import ConfirmDialog from '../components/ConfirmDialog';
import ImagePickerDialog from '../components/ImagePickerDialog';
import CardSetTransferDialog from '../components/CardSetTransferDialog';
import ScreenHeader from './ScreenHeader';

type Filter = 'all' | 'Monster' | 'Spell' | 'Leader';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'Monster', label: 'モンスター' },
  { value: 'Spell', label: 'スペル' },
  { value: 'Leader', label: '大将' },
];

const KIND_LABELS: Record<EditorKind, string> = { Monster: 'モンスター', Spell: 'スペル', Leader: '大将' };
const STATUS_LABELS = { builtin: '', modified: '変更', new: '新規' };

interface PendingConfirm {
  message: string;
  confirmLabel: string;
  action: () => void;
}

const sameDraft = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b);
const safe = (n: number) => (Number.isFinite(n) ? n : 0);

const allDrafts = (set: CardSet): Draft[] => [
  ...set.leaders.map(draftFromLeader),
  ...[...set.cards].sort((a, b) => a.cost - b.cost).map(draftFromCard),
];

// 入力途中（空欄など）のカードも表示できるよう、数値を補ったプレビュー
const PreviewCard: React.FC<{ draft: Draft }> = ({ draft }) => {
  if (draft.kind === 'Leader') {
    const leader: LeaderCardType = { ...draft.card, name: draft.card.name || 'カード名', maxHp: safe(draft.card.maxHp) };
    return <LeaderCard leader={leader} hp={leader.maxHp} />;
  }
  const name = draft.card.name || 'カード名';
  const cost = safe(draft.card.cost);
  if (draft.kind === 'Monster') {
    const { frontAttack, backAttack, cardHp } = draft.card;
    const card: MonsterCard = { ...draft.card, name, cost, frontAttack: safe(frontAttack), backAttack: safe(backAttack), cardHp: safe(cardHp) };
    return <Card card={card} />;
  }
  const spell: SpellCard = { ...draft.card, name, cost, summary: summarizeEffect(draft.card.effect) };
  return <Card card={spell} />;
};

interface CardEditorScreenProps {
  onBack: () => void;
}

const CardEditorScreen: React.FC<CardEditorScreenProps> = ({ onBack }) => {
  const [cardSet, setCardSet] = useState<CardSet>(getCardSet);
  const [draft, setDraft] = useState<Draft>(() => allDrafts(getCardSet())[0] ?? createBlankDraft('Monster'));
  // 最後に保存した内容（新しいカードなら作り始めたときの白紙）と、まだ一度も保存していないカードか
  const [baseline, setBaseline] = useState<Draft>(draft);
  const [isNew, setIsNew] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const isDirty = !sameDraft(draft, baseline);
  const errors = validateDraft(draft);
  const builtin = findBuiltin(draft.card.id);
  const builtinDraft = builtin ? (isMonsterOrSpell(builtin) ? draftFromCard(builtin) : draftFromLeader(builtin)) : null;
  const isModifiedBuiltin = !!builtinDraft && !sameDraft(builtinDraft, draft);
  // 前に保存したときの内容（効果の実装状況を引き継ぐのに使う）
  const storedCard = [...cardSet.cards, ...cardSet.leaders].find(c => c.id === draft.card.id);
  const implementation = getImplementationStatus(draft, storedCard);
  const updateNotes = (changes: { illustrationPrompt?: string; memo?: string }) =>
    setDraft({ ...draft, card: { ...draft.card, ...changes } } as Draft);
  const listed = allDrafts(cardSet).filter(d => filter === 'all' || d.kind === filter);
  const balance = draft.kind === 'Monster' && errors.length === 0 ? getBalance(draft.card, cardSet) : null;

  // 保存していない変更があれば確認してから実行する
  const guard = (action: () => void) => {
    if (isDirty) {
      setPending({ message: '保存していない変更があります。破棄しますか？', confirmLabel: '破棄する', action });
    } else {
      action();
    }
  };

  const open = (next: Draft, asNew = false) => {
    setDraft(next);
    setBaseline(next);
    setIsNew(asNew);
    setNotice(null);
  };

  const applySet = (set: CardSet, message: string) => {
    const ok = saveCardSet(set);
    setCardSet(set);
    setNotice(ok ? message : '保存できませんでした（ブラウザの設定で保存が無効になっている可能性があります）。');
  };

  const handleSave = () => {
    if (errors.length > 0) return;
    const finalized = finalizeDraft(draft, storedCard);
    open(finalized);
    applySet(upsertDraft(cardSet, finalized), `「${finalized.card.name}」を保存しました。デッキ作成と対戦にすぐ反映されます。`);
  };

  const handleDelete = () => {
    if (isNew) {
      guard(() => open(allDrafts(cardSet)[0]));
      return;
    }
    setPending({
      message: `「${draft.card.name}」を削除しますか？このカードを入れたデッキは組み直しが必要になります。`,
      confirmLabel: '削除する',
      action: () => {
        const result = deleteFromSet(cardSet, draft.card.id);
        if ('error' in result) {
          setNotice(result.error);
          return;
        }
        const first = allDrafts(result.set)[0];
        open(first);
        applySet(result.set, `「${draft.card.name}」を削除しました。`);
      },
    });
  };

  const handleResetAll = () => {
    setPending({
      message: '作成・変更したカードをすべて消して、最初から入っているカードに戻しますか？',
      confirmLabel: 'すべて戻す',
      action: () => {
        resetCardSet();
        const set = getCardSet();
        setCardSet(set);
        open(allDrafts(set)[0]);
        setNotice('最初から入っているカードに戻しました。');
      },
    });
  };

  const handleKindChange = (kind: EditorKind) => {
    if (!isNew || draft.kind === kind) return;
    if (kind === 'Leader' || draft.kind === 'Leader') {
      const blank = createBlankDraft(kind);
      setDraft({ ...blank, card: { ...blank.card, name: draft.card.name, image: draft.card.image } } as Draft);
    } else {
      setDraft(changeCardType(draft, kind));
    }
  };

  return (
    <div className="screen card-editor">
      <ScreenHeader title="カード作成" onBack={() => guard(onBack)}>
        <button type="button" className="secondary-button header-button" onClick={() => setIsTransferring(true)}>書き出し・読み込み</button>
        <button type="button" className="text-button" onClick={handleResetAll}>すべて最初の状態に戻す</button>
      </ScreenHeader>

      {!hasEnoughKinds(cardSet) && (
        <div className="menu-warning" role="alert">
          <p>デッキを40枚組むには、モンスターとスペルが合わせて{minimumKinds}種類以上必要です（今は{cardSet.cards.length}種類）。</p>
        </div>
      )}

      <div className="editor-layout">
        <aside className="editor-list" aria-label="カード一覧">
          <div className="editor-list-head">
            <h2 className="panel-title">カード一覧</h2>
            <button type="button" className="primary-button new-card-button" onClick={() => guard(() => open(createBlankDraft(filter === 'Leader' ? 'Leader' : filter === 'Spell' ? 'Spell' : 'Monster'), true))}>
              ＋ 新しいカード
            </button>
          </div>
          <div className="filter-tabs" role="group" aria-label="カードの種類">
            {FILTERS.map(f => (
              <button key={f.value} type="button" className={`filter-tab small ${filter === f.value ? 'active' : ''}`} aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
                {f.label}
              </button>
            ))}
          </div>
          <ul className="editor-list-items">
            {isNew && (
              <li>
                <button type="button" className="editor-list-item selected">
                  <span className="card-cost">{draft.kind === 'Leader' ? '将' : safe((draft.card as MonsterCard).cost)}</span>
                  <span className="editor-list-name">{draft.card.name || '（新しいカード）'}</span>
                  <span className="editor-tag new">作成中</span>
                </button>
              </li>
            )}
            {listed.map(item => {
              // 状態は保存されているカードで判定する（編集用の形には空の項目が足されているため）
              const stored = [...cardSet.cards, ...cardSet.leaders].find(c => c.id === item.card.id) ?? item.card;
              const status = getCardStatus(stored);
              const itemBalance = item.kind === 'Monster' ? getBalance(item.card, cardSet) : null;
              const selected = !isNew && item.card.id === draft.card.id;
              return (
                <li key={item.card.id}>
                  <button
                    type="button"
                    className={`editor-list-item ${selected ? 'selected' : ''}`}
                    aria-current={selected ? 'true' : undefined}
                    onClick={() => !selected && guard(() => open(item))}
                  >
                    <span className={`card-cost ${item.kind === 'Leader' ? 'leader' : ''}`}>{item.kind === 'Leader' ? '将' : item.card.cost}</span>
                    <span className={`editor-list-name ${item.kind === 'Spell' ? 'spell' : ''}`}>{item.card.name}</span>
                    {itemBalance && (itemBalance.label === '強め' || itemBalance.label === '弱め') && (
                      <span className={`editor-tag ${itemBalance.label === '強め' ? 'strong' : 'weak'}`}>{itemBalance.label}</span>
                    )}
                    {item.card.implementation === '未実装' && <span className="editor-tag pending">未実装</span>}
                    {STATUS_LABELS[status] && <span className={`editor-tag ${status}`}>{STATUS_LABELS[status]}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className="editor-canvas" aria-label="カードを書く">
          <EditableCard draft={draft} onChange={next => { setDraft(next); setNotice(null); }} onPickImage={() => setIsPickingImage(true)} />
          <p className="step-hint">カードの上の文字や数字を直接書き換えられます。</p>
        </section>

        <aside className="editor-side">
          <section className="editor-section">
            <h3 className="editor-section-title">種類</h3>
            <div className="segmented" role="group" aria-label="カードの種類">
              {(['Monster', 'Spell', 'Leader'] as EditorKind[]).map(kind => (
                <button
                  key={kind}
                  type="button"
                  className={draft.kind === kind ? 'active' : ''}
                  aria-pressed={draft.kind === kind}
                  disabled={!isNew && draft.kind !== kind}
                  onClick={() => handleKindChange(kind)}
                >
                  {KIND_LABELS[kind]}
                </button>
              ))}
            </div>
            {!isNew && <p className="step-hint">種類を変えるときは、新しいカードとして作ってください。</p>}
          </section>

          {draft.kind === 'Monster' && (
            <section className="editor-section">
              <h3 className="editor-section-title">強さの目安</h3>
              {balance ? (
                <>
                  <div className="balance-row">
                    <span className={`editor-tag ${balance.label === '強め' ? 'strong' : balance.label === '弱め' ? 'weak' : 'neutral'}`}>{balance.label}</span>
                    {balance.ratio !== null && (
                      <span className="balance-detail">同じコストの平均の {Math.round(balance.ratio * 100)}%</span>
                    )}
                  </div>
                  {balance.ratio !== null && (
                    <div className="balance-bar" aria-hidden="true">
                      <div className="balance-fill" style={{ width: `${Math.min(100, (balance.ratio / 2) * 100)}%` }}></div>
                      <div className="balance-mark"></div>
                    </div>
                  )}
                  <p className="step-hint">
                    FA + BA + HPの半分 = {balance.power}
                    {balance.average !== null && `（コスト${draft.card.cost}の平均 ${balance.average.toFixed(1)}）`}
                    。効果や前衛・後衛の向き不向きは含まない目安です。
                  </p>
                </>
              ) : (
                <p className="step-hint">数値を入力すると表示されます。</p>
              )}
            </section>
          )}

          <section className="editor-section">
            <h3 className="editor-section-title">AI に渡す情報</h3>
            <label className="editor-field">
              <span>イラストのイメージ</span>
              <textarea
                value={draft.card.illustrationPrompt ?? ''}
                maxLength={LIMITS.illustrationPromptLength}
                placeholder="例：夕焼けの火山を背に、赤い竜が翼を広げて炎を吐いている"
                onChange={e => updateNotes({ illustrationPrompt: e.target.value })}
              />
            </label>
            <label className="editor-field">
              <span>メモ</span>
              <textarea
                className="short"
                value={draft.card.memo ?? ''}
                maxLength={LIMITS.memoLength}
                placeholder="調整の予定など自由に"
                onChange={e => updateNotes({ memo: e.target.value })}
              />
            </label>
            <div className="implementation-row">
              <span>効果の実装</span>
              <span className={`editor-tag ${implementation === '未実装' ? 'pending' : implementation === '実装済み' ? 'done' : 'neutral'}`}>{implementation}</span>
            </div>
            {implementation === '未実装' && (
              <p className="step-hint">「効果」の文章は、AI に実装してもらうまで対戦では働きません。</p>
            )}
          </section>

          <section className="editor-section">
            <h3 className="editor-section-title">対戦での見た目</h3>
            <div className="editor-preview"><PreviewCard draft={draft} /></div>
          </section>

          <div className="deck-status" role="status">
            {notice && <p className="deck-notice">{notice}</p>}
            {errors.map(error => <p key={error} className="deck-error">{error}</p>)}
          </div>

          <div className="editor-actions">
            <button type="button" className="primary-button" onClick={handleSave} disabled={errors.length > 0 || (!isDirty && !isNew)}>
              {isNew ? 'カードを追加する' : isDirty ? '変更を保存する' : '保存済み'}
            </button>
            {isDirty && !isNew && (
              <button type="button" className="secondary-button" onClick={() => open(baseline)}>変更を取り消す</button>
            )}
            {isModifiedBuiltin && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => builtinDraft && setDraft(builtinDraft)}
              >
                最初の内容に戻す
              </button>
            )}
            {!isNew && (
              <button type="button" className="secondary-button" onClick={() => guard(() => open(duplicateDraft(baseline), true))}>
                複製して新しく作る
              </button>
            )}
            <button type="button" className="text-button danger" onClick={handleDelete}>{isNew ? '作成をやめる' : '削除する'}</button>
          </div>
        </aside>
      </div>

      {pending && (
        <ConfirmDialog
          message={pending.message}
          confirmLabel={pending.confirmLabel}
          onConfirm={() => { pending.action(); setPending(null); }}
          onCancel={() => setPending(null)}
        />
      )}
      {isPickingImage && (
        <ImagePickerDialog
          current={draft.card.image}
          onPick={image => { setDraft({ ...draft, card: { ...draft.card, image } } as Draft); setIsPickingImage(false); }}
          onClose={() => setIsPickingImage(false)}
        />
      )}
      {isTransferring && (
        <CardSetTransferDialog
          cardSet={cardSet}
          onImport={(records: CardRecords) => {
            const imported = recordsToCards(records);
            const set = { cards: mergeById(cardSet.cards, imported.cards), leaders: mergeById(cardSet.leaders, imported.leaders) };
            open(allDrafts(set)[0]);
            applySet(set, `${imported.cards.length + imported.leaders.length}枚のカードを取り込みました。`);
            setIsTransferring(false);
          }}
          onClose={() => setIsTransferring(false)}
        />
      )}
    </div>
  );
};

const isMonsterOrSpell = (card: ReturnType<typeof findBuiltin>): card is Exclude<ReturnType<typeof findBuiltin>, LeaderCardType | undefined> =>
  !!card && 'type' in card;

export default CardEditorScreen;
