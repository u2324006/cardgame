import React, { useEffect, useState } from 'react';
import '../styles/GameBoard.css';
import { createInitialGameState } from '../logic/initialState';
import {
  ActionResult,
  activateLeaderAbility,
  attack,
  boostMonster,
  canBoost,
  canCommand,
  canUseLeaderAbility,
  castSpell,
  commandMonster,
  discardCards,
  endTurn,
  canAttackThisTurn,
  getAttackError,
  getCardAt,
  getHpBonus,
  getMonsterPositions,
  getSpellCost,
  getSummonCost,
  isLeaderActive,
  hasFrontRowMonsters,
  moveMonster,
  needsPierceTarget,
  nextPhase,
  pickCard,
  resolveReaction,
  playCard,
  skipFreeSpell,
  skipFreeSummon,
} from '../logic/gameLogic';
import PickDialog from './PickDialog';
import { getSpellTargetSide, isMonster, isUntargetedSpell } from '../types/card';
import { DeckList } from '../logic/deck';
import { AttackTarget, FieldPosition, GameState, PlayerId, Row } from '../types/gameState';
import { useAutoProgress } from '../hooks/useAutoProgress';
import { useTimedMessage } from '../hooks/useTimedMessage';
import PlayerArea from './PlayerArea';
import ControlPanel from './ControlPanel';
import CardPreview, { InspectTarget } from './CardPreview';

const HUMAN: PlayerId = 'player1';
const AI: PlayerId = 'player2';
const MESSAGE_DURATION_MS = 3000;

// プレイヤーが今選んでいるもの（同時に選べるのは1つだけ）
type Selection =
  | { kind: 'none' }
  | { kind: 'hand'; index: number; payByDiscard?: boolean; payBySacrifice?: boolean } // 召喚・スペルに使う手札（payByDiscard：手札を捨てて召喚、payBySacrifice：仲間を墓地に送って合体）
  | { kind: 'supply'; index: number; positions: FieldPosition[] } // 補給線で墓地に送る後衛のモンスターを選んでいる
  | { kind: 'move'; from: FieldPosition } // 移動させるモンスター
  | { kind: 'attacker'; from: FieldPosition } // 攻撃させるモンスター
  | { kind: 'command'; from: FieldPosition } // 指揮する指揮官（次に FA を上げる前衛の味方を選ぶ）
  | { kind: 'pierce'; from: FieldPosition; target: AttackTarget }; // 槍兵の攻撃（次に追加ダメージを与える相手の後衛を選ぶ）

const NO_SELECTION: Selection = { kind: 'none' };

// 対象を選ぶ場面の説明（怨霊・幻影兵・召喚したときの効果など）
const REACTION_TEXT: Record<'damage' | 'summon' | 'heal' | 'debuff', (amount: number, row?: Row) => string> = {
  damage: (amount, row) => `${amount}ダメージを与える相手の${row === 'backRow' ? '後衛の' : ''}モンスターを選んでください。`,
  summon: () => '場に出す自分の空きスロットを選んでください。',
  heal: amount => `HP を${amount}回復する自分のモンスターを選んでください。`,
  debuff: amount => `FA・BA を${amount}下げる相手のモンスターを選んでください。`,
};

// 墓地や相手の手札から選ぶ場面の説明
const PICK_TEXT: Record<'graveyard' | 'opponentHand' | 'graveyardSummon', (maxCost?: number, race?: string) => string> = {
  graveyard: () => '手札に戻す墓地のモンスターを選んでください。',
  opponentHand: () => '相手の手札です。捨てさせるスペルを選んでください。',
  graveyardSummon: (maxCost, race) => `場に出す墓地のコスト${maxCost}以下の${race ?? ''}モンスターを選んでください。`,
};

const samePosition = (a: FieldPosition, b: FieldPosition) => a.row === b.row && a.index === b.index;

interface GameBoardProps {
  deck?: DeckList; // プレイヤーが使うデッキ（なければ自動のデッキ）
  initialState?: GameState; // 中断した対戦を再開するときの状態
  onStateChange?: (state: GameState) => void; // 状態が変わるたびに呼ばれる（途中経過の保存用）
  onExit?: () => void; // メニューへ戻る
}

