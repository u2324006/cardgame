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

### 大将だけ

| 項目 | 内容 |
|---|---|
| `maxHp` | 最大 HP |
| `effect` | 実装済みの効果。まだなければ `null` |

大将の効果の種類（`kind`）：

| kind | 内容 | 例 |
|---|---|---|
| `raceHpBonus` | 種族が race の自分のモンスターの HP を amount 上げる（大将ゾーンにあるあいだずっと） | `{ "kind": "raceHpBonus", "race": "ゴーレム", "amount": 1 }` |

## AI へのお願い（効果の実装）

`implementation` が `未実装` のカードは、`effectText` の文章どおりに効果を実装してください。

- ルールの処理は `src/logic/gameLogic.ts`、AI の判断は `src/logic/ai.ts` にあります。
  AI も新しい効果を使えるようにしてください。
- スペルの効果の種類は `src/types/card.ts` の `SpellEffect` です。種類を増やしたら、
  `src/logic/spellEffects.ts`（効果の文章）、`src/logic/cardData.ts`（JSON との変換）、
  `src/logic/cardEditor.ts`（カード作成画面の選択肢 `EFFECT_OPTIONS`）も更新します。
- 大将の効果の種類は `src/types/card.ts` の `LeaderAbility` です。効果は `src/logic/gameLogic.ts` の `getHpBonus` などで計算します。
- モンスターの効果（召喚したとき、攻撃したとき など）は、まだ仕組みがありません。最初に実装するときに仕組みを作ってください。
- 実装したら、そのカードの `implementation` を `実装済み` にし、`updatedAt` を今の日時にして、テスト（`src/logic/*.test.ts`）を追加してください。
  `updatedAt` を新しくしないと、ユーザーのブラウザに残っている未実装の版が使われ続けます。
- ゲームのルールが変わる場合は、`RULES.md` も更新してください。

## AI へのお願い（イラスト）

`illustration.prompt` の文章をもとにイラストを作り、`public/images/cards/` に置いて、
`illustration.image` にファイル名を書いてください。
今あるイラストは横長（160×120 の比率）の SVG で、暗めの背景にシルエット風の絵柄です。
カード作成画面で選べるようにするには、`src/logic/builtinCards.ts` の `BUILTIN_IMAGES` にも追加します。
