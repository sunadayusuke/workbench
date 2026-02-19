# Workbench デザインシステム ガイドライン

## 基本思想

**Industrial / Tool-like** — Teenage Engineering の機器のような、機能的で無駄のない見た目。
装飾を排除し、モノスペースフォント・黒ボーダー・グレー背景で統一する。

---

## カラー

| 用途 | 値 | 使用場所 |
|---|---|---|
| ページ背景 | `#d2d2d2` | 全アプリのサイドバー、ホーム |
| キャンバス背景 | `#000000` | 各アプリの左側プレビューエリア |
| フォーム背景 | `#FFFFFF` | input / select / textarea |
| 主要テキスト・ボーダー | `#242424` | ほぼ全ての文字・枠線 |
| サブテキスト | `#242424` + opacity | `text-[#242424]/60` など |
| ホワイト（ダークUI上） | `#FFFFFF` / `#FAFAF8` | ダークボタン上の文字、スライダーのつまみ |

セマンティックトークン（`bg-background` `text-foreground` 等）は**使わない**。
直接 `#242424` / `#d2d2d2` / `#ffffff` を書く。

---

## タイポグラフィ

フォントは**モノスペース統一**。`font-mono` クラスを必ず付ける。

| 用途 | クラス |
|---|---|
| セクションタイトル・ラベル | `text-[12px] font-mono uppercase tracking-[0.08em] text-[#242424]` |
| セクションヘッダー | `text-[12px] font-mono uppercase tracking-[0.2em] text-[#242424]` |
| サイドバータイトル | `text-[12px] font-mono uppercase tracking-[0.22em] text-[#242424]` |
| ボタン文字 | `font-mono text-[12px] uppercase tracking-[0.10em]` |
| 数値表示 | `text-[12px] font-mono text-[#242424] tabular-nums` |
| サブテキスト | `text-[12px] font-mono text-[#242424]/60` |
| コード・textarea | `font-mono text-[12px] leading-relaxed` |

`text-sm` `font-medium` `font-semibold` `text-base` `text-lg` は**使わない**。

---

## ボーダー・角丸

- ボーダーカラーは常に `border-[#242424]`（`border-border` は使わない）
- **角丸は使わない** — `rounded-none` がデフォルト（`rounded-lg` `rounded-xl` 等は付けない）
- ボーダー幅は基本 `border`（1px）

```tsx
// Good
<div className="border border-[#242424]">

// Bad
<div className="border border-border rounded-lg">
```

---

## UIコンポーネント

### ボタン — ダーク（プライマリアクション）

```tsx
<button className="bg-[#242424] text-white font-mono text-[12px] uppercase tracking-[0.10em] px-4 py-2 hover:bg-[#333] active:bg-[#1a1a1a] transition-colors select-none">
  [ ラベル ]
</button>
```

ラベルは `[ テキスト ]` 形式（角括弧で囲む）。

### ボタン — アウトライン（セカンダリアクション）

```tsx
<button className="border border-[#242424] text-[#242424] font-mono text-[12px] uppercase tracking-[0.10em] px-4 py-2 hover:bg-[#242424]/10 active:bg-[#242424]/20 transition-colors select-none">
  [ ラベル ]
</button>
```

### `<Button>` コンポーネント使用時

```tsx
import { Button } from "@/components/ui/button";

<Button>プライマリ</Button>                        // ダーク
<Button variant="outline">セカンダリ</Button>      // アウトライン
<Button variant="ghost">ゴースト</Button>
```

`components/ui/button.tsx` がソースオブトゥルース。スタイルはそこで管理。

### Input

```tsx
import { Input } from "@/components/ui/input";

<Input type="text" />
// → border-[#242424] bg-white font-mono text-[12px] shadow-none focus-ring なし
```

`components/ui/input.tsx` がソース。個別に `border-[#242424]` を重複指定しない。

### Select

```tsx
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

<Select>
  <SelectTrigger>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="a">選択肢A</SelectItem>
  </SelectContent>
</Select>
```

スタイルは `components/ui/select.tsx` で管理済み。

### Slider

```tsx
import { Slider } from "@/components/ui/slider";

<Slider value={[value]} min={0} max={100} step={1} onValueChange={([v]) => setValue(v)} />
```

