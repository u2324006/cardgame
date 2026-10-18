import React from 'react';
import { SpellEffect, SpellTarget, effectHasAmount, isImplementedEffect } from '../types/card';
import { Draft, EFFECT_OPTIONS, LIMITS, TARGET_OPTIONS, describeEffect } from '../logic/cardEditor';
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
  className?: string;
  min: number;
  max: number;
}

const NumberField: React.FC<NumberFieldProps> = ({ value, onChange, label, className = '', min, max }) => (
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

// 効果の種類を変えたときの新しい効果（数値は前の値を引き継ぐ）
const switchEffect = (current: SpellEffect, kind: SpellEffect['kind']): SpellEffect => {
  if (kind === 'custom') return { kind };
  const amount = isImplementedEffect(current) ? current.amount : 1;
  return { kind, amount } as SpellEffect;
};

// カードの見た目のまま、文字や数値を直接書き込める白紙のカード
const EditableCard: React.FC<EditableCardProps> = ({ draft, onChange, onPickImage }) => {
  const { card } = draft;
  const update = (changes: Record<string, unknown>) => onChange({ ...draft, card: { ...card, ...changes } } as Draft);

  // 実装済みの効果を選んだときは、効果の文章を自動で書く。まだない効果に変えたときは、自動の文章を消して書いてもらう
  const updateEffect = (effect: SpellEffect) => {
    if (draft.kind !== 'Spell') return;
    const wasAuto = isImplementedEffect(draft.card.effect);
    const effectText = isImplementedEffect(effect)
      ? (Number.isFinite(effect.amount) ? describeEffect(effect) : draft.card.effectText)
      : (wasAuto ? '' : draft.card.effectText);
    const target = isImplementedEffect(effect) ? undefined : draft.card.target ?? 'enemyMonster';
    onChange({ ...draft, card: { ...draft.card, effect, effectText, target } });
  };

  const isAutoEffectText = draft.kind === 'Spell' && isImplementedEffect(draft.card.effect);

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
        <button type="button" className="edit-art" onClick={onPickImage} aria-label="イラストを選ぶ">
          {card.image ? <img src={card.image} alt="" /> : <span className="edit-art-placeholder">クリックしてイラストを選ぶ</span>}
        </button>
        {draft.kind === 'Monster' && (
          <label className="edit-hp">
            HP
            <NumberField value={draft.card.cardHp} onChange={cardHp => update({ cardHp })} label="HP" min={LIMITS.hp.min} max={LIMITS.hp.max} />
          </label>
        )}
        {draft.kind === 'Leader' && (
          <label className="edit-hp">
            HP
            <NumberField value={draft.card.maxHp} onChange={maxHp => update({ maxHp })} label="大将のHP" min={LIMITS.hp.min} max={LIMITS.hp.max} />
          </label>
        )}
        <input
          className="edit-race"
          aria-label="種族"
          placeholder="種族"
          maxLength={LIMITS.raceLength}
          value={draft.card.race ?? ''}
          onChange={e => update({ race: e.target.value })}
        />
      </div>

      <div className="edit-texts">
        <textarea
          className="edit-effect-text"
          aria-label="効果"
          placeholder={draft.kind === 'Spell' ? '効果を文章で書く' : '効果を文章で書く（なければ空のまま）'}
          maxLength={LIMITS.effectTextLength}
          value={card.effectText ?? ''}
          readOnly={isAutoEffectText}
          title={isAutoEffectText ? '実装済みの効果は、種類と数値から自動で書かれます' : undefined}
          onChange={e => update({ effectText: e.target.value })}
        />
        <textarea
          className="edit-flavor-text"
          aria-label="雰囲気の文"
          placeholder="雰囲気の文（ルールには関係しない）"
          maxLength={LIMITS.flavorTextLength}
          value={card.flavorText ?? ''}
          onChange={e => update({ flavorText: e.target.value })}
        />
      </div>

      {draft.kind === 'Monster' && (
        <div className="edit-stats">
          <label className="edit-stat fa">
            FA
            <NumberField value={draft.card.frontAttack} onChange={frontAttack => update({ frontAttack })} label="FA（前衛での攻撃力）" min={LIMITS.attack.min} max={LIMITS.attack.max} />
          </label>
          <label className="edit-stat ba">
            BA
            <NumberField value={draft.card.backAttack} onChange={backAttack => update({ backAttack })} label="BA（後衛での攻撃力）" min={LIMITS.attack.min} max={LIMITS.attack.max} />
          </label>
        </div>
      )}

      {draft.kind === 'Spell' && (
        <div className="edit-effect">
          <select
            aria-label="効果の種類"
            value={draft.card.effect.kind}
            onChange={e => updateEffect(switchEffect(draft.card.effect, e.target.value as SpellEffect['kind']))}
          >
            {EFFECT_OPTIONS.map(option => <option key={option.kind} value={option.kind}>{option.label}</option>)}
          </select>
          {isImplementedEffect(draft.card.effect) ? effectHasAmount(draft.card.effect.kind) && (
            <NumberField
              value={draft.card.effect.amount}
              onChange={amount => updateEffect({ ...(draft.card.effect as Exclude<SpellEffect, { kind: 'custom' }>), amount })}
              label="効果の数値"
              className="edit-effect-amount"
              min={LIMITS.effectAmount.min}
              max={LIMITS.effectAmount.max}
            />
          ) : (
            <select
              aria-label="効果の対象"
              className="edit-effect-target"
              value={draft.card.target ?? 'none'}
              onChange={e => update({ target: e.target.value as SpellTarget })}
            >
              {TARGET_OPTIONS.map(option => <option key={option.target} value={option.target}>{option.label}</option>)}
            </select>
          )}
        </div>
      )}
    </div>
  );
};

export default EditableCard;
