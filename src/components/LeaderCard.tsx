import React from 'react';
import { LeaderCard as LeaderCardType } from '../types/card';
import { CardArt, HoverHandlers } from './Card';
import '../styles/Card.css';

interface LeaderCardProps extends HoverHandlers {
  leader: LeaderCardType;
  hp: number;
  onClick?: () => void;
  isTargetable?: boolean; // 直接攻撃の対象としてクリックできるとき
  size?: 'normal' | 'large';
  statusLabel?: string; // 効果が働いていないとき（例: '効果停止中'・'効果使用済み'）。カードを暗くしてラベルを出す
  badge?: string; // かかっている効果（例: '籠城 ダメージ -2'）
}

// 大将カード。大将ゾーンに置かれ、HPと固有の効果を持つ
const LeaderCard: React.FC<LeaderCardProps> = ({ leader, hp, onClick, isTargetable = false, size = 'normal', statusLabel, badge, onMouseEnter, onMouseLeave }) => (
  <div
    className={`leader-card ${size} ${isTargetable ? 'targetable' : ''} ${statusLabel ? 'disabled' : ''}`}
    onClick={onClick}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
  >
    <div className="leader-header">
      <span className="leader-badge">大将</span>
      <span className="card-name">{leader.name}</span>
    </div>
    {statusLabel && <div className="card-used-label leader-disabled-label">{statusLabel}</div>}
    <CardArt image={leader.image} label="イラスト">
      {badge && <div className="leader-guard-badge">{badge}</div>}
      <div className={`leader-hp ${hp < leader.maxHp ? 'damaged' : ''}`}>
        HP {hp}<span className="leader-hp-max"> / {leader.maxHp}</span>
      </div>
    </CardArt>
    <div className="card-description">{leader.description}</div>
  </div>
);

export default LeaderCard;
