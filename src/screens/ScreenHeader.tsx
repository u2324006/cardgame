import React from 'react';

interface ScreenHeaderProps {
  title: string;
  onBack: () => void;
  children?: React.ReactNode; // 右側に置く要素
}

const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, onBack, children }) => (
  <header className="screen-header">
    <button type="button" className="back-button" onClick={onBack}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
      メニュー
    </button>
    <h1 className="screen-title">{title}</h1>
    <div className="screen-header-extra">{children}</div>
  </header>
);

export default ScreenHeader;
