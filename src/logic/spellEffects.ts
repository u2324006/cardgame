import { SpellEffect } from '../types/card';

// スペルの効果の文章（実装済みの効果は、カードに表示し、対戦でもこのとおりに動く）

// 効果の説明文。まだない効果は空
export const describeEffect = (effect: SpellEffect): string => {
  switch (effect.kind) {
    case 'damage': return `相手のモンスター1体に${effect.amount}ダメージを与える。`;
    case 'heal': return `味方モンスター1体のHPを${effect.amount}回復する（最大HPまで）。`;
    case 'buffFa': return `味方モンスター1体のFAを、ターン終了まで${effect.amount}上げる。`;
    case 'buffBa': return `味方モンスター1体のBAを、ターン終了まで${effect.amount}上げる。`;
    case 'drawDiscard': return `カードを${effect.amount}枚引き、その後手札から${effect.amount}枚を選んで墓地に置く。`;
    case 'disableLeader': return 'このターンの間、相手の大将カードの効果をなくす。';
    case 'damageBack': return `相手の後衛のモンスター1体に${effect.amount}ダメージを与える。`;
    case 'forceMove': return '相手のモンスター1体を反対の列へ移動させる。相手は次のターン、そのモンスターを移動できない。';
    case 'catchUpEnergy': return '相手のモンスターの数が自分より多いとき、その差だけエネルギーを増やす。';
    case 'damageFrontAll': return `相手の前衛のモンスターすべてに${effect.amount}ダメージを与える。`;
    case 'volley': return `相手の前衛のモンスター1体に、自分の後衛にいるモンスターの数×${effect.amount}ダメージを与える。`;
    case 'retreat': return `自分の前衛のモンスター1体を後衛へ下げ、HPを${effect.amount}回復する（移動の回数を使わない）。`;
    case 'swapColumn': return '自分のモンスター1体がいる位置の、前衛と後衛のモンスターを入れ替える（移動の回数を使わない）。';
    case 'pullForward': return '相手の後衛のモンスター1体を同じ位置の前衛へ移動させる（前衛にモンスターがいれば入れ替える）。移動したモンスターは次のターン移動できない。';
    case 'lastStand': return `自分の場のモンスターが相手より少ないとき、このターン自分の全モンスターのFA・BAを${effect.amount}上げる。`;
    case 'guardLeader': return `次の相手のターン、自分の大将が受けるダメージを1回につき${effect.amount}減らす。`;
    case 'freeSummon': return `手札のコスト${effect.amount}以下のモンスター1体を、コストを払わずに前衛に召喚する。`;
    case 'spellDiscount': return `このターン、次に使うスペルのコストを${effect.amount}下げる。`;
    case 'summonDiscount': return `自分の場のモンスターが相手より少ないとき、このターン次に召喚するモンスターのコストを${effect.amount}下げる。`;
    case 'sacrificeSummon': return `自分のモンスター1体を墓地に置き、手札のコスト${effect.amount}以下のモンスター1体をコストを払わずに召喚する。`;
    case 'delayedEnergy': return `次の自分のターン開始時、エネルギーを${effect.amount}増やす。`;
    case 'discardForEnergy': return `手札を${effect.amount}枚捨て、エネルギーを${effect.amount}増やす。`;
    case 'raiseMaxEnergy': return `エネルギーの上限を${effect.amount}上げる（最大12）。`;
    case 'drainEnergy': return `相手のエネルギーを${effect.amount}減らし、自分のエネルギーを1増やす。`;
    case 'lifeToEnergy': return `自分の大将のHPを3減らし、エネルギーを${effect.amount}増やす。`;
    case 'sacrificeForEnergy': return '自分のモンスター1体を墓地に置き、そのコストぶんエネルギーを増やす。';
    case 'draw': return `カードを${effect.amount}枚引く。`;
    case 'supplyLine': return '自分の後衛のモンスターを好きな数だけ墓地に送り、その数だけカードを引く。';
    case 'spoils': return `このターン、最初に相手のモンスターを倒したとき、カードを${effect.amount}枚引く。`;
    case 'graveRob': return '自分の墓地のモンスター1体を手札に戻す。';
    case 'discardDraw': return `手札を1枚捨て、カードを${effect.amount}枚引く。`;
    case 'randomDiscard': return `相手の手札をランダムに${effect.amount}枚捨てさせる。`;
    case 'firebomb': return `手札を1枚捨て、相手のモンスター1体に「捨てたカードのコスト＋${effect.amount}」ダメージを与える。`;
    case 'reveal': return '相手の手札を見て、スペルを1枚選んで捨てさせる。';
    case 'reshuffle': return '手札をすべて捨て、同じ枚数のカードを引く。';
    case 'custom': return '';
  }
};

// 手札の小さいカードに出す効果の要約
export const summarizeEffect = (effect: SpellEffect): string => {
  switch (effect.kind) {
    case 'damage': return `${effect.amount}ダメージ`;
    case 'heal': return `HP +${effect.amount}`;
    case 'buffFa': return `FA +${effect.amount}`;
    case 'buffBa': return `BA +${effect.amount}`;
    case 'drawDiscard': return `${effect.amount}枚引いて${effect.amount}枚捨てる`;
    case 'disableLeader': return '大将の効果を消す';
    case 'damageBack': return `後衛に${effect.amount}ダメージ`;
    case 'forceMove': return '相手を移動';
    case 'catchUpEnergy': return '数の差だけエネルギー';
    case 'damageFrontAll': return `前衛すべてに${effect.amount}ダメージ`;
    case 'volley': return `後衛の数×${effect.amount}ダメージ`;
    case 'retreat': return `後衛へ下げてHP +${effect.amount}`;
    case 'swapColumn': return '前衛と後衛を入れ替え';
    case 'pullForward': return '相手の後衛を前衛へ';
    case 'lastStand': return `劣勢なら全員 +${effect.amount}`;
    case 'guardLeader': return `大将へのダメージ -${effect.amount}`;
    case 'freeSummon': return `コスト${effect.amount}以下を無料召喚`;
    case 'spellDiscount': return `次のスペル -${effect.amount}`;
    case 'summonDiscount': return `次の召喚 -${effect.amount}`;
    case 'sacrificeSummon': return '生贄で無料召喚';
    case 'delayedEnergy': return `次のターン +${effect.amount}`;
    case 'discardForEnergy': return `${effect.amount}枚捨てて +${effect.amount}`;
    case 'raiseMaxEnergy': return `上限 +${effect.amount}`;
    case 'drainEnergy': return `相手 -${effect.amount} / 自分 +1`;
    case 'lifeToEnergy': return `HP -3 / +${effect.amount}`;
    case 'sacrificeForEnergy': return 'コストぶん +';
    case 'draw': return `${effect.amount}枚引く`;
    case 'supplyLine': return '後衛を送って引く';
    case 'spoils': return `撃破で${effect.amount}枚引く`;
    case 'graveRob': return '墓地から回収';
    case 'discardDraw': return `1枚捨てて${effect.amount}枚引く`;
    case 'randomDiscard': return `相手が${effect.amount}枚捨てる`;
    case 'firebomb': return `捨てたコスト+${effect.amount}`;
    case 'reveal': return '手札を見て捨てさせる';
    case 'reshuffle': return '手札を引き直す';
    case 'custom': return '効果未実装';
  }
};
