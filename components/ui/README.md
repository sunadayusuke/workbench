# Workbench デザインシステム — コンポーネントカタログ（zinc）

リデザイン版（zinc トークン）の共通 UI コンポーネント正典。各アプリページは
**生レシピを直書きせず、必ずこのコンポーネント群を使う**。

> **生レシピ直書き禁止** — `scripts/ds-lint.mjs`（`npm run lint:ds` / build で実行）が
> 違反を検出するとビルドが落ちる（Vercel 含む）。デモ／プレビュー用に生レシピが
> どうしても必要な箇所のみ `// ds-lint-disable` … `// ds-lint-enable`
> （JSX 内は `{/* ds-lint-disable */}` 形式）でフェンスする。

すべて `@/lib/utils` の `cn()`（clsx + tailwind-merge）でクラスをマージするので、
`className` で上書き・追記できる。

---

## 1. コンポーネント一覧

| コンポーネント | import | 用途 |
|---|---|---|
| `ControlPanel` | `@/components/ui/control-panel` | 右サイド aside シェル（header + scroll + 絶対配置 footer） |
| `PanelSection` / `SectionTitle` | `@/components/ui/panel-section` | パネル内セクション区切りと見出し |
| `ControlRow` | `@/components/ui/control-row` | ラベル + トレーリングコントロールのピル行 |
| `NestedGroup` | `@/components/ui/nested-group` | 子パラメーターのインデント枠（左罫線） |
| `CircleButton` | `@/components/ui/circle-button` | 丸い追加（＋）ボタン |
| `OutputMenu` / `OutputMenuItem` / `useOutputMenuClose` | `@/components/ui/output-menu` | フッター書き出しポップアップ（外側クリッククローズ内蔵） |
| `ExportDialog` | `@/components/ui/export-dialog` | コード書き出しダイアログ（close / .html / copy 内蔵） |
| `FlatButton` | `@/components/ui/flat-button` | ダイアログ／インラインの平面ボタン |
| `CodeField` / `TextField` | `@/components/ui/code-field` | 暗色インセットのコード textarea / 単行 input |
| `ColorSwatch` | `@/components/ui/color-swatch` | 丸型カラーピッカー入力（単独・ベア用途） |
| `ColorRow` | `@/components/ui/color-row` | ラベル付きカラー行（22px swatch + 値 + 任意の × 削除）★既存 |
| `PushButton` | `@/components/ui/push-button` | ピル型ボタン（variant: light/dark/accent, size: sm/md/lg）★既存 |
| `ButtonSelect` | `@/components/ui/button-select` | フロステッドのミニ・セグメント・コントロール ★既存 |
| `DragParam` | `@/components/ui/drag-param` | ドラッグで値を変えるラベル + 値表示 ★既存 |
| `ToggleSwitch` | `@/components/ui/toggle-switch` | LED 付きトグルスイッチ（size: sm/md）★既存 |
| `LangToggle` | `@/components/ui/lang-toggle` | 日本語／英語切り替え（`AppTopBar` 内蔵）★既存 |

★ = 既存の共通コンポーネント（このラウンドで新規作成したものではない）。

---

## 2. Props と使用例

### ControlPanel
```tsx
ControlPanel({ title, headerAction?, footer?, className?, footerClassName?, children })
```
footer は **絶対配置のオーバーレイ**（aside が `relative`、スクロール本体が `pb-[88px]`
を確保）。`OutputMenu` のポップアップはこの footer を基準に配置される。

```tsx
<ControlPanel
  title={t.apps.xxx.name}
  headerAction={<PushButton size="sm" variant="light" onClick={reset}>{t.reset}</PushButton>}
  footer={<OutputMenu label={t.output}>…</OutputMenu>}
>
  …
</ControlPanel>
```

### PanelSection / SectionTitle
```tsx
PanelSection({ title?, titleAction?, border? = true, className?, children })
SectionTitle({ children, className? })   // <span>。<p>/<h3> ではない
```
最終セクションは `border={false}`。セクション内のコントロール間隔は
**`gap-2`（8px）に統一**（`PanelSection` / `NestedGroup` のデフォルト）。
gap を個別に上書きしない（横余白だけ詰めたいときは `className="px-4"` のように padding のみ指定）。

### FlatButton
```tsx
FlatButton({ children, onClick?, variant? = "solid" | "outline", type? = "button", disabled?, className? })
```
ラベルは **角括弧なしの素テキスト**（zinc）。solid = ダーク塗り、outline = 枠線。

### OutputMenu / OutputMenuItem
```tsx
OutputMenu({ label, disabled?, className?, children })          // トリガーは内蔵 PushButton variant="dark" flex-1
OutputMenuItem({ onSelect, disabled?, children })               // close → onSelect の順で発火
useOutputMenuClose()                                            // カスタム行から close() を取得
```
ラッパーは `display:contents` なので、ダークトリガーが footer の flex 行に直接並ぶ
（reset の `shrink-0` の隣で `flex-1`）。外側クリックで自動クローズ。

```tsx
<OutputMenu label={t.output}>
  <OutputMenuItem onSelect={savePNG}>PNG — Image</OutputMenuItem>
  <OutputMenuItem onSelect={() => setShowExport(true)}>HTML — Code</OutputMenuItem>
</OutputMenu>
```
カスタム行（aurora の動画書き出しなど）は `useOutputMenuClose()` で close を取得して
直接 popup の子に書く。

