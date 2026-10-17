import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';

describe('App navigation', () => {
  beforeEach(() => window.localStorage.clear());

  it('opens each screen from the menu and returns', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /カード一覧/ }));
    expect(screen.getByRole('heading', { name: 'カード一覧' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /メニュー/ }));

    fireEvent.click(screen.getByRole('button', { name: /デッキ作成/ }));
    expect(screen.getByRole('heading', { name: 'デッキ作成' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /メニュー/ }));

    fireEvent.click(screen.getByRole('button', { name: /対戦/ }));
    expect(screen.getByText('カード情報')).toBeTruthy();
  });

  it('saves an edited deck and uses it from the menu', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /デッキ作成/ }));
    fireEvent.click(screen.getByRole('button', { name: '次へ：カードを選ぶ' }));
    fireEvent.click(screen.getByRole('button', { name: 'すべて外す' }));
    expect(screen.getByRole('button', { name: '保存する' })).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('button', { name: '残りを自動で埋める' }));
    fireEvent.click(screen.getByRole('button', { name: '保存する' }));
    expect(screen.getByText('デッキを保存しました。')).toBeTruthy();
    expect(window.localStorage.getItem('cardgame.deck')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /メニュー/ }));
    expect(screen.getByText(/使用するデッキ：保存したデッキ/)).toBeTruthy();
  });
});