トラック白・レンジ黒・つまみ黒ボーダーは `components/ui/slider.tsx` で管理済み。

### Label

```tsx
import { Label } from "@/components/ui/label";

<Label>{/* text-[12px] font-mono uppercase tracking-[0.08em] text-[#242424] がデフォルト */}</Label>
```

`className` で上書きしない限りデフォルトスタイルが適用される。

### Dialog（モーダル）

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>タイトル</DialogTitle>
    </DialogHeader>
    {/* コンテンツ */}
    <div className="flex justify-end gap-2 pt-2">
      <Button variant="outline" onClick={() => setOpen(false)}>{t.cancel}</Button>
      <Button onClick={handleConfirm}>{t.confirm}</Button>
    </div>
  </DialogContent>
</Dialog>
```

背景白・ボーダー黒・角丸なしは `components/ui/dialog.tsx` で管理済み。

### ディバイダー

```tsx
<div className="h-px bg-[#242424] my-2" />
```

`<Separator />` コンポーネントや `.groove` クラスは使わず、インラインで書く。

### カラーピッカー（input type="color"）

```tsx
<input
  type="color"
  value={color}
  onChange={(e) => setColor(e.target.value)}
  className="size-9 shrink-0 block border border-[#242424] cursor-pointer p-0 overflow-hidden color-swatch"