### ExportDialog
```tsx
ExportDialog({ open, onOpenChange, title, code, filename?, onDownloadHtml?, children? })
```
ボタンは close（outline）／ `.html`（outline・素ラベル）／ copy（solid）を内蔵。
`filename` 指定時の `.html` 既定動作はインライン blob の `<a>` クリック。
`onDownloadHtml` を渡すとそれが優先される（GLB+ZIP など）。`t`・コピー状態は内蔵。

```tsx
<ExportDialog open={showExport} onOpenChange={setShowExport}
  title={t.apps.xxx.name} code={exportCode} filename="xxx.html" />
```

### CodeField / TextField
```tsx
CodeField(props: textarea)   // sizing は className で（例: "flex-1 min-h-[300px]"）
TextField(props: input)      // 文字サイズは className で上書き
```
どちらも native props を forward する `forwardRef` コンポーネント。

### NestedGroup
```tsx
NestedGroup({ className?, children })   // pl-3 + 左罫線 + flex-col gap-2
```

### ControlRow
```tsx
ControlRow({ label, className?, children })   // ラベル + 末尾コントロールのピル行
```

### CircleButton
```tsx
CircleButton({ onClick?, className?, children, "aria-label"? })   // size-7 の丸い ＋ ボタン
```

### ColorSwatch
```tsx
ColorSwatch({ value, onChange, size?, className?, disabled? })
```
グローバルの `.color-swatch`（既定 22px）をラップ。`size` を渡すと inline で
width/height を上書き（例: color アプリの 36px ローカル ColorInput）。ラベル付きの
カラー行は `ColorRow` が正典。

---

## 3. デザイントークン早見表（Tailwind ユーティリティ）

| トークン | 値 | 用途 |
|---|---|---|
| `bg-wb-0` | `#ffffff` | パネル地・カード地 |
| `bg-wb-50` | `#f3f4f4` | インセット入力欄・hover 地 |
| `border-wb-100` | `#e7e7e9` | ネスト罫線・丸ボタン枠 |
| `border-wb-200` | `#dcdce0` | パネル境界・セクション区切り・入力枠 |
| `text-wb-400` | `#9f9fa9` | プレースホルダー |
| `text-wb-500` | `#71717b` | 補助ラベル |
| `text-wb-700` | `#3f3f46` | メニュー項目テキスト |
| `bg-wb-800` | `#27272a` | dark ボタン hover |
| `text-wb-900` / `bg-wb-900` | `#18181b` | 主要テキスト・solid 塗り |
| `active:bg-wb-950` | `#0c0c10` | solid 押下 |
| `bg-wb-green` | `#0dca7a` | アクセント（LED・accent ボタン） |

半透明オーバーレイは `rgba(12,12,16,…)`（= `--wb-950` の RGB）を使う。

---

## 4. アプリ共通スケルトン（完全サンプル）

```tsx
"use client";

import { AppTopBar } from "@/components/app-top-bar";
import { ControlPanel } from "@/components/ui/control-panel";
import { PanelSection } from "@/components/ui/panel-section";
import { OutputMenu, OutputMenuItem } from "@/components/ui/output-menu";
import { ExportDialog } from "@/components/ui/export-dialog";
import { PushButton } from "@/components/ui/push-button";
import { useLanguage } from "@/lib/i18n";
import { useState } from "react";

export default function XxxApp() {
  const { t } = useLanguage();
  const [showExport, setShowExport] = useState(false);

  return (
    <div className="fixed inset-0 flex flex-col md:flex-row bg-wb-50">
      {/* キャンバスエリア */}
      <div className="h-[30vh] md:h-auto md:flex-1 relative">  {/* モバイルは view 3 / aside 7 で全アプリ統一 */}
        {/* Three.js canvas / SVG preview */}
        <AppTopBar />
      </div>

      {/* コントロールサーフェス */}
      <ControlPanel
        title={t.apps.xxx.name}
        headerAction={
          <PushButton size="sm" variant="light" onClick={reset}>{t.reset}</PushButton>
        }
        footer={
          <>
            <PushButton variant="light" onClick={reset} className="shrink-0">
              {t.reset}
            </PushButton>
            <OutputMenu label={t.output}>
              <OutputMenuItem onSelect={savePNG}>PNG — Image</OutputMenuItem>
              <OutputMenuItem onSelect={() => setShowExport(true)}>HTML — Code</OutputMenuItem>
            </OutputMenu>
          </>
        }
      >
        <PanelSection title={t.apps.xxx.shape}>
          {/* DragParam / ControlRow / NestedGroup など */}
        </PanelSection>
        <PanelSection title={t.apps.xxx.color} border={false}>
          {/* 最終セクションは border={false} */}
        </PanelSection>
      </ControlPanel>

      <ExportDialog
        open={showExport}
        onOpenChange={setShowExport}
        title={t.apps.xxx.name}
        code={exportCode}
        filename="xxx.html"
      />
    </div>
  );
}
```

> footer のパターン: 左に `PushButton variant="light" shrink-0`（リセット）、右に
> `OutputMenu`（内蔵トリガーが `flex-1` ダーク）を並べる。`OutputMenu` のラッパーは
> `display:contents` なので 2 つは同じ flex 行に並ぶ。
