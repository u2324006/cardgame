import React from 'react';
import '../styles/EnergyZone.css';

interface EnergyZoneProps {
  currentEnergy: number;
  maxEnergy: number;
}

const EnergyZone: React.FC<EnergyZoneProps> = ({ currentEnergy, maxEnergy }) => {
  const energyCircles = [];
  for (let i = 0; i < maxEnergy; i++) {
    energyCircles.push(
      <div key={i} className={`energy-circle ${i < currentEnergy ? 'filled' : ''}`}></div>
    );
  }

  return (
    <div className="energy-zone">
      {energyCircles}
    </div>
  );
};

export default EnergyZone;