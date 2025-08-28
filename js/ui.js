function renderCardDetails(card) {
  if (!card) {
    return `<h2>カード情報</h2><p>カードにカーソルを合わせると詳細が表示されます。</p>`;
  }

  const {
    id,
    name,
    type,
    description,
    frontAttack,
    backAttack,
    cardHp,
    race,
    cost,
  } = card;

  const monsterStats = type === 'Monster' ? `
    <div class="card-stats-bottom">
        <span>FA: ${frontAttack}</span>
        <span>BA: ${backAttack}</span>
    </div>
    ` : '';

  return `
    <div class="card-top-section">
        ${cardHp ? `<div class="card-hp">HP: ${cardHp}</div>` : ''}
        <div class="card-name">${name}</div>
        ${race ? `<div class="card-race">${race}</div>` : ''}
        <div class="card-cost-circle">
            <div class="card-cost-value">${cost}</div>
        </div>
    </div>
    <div class="card-image-area">
        <!-- Placeholder for image -->
    </div>
    <div class="card-description-area">
        ${description}
    </div>
    ${monsterStats}
  `;
}