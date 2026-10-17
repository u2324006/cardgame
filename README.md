# Card Game

AI と対戦するターン制カードゲームです（React + TypeScript / Create React App）。
このファイルはプログラム全体の説明です。ゲームのルールは [RULES.md](RULES.md) を見てください。

## 起動のしかた

Node.js が必要です。

```bash
npm install
npm start      # http://localhost:3000 で起動
npm test       # テストを実行
npm run build  # 本番用ビルド（build/ に出力）
```

`PUBLIC_URL=. npm run build` でビルドすると、画像などを相対パスで読むので、任意の場所に置いて公開できます。

## 技術構成

- React 19 + TypeScript（Create React App）
- テスト：Jest + Testing Library（`npm test`）
- サーバーは使っていません。デッキと対戦の途中経過はブラウザの localStorage に保存します。
- フォント：Google Fonts（Shippori Mincho B1 / Zen Kaku Gothic New）

## 画面

メニューから次の画面に進めます。

- **対戦**：保存したデッキ（なければ自動で作ったデッキ）で AI と対戦します。
  対戦の途中経過はこのブラウザに保存され、再読み込みしたりメニューへ戻ったりしても「続きから」で再開できます。
- **デッキ作成**：「1. 大将を選ぶ」「2. カードを選ぶ」の順にデッキを組み、このブラウザに保存します。
- **カード一覧**：すべてのカードと大将カードを、種類で絞り込んで見られます。

## ゲームルール

ルールは [RULES.md](RULES.md) にまとめています。

## 対戦の操作

| やりたいこと | 操作 |
|---|---|
| 召喚 | 手札のモンスター → 自分の空きスロット |
| スペル | 手札のスペル → 対象のモンスター（回復・攻撃の呪文は味方、炎の呪文は相手） |
| 移動 | 自分のモンスター → 反対の列の空きスロット |
| 攻撃 | 自分のモンスター → 相手のモンスター、または相手の大将カード（HP） |

選んだものをもう一度クリックすると選択を解除できます。

## ディレクトリ構成

```
src/
├── types/        型定義（カード・ゲーム状態）
├── logic/        ゲームのルール（React に依存しない純粋関数）
│   ├── rules.ts       ルールの数値（デッキ枚数・HP など）
│   ├── cards.ts       カード・大将カードのデータ
│   ├── deck.ts        デッキのルール（40枚・同名3枚まで）と保存
│   ├── initialState.ts 対戦の初期状態
│   ├── gameLogic.ts   フェイズ進行と各行動（召喚・スペル・移動・攻撃）
│   ├── ai.ts          AI の思考ルーチン
│   ├── savedBattle.ts 対戦の途中経過の保存と読み込み
│   └── testUtils.ts   テスト用のカード・盤面を作るヘルパー
├── screens/      メニュー・カード一覧・デッキ作成の画面
├── hooks/        対戦画面用のフック（AI の自動進行・メッセージ表示）
├── components/   App（画面の切り替え）、対戦画面とカードの部品
└── styles/       CSS（index.css に配色とフォントの変数）
public/images/cards/  カードのイラスト（SVG）
```

## しくみ

- `components/App.tsx` が今の画面（メニュー・カード一覧・デッキ作成・対戦）を切り替えます。
- 対戦画面（`components/GameBoard.tsx`）はゲームの状態（`GameState`）を1つ持ち、
  クリックに応じて `logic/gameLogic.ts` の関数（`playCard`・`castSpell`・`moveMonster`・`attack` など）を呼びます。
- 自分のドローフェイズと AI のターンは `hooks/useAutoProgress.ts` がタイマーで進めます。
- ルールの数値（デッキ枚数・同名の上限・手札・エネルギー上限など）は `logic/rules.ts` にまとまっています。

ルールの処理はすべて `src/logic/` にあり、state を書き換えずに新しい state を返します。
行動がルール違反のときは `{ ok: false, error }` を返し、画面はそのメッセージを表示します。
AI もプレイヤーと同じ関数を通して行動するので、ルール違反の手は打てません。

### ブラウザに保存するデータ

| キー | 内容 | 消えるとき |
|---|---|---|
| `cardgame.deck` | デッキ作成で保存したデッキ | ブラウザのデータを消したとき |
| `cardgame.battle` | 対戦の途中経過（「続きから」用） | 新しく対戦を始めたとき、決着がついたとき |

`GameState` の形を変えたときは、`logic/savedBattle.ts` の `VERSION` を上げてください（古い途中経過は読み込まれなくなります）。
保存したデッキが今のカードやルールに合わない場合は、メニューで知らせて自動のデッキを使います。

### カードを追加するには

`src/logic/cards.ts` の `MONSTER_CARDS` または `SPELL_CARDS` にカードを加えます。
スペルの効果は `effect` で指定します（`buffFa`：FA上昇、`heal`：回復、`damage`：相手にダメージ）。
スライム・妖精・オーク兵・騎士・ドラゴン・回復の呪文・炎の呪文は、デッキを組めるようにするための仮のカードです。
カードを変えたら [RULES.md](RULES.md) のカード一覧も更新してください。
デッキを40枚組めるよう、カードは最低14種類（同名3枚まで × 14 = 42枚）必要です。

### 絵を入れるには

画像を `public/images/cards/` に置き、`src/logic/cards.ts` のカードの定義の `image` にファイル名を指定します。
今入っているイラストは SVG で、同じ名前の PNG などに差し替えることもできます。

```ts
monster({
  id: 'm001', name: 'ゴブリンアタッカー', image: cardImage('goblin.svg'), race: 'ゴブリン',
  cost: 1, frontAttack: 2, backAttack: 2, cardHp: 6,
  description: '前衛でも後衛でも同じ力で戦える、身軽なゴブリン。',
}),
```

大将カードは `src/logic/cards.ts` の `LEADER_CARDS` で、名前・説明・最大HP・`image` を設定できます。
