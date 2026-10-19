# カードデータ（AI への引き継ぎ用）

ゲーム内の「カード作成」で作成・変更したカードを、カテゴリごとに保存するフォルダです。
ここに置いたカードは、ゲームの「最初から入っているカード」として読み込まれます
（`src/logic/builtinCards.ts` のカードと同じ ID なら、こちらで置き換わります）。

| ファイル | カテゴリ |
|---|---|
| `monsters.json` | モンスター（場に出して戦うカード） |
| `spells.json` | スペル（使い切りの効果カード） |
| `leaders.json` | 大将（大将ゾーンに置くカード） |

## 取り込み方

1. ゲームの「カード作成」→「書き出し・読み込み」で、カテゴリを選んで「コピーする」。
2. コピーした JSON を、上の表のファイルに貼り付ける（同じ ID のカードは置き換え、新しいカードは配列に追加）。
3. `npm test` を実行する（ファイルの形が正しいかのテストがあります）。

## 項目

### 全カテゴリ共通

| 項目 | 内容 |
|---|---|
| `id` | カードの識別子。英数字と `_` だけ（`-` は使わない） |
| `name` | カード名 |
| `race` | 種族 |
| `effectText` | **効果を文章で書いたもの。AI に実装してもらう内容**。なければ空 |
| `flavorText` | 雰囲気の文。ルールには関係しない |
| `illustration.prompt` | **イラストのイメージを文章で書いたもの。AI に絵を作ってもらうための説明** |
| `illustration.image` | 今使っている画像。用意されたイラストはファイル名（`public/images/cards/` にある）、アップロードした画像は `data:` で始まる文字列、なければ空 |
| `implementation` | 効果の実装状況：`未実装`／`実装済み`／`効果なし` |
| `memo` | 調整のメモなど |
| `updatedAt` | 最後に保存・取り込みした日時（ISO 形式、省略可）。ブラウザに保存されたカードと同じ ID なら、新しい方が使われる |

### モンスターだけ

| 項目 | 内容 |
|---|---|
| `cost` | コスト |
| `frontAttack` | FA（前衛にいるときの攻撃力） |
| `backAttack` | BA（後衛にいるときの攻撃力） |
| `hp` | HP |
| `effect` | 実装済みの効果。まだなければ `null`（省略可） |

モンスターの効果の種類（`kind`）：

| kind | 内容 | 例 |
|---|---|---|
| `freeSpellOnSummon` | 召喚したとき、手札のコスト maxCost 以下のスペルを1枚、コストを払わずに使える | `{ "kind": "freeSpellOnSummon", "maxCost": 1 }` |
| `sniper` | 後衛にいるとき、相手の前衛にモンスターがいても相手の後衛を攻撃できる | `{ "kind": "sniper" }` |
| `pierce` | 前衛から攻撃したとき、相手の後衛のモンスター1体（プレイヤーが選ぶ。AI は一番 HP が低いもの）にも amount ダメージ | `{ "kind": "pierce", "amount": 1 }` |
| `frontGuard` | 前衛にいるとき、受けるダメージを amount 減らす | `{ "kind": "frontGuard", "amount": 1 }` |
| `medic` | 後衛にいるとき、自分のターン終了時に同じ位置の前衛の味方の HP を amount 回復 | `{ "kind": "medic", "amount": 2 }` |
| `commander` | 後衛にいるとき、1ターンに1回、前衛の味方1体の FA をそのターンだけ amount 上げる | `{ "kind": "commander", "amount": 1 }` |
| `charge` | 後衛から前衛へ移動したターン、FA が amount 上がる | `{ "kind": "charge", "amount": 2 }` |
| `rearguard` | 前衛で攻撃されて倒されたとき、攻撃したモンスターに amount ダメージ | `{ "kind": "rearguard", "amount": 3 }` |
| `ambush` | 相手の場のモンスターが自分より多いとき、コストが amount 下がる | `{ "kind": "ambush", "amount": 1 }` |
| `freeSummonOnSummon` | 召喚したとき、手札のコスト maxCost 以下のモンスターを1体コストなしで召喚できる | `{ "kind": "freeSummonOnSummon", "maxCost": 2 }` |
| `discardSummon` | 手札を amount 枚捨てれば、エネルギーを払わずに召喚できる | `{ "kind": "discardSummon", "amount": 2 }` |
| `spellDiscountOnSummon` | 召喚したとき、このターン次に使うスペルのコスト −amount | `{ "kind": "spellDiscountOnSummon", "amount": 1 }` |
| `energyNextTurnFromBack` | 後衛に召喚したとき、次の自分のターン開始時にエネルギー +amount（場に残っていれば） | `{ "kind": "energyNextTurnFromBack", "amount": 1 }` |
| `drawOnSummon` | 召喚したとき amount 枚引く | `{ "kind": "drawOnSummon", "amount": 1 }` |
| `drawOnFrontDeath` | 前衛で倒されたとき amount 枚引く | `{ "kind": "drawOnFrontDeath", "amount": 1 }` |
| `drawIfLowEnergy` | 後衛にいるとき、ターン終了時にエネルギーが threshold 以下なら amount 枚引く | `{ "kind": "drawIfLowEnergy", "amount": 1, "threshold": 1 }` |
| `discardOnSummon` | 召喚したとき、手札を amount 枚選んで捨てる | `{ "kind": "discardOnSummon", "amount": 1 }` |
| `damageWhenDiscarded` | 相手の効果で手札から捨てられたとき、持ち主が選んだ相手のモンスター1体に amount ダメージ | `{ "kind": "damageWhenDiscarded", "amount": 2 }` |
| `summonWhenDiscarded` | 相手の効果で手札から捨てられたとき、空きがあれば持ち主が選んだ空きスロットに出る | `{ "kind": "summonWhenDiscarded" }` |

