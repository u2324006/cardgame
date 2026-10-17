import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import GameBoard from './GameBoard';

// ゲーム画面の基本的な流れを確認する（タイマーで進む自動進行は偽のタイマーで早送りする）
describe('GameBoard', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const advance = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

  it('hides the opponent hand and lets the AI take its turn', () => {
    const { container } = render(<GameBoard />);
    expect(container.querySelectorAll('.opponent-area .card-back')).toHaveLength(5);
    expect(container.querySelectorAll('.self-area .hand-container .card')).toHaveLength(5);

    advance(500); // 自分のドローフェイズは自動で進む
    expect(screen.getByText('Play フェイズ')).toBeTruthy();
    expect(container.querySelectorAll('.self-area .hand-container .card')).toHaveLength(6);

    fireEvent.click(screen.getByText('ターン終了'));
    expect(screen.getByText('相手のターン')).toBeTruthy();

    // AI のドロー → Play → Attack（各段階は再描画後に次のタイマーが設定される）
    advance(1000);
    advance(1000);
    advance(1000);
    advance(500); // 自分のドロー
    expect(screen.getByText('あなたのターン')).toBeTruthy();
    expect(screen.getByText('ターン 3')).toBeTruthy();
  });

  it('shows rule violations on screen instead of an alert', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0); // シャッフル結果を固定する
    const { container } = render(<GameBoard />);
    advance(500);
    // 2コストのカードは1エネルギーでは召喚できない
    const handCards = Array.from(container.querySelectorAll('.self-area .hand-container .card'));
    const expensive = handCards.find(card => card.querySelector('.card-cost-value')?.textContent === '2' && card.classList.contains('monster'));
    expect(expensive).toBeDefined();
    fireEvent.click(expensive!);
    fireEvent.click(container.querySelector('.self-area .front-row .card-slot')!);
    expect(screen.getByRole('status').textContent).toBe('エネルギーが足りません！');

    advance(3000);
    expect(screen.getByRole('status').textContent).toBe('');
  });
});
