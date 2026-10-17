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
  isDisabled?: boolean; // このターンの間、効果がなくなっているとき
}

// 大将カード。大将ゾーンに置かれ、HPと固有の効果を持つ
const LeaderCard: React.FC<LeaderCardProps> = ({ leader, hp, onClick, isTargetable = false, size = 'normal', isDisabled = false, onMouseEnter, onMouseLeave }) => (
  <div
    className={`leader-card ${size} ${isTargetable ? 'targetable' : ''} ${isDisabled ? 'disabled' : ''}`}
    onClick={onClick}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
  >
    <div className="leader-header">
      <span className="leader-badge">大将</span>
      <span className="card-name">{leader.name}</span>
    </div>
    {isDisabled && <div className="card-used-label leader-disabled-label">効果停止中</div>}
    <CardArt image={leader.image} label="イラスト">
      <div className={`leader-hp ${hp < leader.maxHp ? 'damaged' : ''}`}>
        HP {hp}<span className="leader-hp-max"> / {leader.maxHp}</span>
      </div>
    </CardArt>
    <div className="card-description">{leader.description}</div>
  </div>
);

export default LeaderCard;
