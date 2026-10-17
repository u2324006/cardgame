import React from 'react';
import { SpellEffect } from '../types/card';
import { Draft, EFFECT_OPTIONS, LIMITS, describeEffect } from '../logic/cardEditor';
import '../styles/CardEditor.css';

interface EditableCardProps {
  draft: Draft;
  onChange: (draft: Draft) => void;
  onPickImage: () => void;
}

// 数値の入力欄：空欄は NaN として持ち、チェックでエラーにする
const toNumber = (value: string): number => (value.trim() === '' ? NaN : Number(value));
const showNumber = (value: number): string | number => (Number.isNaN(value) ? '' : value);

interface NumberFieldProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  className: string;
  min: number;
  max: number;
}

const NumberField: React.FC<NumberFieldProps> = ({ value, onChange, label, className, min, max }) => (
  <input
    type="number"
    inputMode="numeric"
    className={`edit-number ${className}`}
    aria-label={label}
    title={label}
    min={min}
    max={max}
    value={showNumber(value)}
    placeholder="0"
    onChange={e => onChange(toNumber(e.target.value))}
  />
);

// カードの見た目のまま、文字や数値を直接書き込める白紙のカード
const EditableCard: React.FC<EditableCardProps> = ({ draft, onChange, onPickImage }) => {
  const { card } = draft;
  const update = (changes: Record<string, unknown>) => onChange({ ...draft, card: { ...card, ...changes } } as Draft);

  // 効果を変えたとき、説明文が自動の文のままなら一緒に書き換える
  const updateEffect = (effect: SpellEffect) => {
    if (draft.kind !== 'Spell') return;
    const { effect: before, description: current } = draft.card;
    const wasAutoText = current === '' || (Number.isFinite(before.amount) && current === describeEffect(before));
    const description = wasAutoText && Number.isFinite(effect.amount) ? describeEffect(effect) : current;
    onChange({ ...draft, card: { ...draft.card, effect, description } });
  };

  const art = (
    <button type="button" className="edit-art" onClick={onPickImage} aria-label="イラストを選ぶ">
      {card.image ? <img src={card.image} alt="" /> : <span className="edit-art-placeholder">クリックしてイラストを選ぶ</span>}
    </button>
  );

  return (
    <div className={`edit-card ${draft.kind.toLowerCase()}`}>
      <div className="edit-header">
        {draft.kind === 'Leader' ? (
          <span className="leader-badge">大将</span>
        ) : (
          <div className="edit-cost-circle">
            <NumberField value={draft.card.cost} onChange={cost => update({ cost })} label="コスト" className="edit-cost" min={LIMITS.cost.min} max={LIMITS.cost.max} />
          </div>
        )}
        <input
          className="edit-name"
          aria-label="カード名"
          placeholder="カード名"
          maxLength={LIMITS.nameLength}
          value={card.name}
          onChange={e => update({ name: e.target.value })}
        />
      </div>

      <div className="edit-art-area">
        {art}
        {draft.kind === 'Monster' && (
          <label className="edit-hp">
            HP
            <NumberField value={draft.card.cardHp} onChange={cardHp => update({ cardHp })} label="HP" className="" min={LIMITS.hp.min} max={LIMITS.hp.max} />
          </label>
        )}
        {draft.kind === 'Leader' && (
          <label className="edit-hp">
            HP
            <NumberField value={draft.card.maxHp} onChange={maxHp => update({ maxHp })} label="大将のHP" className="" min={LIMITS.hp.min} max={LIMITS.hp.max} />
          </label>
        )}
        {draft.kind !== 'Leader' && (
          <input
            className="edit-race"
            aria-label="種族"
            placeholder="種族"
            maxLength={LIMITS.raceLength}
            value={draft.card.race ?? ''}
            onChange={e => update({ race: e.target.value })}
          />
        )}
      </div>

      <textarea
        className="edit-description"
        aria-label="説明"
        placeholder={draft.kind === 'Leader' ? '大将の効果（今は表示のみ）' : '説明やフレーバーテキスト'}
        maxLength={LIMITS.descriptionLength}
        value={card.description}
        onChange={e => update({ description: e.target.value })}
      />

      {draft.kind === 'Monster' && (
        <div className="edit-stats">
          <label className="edit-stat fa">
            FA
            <NumberField value={draft.card.frontAttack} onChange={frontAttack => update({ frontAttack })} label="FA（前衛での攻撃力）" className="" min={LIMITS.attack.min} max={LIMITS.attack.max} />
          </label>
          <label className="edit-stat ba">
            BA
            <NumberField value={draft.card.backAttack} onChange={backAttack => update({ backAttack })} label="BA（後衛での攻撃力）" className="" min={LIMITS.attack.min} max={LIMITS.attack.max} />
          </label>
        </div>
      )}

      {draft.kind === 'Spell' && (
        <div className="edit-effect">
          <select
            aria-label="効果の種類"
            value={draft.card.effect.kind}
            onChange={e => updateEffect({ ...draft.card.effect, kind: e.target.value as SpellEffect['kind'] })}
          >
            {EFFECT_OPTIONS.map(option => <option key={option.kind} value={option.kind}>{option.label}</option>)}
          </select>
          <NumberField
            value={draft.card.effect.amount}
            onChange={amount => updateEffect({ ...draft.card.effect, amount })}
            label="効果の数値"
            className="edit-effect-amount"
            min={LIMITS.effectAmount.min}
            max={LIMITS.effectAmount.max}
          />
        </div>
      )}
    </div>
  );
};

export default EditableCard;