/>
```

`color-swatch` クラスは `globals.css` で定義済み（ブラウザデフォルトのパディング除去）。

### トグルスイッチ

```tsx
<button
  role="switch"
  aria-checked={isOn}
  onClick={() => setIsOn(!isOn)}
  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer border border-[#242424] transition-colors items-center px-[2px] ${isOn ? "bg-primary" : "bg-muted"}`}
>
  <span className={`pointer-events-none block h-3 w-3 transition-transform ${isOn ? "translate-x-[18px] bg-white" : "bg-[#242424]"}`} />
</button>
```

- トラック: 角丸なし、ON=`bg-primary`（黒）、OFF=`bg-muted`
- つまみ: 角丸なし 12×12px、ON=白、OFF=黒

---

## レイアウトパターン

### アプリ全体の骨格

```tsx
<div className="fixed inset-0 z-50 flex flex-col md:flex-row bg-[#d2d2d2]">
  {/* 左: キャンバス or プレビューエリア */}
  <div className="h-[55vh] md:h-auto md:flex-1 relative min-w-0 shrink-0 bg-black">
    {/* キャンバス（Three.js等） */}
    <div ref={containerRef} className="w-full h-full" />

    {/* トップバー（左右に貼り付け） */}
    <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3 md:p-4 z-10 pointer-events-none [&>*]:pointer-events-auto">
      <Link href="/">
        <button className="bg-[#242424] text-white font-mono text-[12px] uppercase tracking-[0.10em] px-3 py-1.5 backdrop-blur-xl hover:bg-[#333] active:bg-[#1a1a1a] transition-colors select-none">
          [ BACK ]
        </button>
      </Link>
      <button onClick={toggle} className="bg-[#242424] text-white font-mono text-[12px] uppercase tracking-[0.12em] px-3 py-1.5 hover:bg-[#333] active:bg-[#1a1a1a] transition-colors select-none">
        [ {lang === "ja" ? "EN" : "JA"} ]
      </button>
    </div>
  </div>

  {/* 右: サイドバー */}
  <aside className="flex-1 md:flex-none md:w-80 shrink bg-[#d2d2d2] shadow-[0_-8px_24px_rgba(0,0,0,0.10)] md:shadow-none md:border-l md:border-l-[#242424] flex flex-col overflow-hidden">
    {/* サイドバーヘッダー */}
    <div className="flex items-center justify-between px-6 h-10 md:h-14 shrink-0 border-b border-[#242424]">
      <span className="text-[12px] font-mono uppercase tracking-[0.22em] text-[#242424] select-none">
        アプリ名
      </span>
      <button className="bg-[#242424] text-white font-mono text-[12px] uppercase tracking-[0.10em] px-3 py-1.5 hover:bg-[#333] active:bg-[#1a1a1a] transition-colors select-none" onClick={handleReset}>
        [ RESET ]
      </button>
    </div>

    {/* サイドバーボディ */}
    <div className="flex-1 overflow-y-auto flex flex-col gap-4 px-6 py-5 pb-8">
      {/* コントロール群 */}
    </div>
  </aside>
</div>
```

### サイドバー内のスライダーパターン

```tsx
<div className="flex flex-col gap-2">
  <div className="flex justify-between items-baseline">
    <Label>{ラベル}</Label>
    <span className="text-[12px] font-mono text-[#242424] tabular-nums">{value.toFixed(2)}</span>
  </div>
  <Slider value={[value]} min={0} max={1} step={0.01} onValueChange={([v]) => setValue(v)} />
</div>
```

### セクション区切り

```tsx
<p className="text-[12px] font-mono uppercase tracking-[0.2em] text-[#242424] select-none">
  セクション名
</p>
<div className="h-px bg-[#242424] my-2" />
```

### ネスト項目（親パラメータが有効な時のみ表示）

```tsx
{value > 0 && (
  <div className="pl-3 border-l-2 border-[#242424] flex flex-col gap-3">
    {/* 子コントロール */}
  </div>
)}
```

### エクスポートボタン（サイドバー最下部）

```tsx
<button
  className="w-full py-3 px-4 bg-[#242424] text-white font-mono text-[12px] uppercase tracking-[0.14em] hover:bg-[#333] active:bg-[#1a1a1a] transition-colors select-none"
  onClick={handleDownload}
>
  [ DOWNLOAD ]
</button>
```

---

## レスポンシブ

| 状態 | レイアウト |
|---|---|
| モバイル（< 768px） | 縦並び: キャンバス `h-[55vh]` + サイドバー `flex-1` |
| デスクトップ（≥ 768px） | 横並び: キャンバス `flex-1` + サイドバー固定幅 `w-80` |

モバイル時のサイドバーは上部に `shadow-[0_-8px_24px_rgba(0,0,0,0.10)]` でレイヤー感を出す。

---

## アプリ追加チェックリスト

1. `app/apps/<name>/page.tsx` を作成
2. `app/page.tsx` の `apps` 配列にエントリ追加
3. `lib/translations.ts` に翻訳キーを追加（全テキスト日本語/英語対応）
4. 上記レイアウトパターンを使う
5. `--font-sans` / `--font-mono` は同一（モノスペース）
6. ボーダーは `border-[#242424]`、角丸なし
7. Three.js を使う場合は `useEffect` 内で動的 import

---

## やってはいけないこと

| NG | 理由 |
|---|---|
| `rounded-lg` `rounded-xl` `rounded-full` をフォームに使う | 角丸なしが原則 |
| `text-sm` `font-medium` `font-semibold` | font-mono 12px で統一 |
| `border-border` `text-muted-foreground` `bg-background` | セマンティックトークンは直値で書く |
| `bg-white` を `hover:bg-white` で上書き | ホバーで白くなるのを避ける |
| LINE Seed JP を使う | モノスペース統一済み |
| `focus-visible:ring-[3px]` | フォーカスリングは無効化済み |
| `shadow-xs` `shadow-lg` をフォームに使う | フォームに影はつけない |
| `Separator` コンポーネント | `<div className="h-px bg-[#242424] my-2" />` を使う |

---

## コンポーネントのソースオブトゥルース

変更したい場合はここだけ修正すれば全体に反映される。

| コンポーネント | ファイル |
|---|---|
| ボタン | `components/ui/button.tsx` |
| インプット | `components/ui/input.tsx` |
| セレクト | `components/ui/select.tsx` |
| スライダー | `components/ui/slider.tsx` |
| ラベル | `components/ui/label.tsx` |
| ダイアログ | `components/ui/dialog.tsx` |
| パラメータースライダー | `components/ui/param-slider.tsx` |
| セクションヘッダー | `components/ui/section-header.tsx` |
| グローバルCSS | `app/globals.css` |

### 共通ユーティリティ・フック

| 用途 | ファイル |
|---|---|
| クリップボードコピー | `hooks/use-clipboard.ts` — `const { copy, copied } = useClipboard(delay?)` |
| Canvasダウンロード | `lib/canvas-download.ts` — `downloadCanvas(canvas, filename)` / `downloadBlob(blob, filename)` |
| 色変換 | `lib/color-utils.ts` — `hexToRGB(hex)` → `[r, g, b]`（0–255） |
