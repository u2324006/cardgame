import React from 'react';
import '../styles/EnergyZone.css';

interface EnergyZoneProps {
  currentEnergy: number;
  maxEnergy: number;
  className?: string;
}

const EnergyZone: React.FC<EnergyZoneProps> = ({ currentEnergy, maxEnergy, className = '' }) => (
  <div className={`energy-zone ${className}`} title={`エネルギー ${currentEnergy} / ${maxEnergy}`}>
    {Array.from({ length: maxEnergy }, (_, i) => (
      <div key={i} className={`energy-circle ${i < currentEnergy ? 'filled' : ''}`}></div>
    ))}
  </div>
);

export default EnergyZone;
