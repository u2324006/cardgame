import React from 'react';
import '../styles/EnergyZone.css';

interface EnergyZoneProps {
  currentEnergy: number;
  maxEnergy: number;
}

const EnergyZone: React.FC<EnergyZoneProps> = ({ currentEnergy, maxEnergy }) => (
  <div className="energy-zone">
    <div className="energy-text">
      <span>エネルギー</span>
      <span><b>{currentEnergy}</b> / {maxEnergy}</span>
    </div>
    <div className="energy-pips" aria-hidden="true">
      {Array.from({ length: maxEnergy }, (_, i) => (
        <div key={i} className={`energy-pip ${i < currentEnergy ? 'filled' : ''}`}></div>
      ))}
    </div>
  </div>
);

export default EnergyZone;