const GameBoard: React.FC<GameBoardProps> = ({ deck, initialState, onStateChange, onExit }) => {
  const [gameState, setGameState] = useState<GameState>(() => initialState ?? createInitialGameState(deck));
  const [selection, setSelection] = useState<Selection>(NO_SELECTION);
  const [hovered, setHovered] = useState<InspectTarget | null>(null); // マウスを乗せているカード
  const { message, showMessage, clearMessage } = useTimedMessage(MESSAGE_DURATION_MS);

  const { players, turn, phase, currentPlayer, winner, turnState } = gameState;
  const isPlayerTurn = currentPlayer === HUMAN && !winner;
  const selectedFieldPosition = selection.kind === 'none' || selection.kind === 'hand' || selection.kind === 'supply' ? null : selection.from;
  // 自分のターンで行動済みのモンスター（攻撃済み・移動済み）は薄く表示する
  const usedLabels: Record<string, string> = {};
  if (isPlayerTurn && phase === 'Play' && turnState.movedMonsterId) usedLabels[turnState.movedMonsterId] = '移動済み';
  if (isPlayerTurn && phase === 'Play') {
    gameState.moveLocks.filter(lock => lock.player === HUMAN).forEach(lock => { usedLabels[lock.cardId] = '移動不可'; });
  }
  if (isPlayerTurn && phase === 'Attack') {
    // これ以上攻撃できない（2回攻撃できるモンスターは2回攻撃した）モンスター
    getMonsterPositions(gameState, HUMAN).forEach(position => {
      const card = getCardAt(gameState, HUMAN, position);
      if (card && turnState.attackedMonsterIds.includes(card.id) && getAttackError(gameState, HUMAN, position)) usedLabels[card.id] = '攻撃済み';
    });
  }
  if (selection.kind === 'supply') {
    selection.positions.forEach(position => {
      const card = getCardAt(gameState, HUMAN, position);
      if (card) usedLabels[card.id] = '墓地へ';
    });
  }

  // 籠城の効果（大将が受けるダメージを減らす）
  const guardOf = (player: PlayerId): string | undefined => {
    const amount = gameState.leaderGuards.filter(g => g.player === player).reduce((sum, g) => sum + g.amount, 0);
    return amount > 0 ? `籠城 ダメージ -${amount}` : undefined;
  };
  // 手札のモンスターの召喚コスト（伏兵の効果で下がる）
  const handCosts = players[HUMAN].hand.map(card => (isMonster(card) ? getSummonCost(gameState, HUMAN, card) : getSpellCost(gameState, card)));

  // 大将カードの効果が働いていないときのラベル
  const leaderStatusOf = (player: PlayerId): string | undefined => {
    if (!isLeaderActive(gameState, player)) return '効果停止中';
    return players[player].leaderAbilityUsed ? '効果使用済み' : undefined;
  };

  // 大将カードの効果で上がっている HP（両方のプレイヤーの場のモンスター）
  const hpBonusesOf = (owner: PlayerId): Record<string, number> => {
    const bonuses: Record<string, number> = {};
    getMonsterPositions(gameState, owner).forEach(position => {
      const card = getCardAt(gameState, owner, position);
      const bonus = card ? getHpBonus(gameState, owner, card) : 0;
      if (card && bonus > 0) bonuses[card.id] = bonus;
    });
    return bonuses;
  };

  const canDirectAttack = isPlayerTurn && phase === 'Attack' && selection.kind === 'attacker' && selection.from.row === 'frontRow' && !hasFrontRowMonsters(players[AI]);

  // カード情報欄：マウスを乗せているカード、なければ選択中のカード
  const selectedTarget = ((): InspectTarget | null => {
    if (selection.kind === 'hand' || selection.kind === 'supply') {
      const card = players[HUMAN].hand[selection.index];
      return card ? { kind: 'card', card } : null;
    }
    if (selection.kind === 'none') return null;
    const card = getCardAt(gameState, HUMAN, selection.from);
    return card ? { kind: 'card', card, row: selection.from.row } : null;
  })();
  const previewTarget = hovered ?? selectedTarget;

  useAutoProgress(gameState, setGameState, AI);

  useEffect(() => {
    onStateChange?.(gameState);
  }, [gameState, onStateChange]);

  // フェイズやターンが変わったら選択を解除
  useEffect(() => setSelection(NO_SELECTION), [phase, turn]);

  // ルール違反ならメッセージを表示し、成功なら state を更新して選択を解除する
  const apply = (result: ActionResult) => {
    if (!result.ok) {
      showMessage(result.error);
      return;
    }
    setGameState(result.state);
    setSelection(NO_SELECTION);
  };

  const handleRestart = () => {
    setGameState(createInitialGameState(deck));
    setSelection(NO_SELECTION);
    setHovered(null);
    clearMessage();
  };

  // 手札のカードを選択（もう一度クリックで解除）
  // 「引いて捨てる」効果で、墓地に置くカードを選んでいるところ
  const pendingDiscard = gameState.pendingDiscard?.player === HUMAN ? gameState.pendingDiscard : null;
  const [discardIndices, setDiscardIndices] = useState<number[]>([]);
  useEffect(() => setDiscardIndices([]), [pendingDiscard]);

  const handleConfirmDiscard = () => {
    const result = discardCards(gameState, HUMAN, discardIndices);
    if (!result.ok) {
      showMessage(result.error);
      return;
    }
    setGameState(result.state);
  };

  // モンスターの効果で、コストなしで使うスペルを選んでいるところ
  const pendingFreeSpell = gameState.pendingFreeSpell?.player === HUMAN ? gameState.pendingFreeSpell : null;
  const pendingFreeSummon = gameState.pendingFreeSummon?.player === HUMAN ? gameState.pendingFreeSummon : null;
  const pendingPick = gameState.pendingPick?.player === HUMAN ? gameState.pendingPick : null;
  const pendingReaction = gameState.pendingReaction?.player === HUMAN ? gameState.pendingReaction : null;
  const leaderAbility = players[HUMAN].leader.ability;

  // 選んだ手札が、対象を選ばずに使うスペルなら「使う」ボタンを出す
  const selectedHandCard = selection.kind === 'hand' ? players[HUMAN].hand[selection.index] : undefined;
  const untargetedSpell = selectedHandCard && !isMonster(selectedHandCard) && isUntargetedSpell(selectedHandCard) ? selectedHandCard : null;

  const handleHandCardClick = (index: number) => {
    if (pendingDiscard) {
      setDiscardIndices(current => current.includes(index)
        ? current.filter(i => i !== index)
        : current.length < pendingDiscard.count ? [...current, index] : current);
      return;
    }
    if (!isPlayerTurn || phase !== 'Play') return;
    const card = players[HUMAN].hand[index];
    if ((selection.kind === 'hand' || selection.kind === 'supply') && selection.index === index) setSelection(NO_SELECTION);
    else if (card && !isMonster(card) && card.effect.kind === 'supplyLine') setSelection({ kind: 'supply', index, positions: [] });
    else setSelection({ kind: 'hand', index });
  };

  // 移動させるモンスターを選択
  const selectMoveSource = (position: FieldPosition) => {
    const card = getCardAt(gameState, HUMAN, position);
    if (!card) return;
    if (canCommand(gameState, HUMAN, position) || canBoost(gameState, HUMAN, position)) {
      setSelection({ kind: 'move', from: position }); // 指揮・力を溜めるモンスターは、移動できなくても選べる
    } else if (turnState.summonedThisTurnIds.includes(card.id)) {
      showMessage('このモンスターは召喚されたターンには移動できません。');
    } else if (turnState.movedMonsterId) {
      showMessage('モンスターの移動は1ターンに1回までです。');
    } else {
      setSelection({ kind: 'move', from: position });
    }
  };

  const handlePlayPhaseClick = (position: FieldPosition) => {
    const clickedCard = getCardAt(gameState, HUMAN, position);

    if (selection.kind === 'supply') {
      // 補給線：自分の後衛のモンスターを選ぶ／外す
      if (!clickedCard || position.row !== 'backRow') {
        showMessage('墓地に送る自分の後衛のモンスターを選んでください。');
        return;
      }
      const chosen = selection.positions.some(p => samePosition(p, position));
      setSelection({ ...selection, positions: chosen ? selection.positions.filter(p => !samePosition(p, position)) : [...selection.positions, position] });
      return;
    }

    if (selection.kind === 'hand') {
      const selectedCard = players[HUMAN].hand[selection.index];
      if (selection.payBySacrifice) apply(playCard(gameState, HUMAN, selection.index, position, { payBySacrifice: true }));
      else if (!clickedCard) apply(playCard(gameState, HUMAN, selection.index, position, { payByDiscard: selection.payByDiscard }));
      else if (selectedCard && !isMonster(selectedCard)) apply(castSpell(gameState, HUMAN, selection.index, position));
      else selectMoveSource(position);
      return;
    }

    if (selection.kind === 'command') {
      if (clickedCard && !samePosition(selection.from, position)) apply(commandMonster(gameState, HUMAN, selection.from, position));
      else setSelection(NO_SELECTION);
      return;
    }

    if (selection.kind === 'move') {
      if (clickedCard) {
        if (samePosition(selection.from, position)) setSelection(NO_SELECTION);
        else selectMoveSource(position);
      } else if (selection.from.row === position.row) {
        setSelection(NO_SELECTION); // 同じ列の空きスロットをクリックしたら取り消し
      } else {
        apply(moveMonster(gameState, HUMAN, selection.from, position));
      }
      return;
    }

    selectMoveSource(position);
  };

  // 攻撃する。槍兵で相手の後衛が2体以上いるときは、追加ダメージの対象を選んでから攻撃する
  const startAttack = (from: FieldPosition, target: AttackTarget) => {
    if (needsPierceTarget(gameState, HUMAN, from)) setSelection({ kind: 'pierce', from, target });
    else apply(attack(gameState, HUMAN, from, target));
  };

  const handleAttackPhaseClick = (player: PlayerId, position: FieldPosition) => {
    const clickedCard = getCardAt(gameState, player, position);
    if (selection.kind === 'pierce') {
      if (player === AI && clickedCard && position.row === 'backRow') apply(attack(gameState, HUMAN, selection.from, selection.target, position));
      else showMessage('追加で1ダメージを与える相手の後衛のモンスターを選んでください。');
      return;
    }
    if (player === HUMAN && clickedCard) {
      if (selection.kind === 'attacker' && samePosition(selection.from, position)) {
        setSelection(NO_SELECTION);
      } else if (getAttackError(gameState, HUMAN, position)) {
        showMessage(getAttackError(gameState, HUMAN, position) as string);
      } else {
        setSelection({ kind: 'attacker', from: position });
      }
    } else if (player === AI && clickedCard && selection.kind === 'attacker') {
      startAttack(selection.from, { type: 'monster', position });
    } else {
      setSelection(NO_SELECTION);
    }
  };

  // 相手のモンスターを対象にするスペル（炎の呪文など）
  const handleEnemyTargetSpell = (position: FieldPosition) => {
    if (selection.kind !== 'hand') return;
    const selectedCard = players[HUMAN].hand[selection.index];
    if (!selectedCard || isMonster(selectedCard) || getSpellTargetSide(selectedCard) !== 'enemy') return;
    apply(castSpell(gameState, HUMAN, selection.index, position));
  };

  const handleFieldClick = (player: PlayerId, row: Row, index: number) => {
    // 捨てられた怨霊・幻影兵の対象選び（相手のターン中でも選ぶ）
    if (pendingReaction) {
      const expected = pendingReaction.kind === 'damage' || pendingReaction.kind === 'debuff' ? AI : HUMAN;
      if (player === expected) apply(resolveReaction(gameState, HUMAN, { row, index }));
      else showMessage(expected === AI ? '相手のモンスターを選んでください。' : pendingReaction.kind === 'heal' ? '自分のモンスターを選んでください。' : '自分の空いているスロットを選んでください。');
      return;
    }
    if (!isPlayerTurn) return;
    if (pendingDiscard) {
      showMessage(`先に、墓地に置くカードを${pendingDiscard.count}枚選んでください。`);
      return;
    }
    const position = { row, index };
    if (phase === 'Attack') handleAttackPhaseClick(player, position);
    else if (phase === 'Play' && player === HUMAN) handlePlayPhaseClick(position);
    else if (phase === 'Play' && player === AI) handleEnemyTargetSpell(position);
  };

  // 相手の大将カードをクリック（ダイレクトアタック）
  const handleOpponentLeaderClick = () => {
    if (!isPlayerTurn || phase !== 'Attack' || selection.kind !== 'attacker') return;
    startAttack(selection.from, { type: 'player' });
  };

  if (winner) {
    return (
      <div className="game-over-message">
        {winner === HUMAN ? 'あなたの勝利！' : '相手の勝利…'}
        <div className="game-over-actions">
          <button onClick={handleRestart} className="primary-button">もう一度遊ぶ</button>
          {onExit && <button onClick={onExit} className="secondary-button">メニューへ戻る</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="game-board">
      <aside className="info-panel">
        <h2 className="panel-title">カード情報</h2>
        <div className="card-info">
          <CardPreview target={previewTarget} />
        </div>
        {untargetedSpell && selection.kind === 'hand' && !pendingDiscard && (
          <button type="button" className="primary-button cast-button" onClick={() => apply(castSpell(gameState, HUMAN, selection.index))}>
            「{untargetedSpell.name}」を使う
          </button>
        )}
        {pendingFreeSpell && !pendingDiscard && (
          <div className="discard-panel" role="alert">
            <p>「{pendingFreeSpell.source}」の効果：手札のコスト{pendingFreeSpell.maxCost}以下のスペルを1枚、<b>コストを払わずに</b>使えます。</p>
            <button type="button" className="secondary-button" onClick={() => apply(skipFreeSpell(gameState, HUMAN))}>
              使わない
            </button>
          </div>
        )}
        {selection.kind === 'move' && canCommand(gameState, HUMAN, selection.from) && (
          <button type="button" className="primary-button cast-button" onClick={() => setSelection({ kind: 'command', from: selection.from })}>
            指揮する（前衛の味方1体の FA を上げる）
          </button>
        )}
        {selection.kind === 'move' && canBoost(gameState, HUMAN, selection.from) && (() => {
          const ability = getCardAt(gameState, HUMAN, selection.from)?.ability;
          if (ability?.kind !== 'selfBoost') return null;
          const price = [ability.energy > 0 && `エネルギー${ability.energy}`, ability.hp > 0 && `HP${ability.hp}`].filter(Boolean).join('・');
          return (
            <button type="button" className="primary-button cast-button" onClick={() => apply(boostMonster(gameState, HUMAN, selection.from))}>
              力を溜める（{price}を払って FA +{ability.fa}・BA +{ability.ba}）
            </button>
          );
        })()}
        {selectedHandCard && isMonster(selectedHandCard) && selectedHandCard.ability?.kind === 'fusionSummon' && selection.kind === 'hand' && !selection.payBySacrifice && (
          <button type="button" className="secondary-button cast-button" onClick={() => setSelection({ ...selection, payBySacrifice: true })}>
            {selectedHandCard.ability.race}を{selectedHandCard.ability.count}体墓地に送って召喚する（エネルギー不要）
          </button>
        )}
        {selection.kind === 'hand' && selection.payBySacrifice && (
          <div className="discard-panel" role="status">
            <p>召喚するスロットを選んでください（空きスロット、または合体させる仲間のいるスロット）。コストと HP の低い仲間から墓地に送ります。</p>
          </div>
        )}
        {selectedHandCard && isMonster(selectedHandCard) && selectedHandCard.ability?.kind === 'discardSummon' && selection.kind === 'hand' && !selection.payByDiscard && (
          <button type="button" className="secondary-button cast-button" onClick={() => setSelection({ ...selection, payByDiscard: true })}>
            手札を{selectedHandCard.ability.amount}枚捨てて召喚する（エネルギー不要）
          </button>
        )}
        {selection.kind === 'hand' && selection.payByDiscard && (
          <div className="discard-panel" role="status">
            <p>召喚する<b>空きスロット</b>を選んでください。召喚したあと、捨てる手札を選びます。</p>
          </div>
        )}
        {selection.kind === 'supply' && (
          <div className="discard-panel" role="status">
            <p>墓地に送る<b>自分の後衛のモンスター</b>を選んでください（{selection.positions.length}体）。</p>
            <button
              type="button"
              className="primary-button"
              disabled={selection.positions.length === 0}
              onClick={() => apply(castSpell(gameState, HUMAN, selection.index, undefined, selection.positions))}
            >
              使う（{selection.positions.length}枚引く）
            </button>
          </div>
        )}
        {pendingReaction && (
          <div className="discard-panel" role="alert">
            <p>「{pendingReaction.card.name}」の効果：{REACTION_TEXT[pendingReaction.kind](pendingReaction.amount, pendingReaction.row)}</p>
          </div>
        )}
        {pendingFreeSummon && (
          <div className="discard-panel" role="alert">
            <p>「{pendingFreeSummon.source}」の効果：手札のコスト{pendingFreeSummon.maxCost}以下のモンスターを1体、<b>コストを払わずに</b>{pendingFreeSummon.row === 'frontRow' ? '前衛に' : ''}召喚できます。</p>
            <button type="button" className="secondary-button" onClick={() => apply(skipFreeSummon(gameState, HUMAN))}>召喚しない</button>
          </div>
        )}
        {selection.kind === 'pierce' && (
          <div className="discard-panel" role="status">
            <p>槍兵の効果：追加で1ダメージを与える<b>相手の後衛のモンスター</b>を選んでください。</p>
            <button type="button" className="secondary-button" onClick={() => setSelection(NO_SELECTION)}>攻撃をやめる</button>
          </div>
        )}
        {selection.kind === 'command' && (
          <div className="discard-panel" role="status">
            <p>FA を上げる<b>前衛の味方</b>を選んでください。</p>
            <button type="button" className="secondary-button" onClick={() => setSelection(NO_SELECTION)}>やめる</button>
          </div>
        )}
        {leaderAbility?.kind === 'rallyEnergy' && canUseLeaderAbility(gameState, HUMAN) && (
          <button type="button" className="primary-button cast-button" onClick={() => apply(activateLeaderAbility(gameState, HUMAN))}>
            大将の効果を使う（エネルギー +{leaderAbility.amount}）
          </button>
        )}
        {pendingDiscard && (
          <div className="discard-panel" role="alert">
            <p>手札から墓地に置くカードを<b>{pendingDiscard.count}枚</b>選んでください（{discardIndices.length} / {pendingDiscard.count}）。</p>
            {pendingDiscard.then?.kind === 'damage' && <p>捨てたカードのコスト＋{pendingDiscard.then.bonus}のダメージを与えます。</p>}
            {pendingDiscard.then?.kind === 'draw' && <p>捨てたあと、カードを{pendingDiscard.then.amount}枚引きます。</p>}
            <button
              type="button"
              className="primary-button"
              onClick={handleConfirmDiscard}
              disabled={discardIndices.length !== pendingDiscard.count}
            >
              墓地に置く
            </button>
          </div>
        )}
        <div className="message-area" role="status">
          {message && <div key={message.id} className="message">{message.text}</div>}
        </div>
      </aside>
      <div className="main-area">
        <PlayerArea
          playerState={players[AI]}
          isOpponent
          onSlotClick={(row, index) => handleFieldClick(AI, row, index)}
          onLeaderClick={handleOpponentLeaderClick}
          isLeaderTargetable={canDirectAttack}
          onInspect={setHovered}
          hpBonuses={hpBonusesOf(AI)}
          leaderStatus={leaderStatusOf(AI)}
          leaderBadge={guardOf(AI)}
        />
        <div className="front-line" aria-hidden="true"><span>前線</span></div>
        <PlayerArea
          playerState={players[HUMAN]}
          isOpponent={false}
          onSlotClick={(row, index) => handleFieldClick(HUMAN, row, index)}
          onHandCardClick={handleHandCardClick}
          onInspect={setHovered}
          selectedCardIndex={selection.kind === 'hand' ? selection.index : null}
          selectedPosition={selectedFieldPosition}
          usedLabels={usedLabels}
          markedHandIndices={discardIndices}
          hpBonuses={hpBonusesOf(HUMAN)}
          leaderStatus={leaderStatusOf(HUMAN)}
          leaderBadge={guardOf(HUMAN)}
          handCosts={handCosts}
        />
      </div>
      {pendingPick && (
        <PickDialog
          title={pendingPick.source}
          message={PICK_TEXT[pendingPick.kind](pendingPick.maxCost, pendingPick.race)}
          cards={pendingPick.kind === 'opponentHand' ? players[AI].hand : players[HUMAN].graveyard}
          isPickable={card => {
            if (pendingPick.kind === 'opponentHand') return !isMonster(card);
            if (pendingPick.kind === 'graveyard') return isMonster(card);
            return isMonster(card) && card.cost <= (pendingPick.maxCost ?? 0) && (!pendingPick.race || card.race === pendingPick.race);
          }}
          onPick={index => apply(pickCard(gameState, HUMAN, index))}
          onSkip={pendingPick.kind === 'graveyardSummon' || (pendingPick.kind === 'opponentHand' && players[AI].hand.every(isMonster))
            ? () => apply(pickCard(gameState, HUMAN, null))
            : undefined}
          skipLabel={pendingPick.kind === 'graveyardSummon' ? '出さない' : undefined}
        />
      )}
      <ControlPanel
        turn={turn}
        phase={phase}
        isPlayerTurn={isPlayerTurn}
        canAttack={canAttackThisTurn(gameState)}
        isBusy={!!pendingDiscard || !!pendingFreeSpell || !!pendingFreeSummon || !!pendingPick || !!gameState.pendingReaction}
        onNextPhase={() => setGameState(nextPhase)}
        onEndTurn={() => setGameState(endTurn)}
        onExit={onExit}
      />
    </div>
  );
};

export default GameBoard;
