import React from 'react';
import '../styles/EnergyZone.css';

interface EnergyZoneProps {
  currentEnergy: number;
  maxEnergy: number;
  className?: string; // classNameプロパティを追加
}

const EnergyZone: React.FC<EnergyZoneProps> = ({ currentEnergy, maxEnergy, className }) => {
  const energyCircles = [];
  for (let i = 0; i < maxEnergy; i++) {
    energyCircles.push(
      <div key={i} className={`energy-circle ${i < currentEnergy ? 'filled' : ''}`}></div>
    );
  }

  return (
    <div className={`energy-zone ${className || ''}`}>
      {energyCircles}
    </div>
  );
};

export default EnergyZone;