### スペルだけ

| 項目 | 内容 |
|---|---|
| `cost` | コスト |
| `target` | 対象：`allyMonster`（味方のモンスター）、`enemyMonster`（相手のモンスター）、`anyMonster`（どちらかのモンスター）、`allyLeader`（自分の大将）、`enemyLeader`（相手の大将）、`none`（対象なし） |
| `effect` | 実装済みの効果：`{ "kind": 種類, "amount": 数値 }`。まだない効果なら `null`（対戦では使えない） |

実装済みの効果の種類（`kind`）：

| kind | 内容 | 対象 |
|---|---|---|
| `damage` | 相手のモンスター1体に amount ダメージ | 相手のモンスター |
| `heal` | 味方のモンスター1体の HP を amount 回復（最大 HP まで） | 味方のモンスター |
| `buffFa` | 味方のモンスター1体の FA をターン終了まで amount 上げる | 味方のモンスター |
| `buffBa` | 味方のモンスター1体の BA をターン終了まで amount 上げる | 味方のモンスター |
| `drawDiscard` | カードを amount 枚引き、その後手札から amount 枚を選んで墓地に置く | なし |
| `disableLeader` | このターンの間、相手の大将カードの効果をなくす（amount は使わないので 1） | 相手の大将 |
| `damageBack` | 相手の後衛のモンスター1体に amount ダメージ | 相手の後衛のモンスター |
| `forceMove` | 相手のモンスター1体を反対の列へ移動させ、相手の次のターンは移動できなくする（amount は 1） | 相手のモンスター |
| `catchUpEnergy` | 相手のモンスターが自分より多いぶん、エネルギーを増やす（amount は 1） | なし |
| `damageFrontAll` | 相手の前衛のモンスターすべてに amount ダメージ | なし |
| `volley` | 相手の前衛のモンスター1体に、自分の後衛のモンスターの数 × amount ダメージ | 相手の前衛のモンスター |
| `retreat` | 自分の前衛のモンスター1体を後衛へ下げ、HP を amount 回復 | 自分の前衛のモンスター |
| `swapColumn` | 自分のモンスターがいる位置の前衛と後衛を入れ替える（amount は 1） | 自分のモンスター |
| `pullForward` | 相手の後衛のモンスターを同じ位置の前衛へ（埋まっていれば入れ替え）。動いたモンスターは次のターン移動できない（amount は 1） | 相手の後衛のモンスター |
| `lastStand` | 自分のモンスターが相手より少ないとき、このターン全モンスターの FA・BA を amount 上げる | なし |
| `guardLeader` | 次の相手のターン、自分の大将が受けるダメージを1回につき amount 減らす | 自分の大将 |
| `freeSummon` | 手札のコスト amount 以下のモンスター1体をコストなしで前衛に召喚 | なし |
| `spellDiscount` | このターン次に使うスペルのコスト −amount | なし |
| `summonDiscount` | 劣勢のとき、このターン次に召喚するモンスターのコスト −amount | なし |
| `sacrificeSummon` | 自分のモンスターを墓地に置き、手札のコスト amount 以下のモンスターをコストなしで召喚 | 自分のモンスター |
| `delayedEnergy` | 次の自分のターン開始時にエネルギー +amount | なし |
| `discardForEnergy` | 手札を2枚捨て、エネルギー +amount | なし |
| `raiseMaxEnergy` | エネルギーの上限 +amount（最大 12） | なし |
| `drainEnergy` | 相手のエネルギー −amount、自分 +1 | なし |
| `lifeToEnergy` | 自分の大将の HP −5、エネルギー +amount | なし |
| `sacrificeForEnergy` | 自分のモンスターを墓地に置き、そのコストぶんエネルギー（amount は 1） | 自分のモンスター |
| `draw` | amount 枚引く | なし |
| `supplyLine` | 自分の後衛のモンスターを好きな数だけ墓地に送り、その数だけ引く（amount は 1） | 自分の後衛のモンスター（複数） |
| `spoils` | このターン最初に相手のモンスターを倒したとき amount 枚引く | なし |
| `graveRob` | 自分の墓地のモンスター1体を手札に戻す（amount は 1） | なし |
| `discardDraw` | 手札を1枚捨て、amount 枚引く | なし |
| `randomDiscard` | 相手の手札をランダムに amount 枚捨てさせる | なし |
| `firebomb` | 手札を1枚捨て、相手のモンスター1体に「捨てたカードのコスト + amount」ダメージ | 相手のモンスター |
| `reveal` | 相手の手札を見て、スペルを1枚選んで捨てさせる（amount は 1） | なし |
| `reshuffle` | 手札をすべて捨て、同じ枚数を引く（amount は 1） | なし |

### 大将だけ

| 項目 | 内容 |
|---|---|
| `maxHp` | 最大 HP |
| `effect` | 実装済みの効果。まだなければ `null` |

大将の効果の種類（`kind`）：

| kind | 内容 | 例 |
|---|---|---|
| `raceHpBonus` | 種族が race の自分のモンスターの HP を amount 上げる（大将ゾーンにあるあいだずっと） | `{ "kind": "raceHpBonus", "race": "ゴーレム", "amount": 1 }` |
| `rallyEnergy` | 大将の HP が条件以下のとき1回だけ使え、エネルギーを amount 増やす。条件は hpRatio（最大 HP に対する割合）か hpThreshold（HP の値） | `{ "kind": "rallyEnergy", "hpRatio": 0.5, "amount": 3 }` |
| `healOnMove` | 自分のモンスターが移動したとき、そのモンスターの HP を amount 回復 | `{ "kind": "healOnMove", "amount": 1 }` |
| `backRowBaBonus` | 自分の後衛のモンスターの BA を amount 上げる。hpRatio があれば、大将の HP が最大 HP × hpRatio 以下のときだけ | `{ "kind": "backRowBaBonus", "amount": 1, "hpRatio": 0.5 }` |
| `extraDrawWhenBehind` | ターン開始時、自分のモンスターが相手より margin 体以上少なければ amount 枚多く引く | `{ "kind": "extraDrawWhenBehind", "margin": 2, "amount": 1 }` |
| `spellEnergy` | 1ターンに1回、スペルを使ったときエネルギー +amount | `{ "kind": "spellEnergy", "amount": 1 }` |
| `extraDrawWhenFewCards` | ターン開始時、手札が handSize 枚以下なら amount 枚多く引く | `{ "kind": "extraDrawWhenFewCards", "handSize": 2, "amount": 1 }` |

## AI へのお願い（効果の実装）

`implementation` が `未実装` のカードは、`effectText` の文章どおりに効果を実装してください。

- ルールの処理は `src/logic/gameLogic.ts`、AI の判断は `src/logic/ai.ts` にあります。
  AI も新しい効果を使えるようにしてください。
- スペルの効果の種類は `src/types/card.ts` の `SpellEffect` です。種類を増やしたら、
  `src/logic/spellEffects.ts`（効果の文章）、`src/logic/cardData.ts`（JSON との変換）、
  `src/logic/cardEditor.ts`（カード作成画面の選択肢 `EFFECT_OPTIONS`）も更新します。
- 大将の効果の種類は `src/types/card.ts` の `LeaderAbility` です。効果は `src/logic/gameLogic.ts` の `getHpBonus` などで計算します。
- モンスターの効果の種類は `src/types/card.ts` の `MonsterAbility` です。召喚したときの効果は `gameLogic.ts` の `playCard` で処理しています。
- 実装したら、そのカードの `implementation` を `実装済み` にし、`updatedAt` を今の日時にして、テスト（`src/logic/*.test.ts`）を追加してください。
  `updatedAt` を新しくしないと、ユーザーのブラウザに残っている未実装の版が使われ続けます。
- ゲームのルールが変わる場合は、`RULES.md` も更新してください。

## AI へのお願い（イラスト）

`illustration.prompt` の文章をもとにイラストを作り、`public/images/cards/` に置いて、
`illustration.image` にファイル名を書いてください。
今あるイラストは横長（160×120 の比率）の SVG で、暗めの背景にシルエット風の絵柄です。
カード作成画面で選べるようにするには、`src/logic/builtinCards.ts` の `BUILTIN_IMAGES` にも追加します。
