# Workbench — ハンドオーバー

## サイト概要
個人用ツールキットポータル。今後アプリを増やしていく前提の設計。
- 本番URL: https://workbench.suna.design
- ホスティング: Vercel（GitHub push で自動デプロイ）
- リポジトリ: github.com/sunadayusuke/workbench

## 技術スタック
- **Next.js 15** + Turbopack (`npm run dev --turbopack`)
- **Tailwind CSS v4** — CSS-first設定（`tailwind.config.js` なし、`postcss.config.mjs` で `@tailwindcss/postcss` 使用）
- **shadcn/ui** — new-york スタイル、neutral ベースカラー、CSS Variables モード
- **React 19** / **TypeScript 5**
- **Three.js** — シェーダーアプリ・画像加工アプリ・ホームのキャンバスプレビューで使用
- フォント: **Gen Interface JP**（Inter × Noto Sans JP / yamatoiizuka/gen-interface-jp）。jsDelivr CDN から `app/layout.tsx` の `<head>` で `<link>` 読み込み（`cdn/400.css`〜`700.css` + `display-700.css`）。`--font-sans` = `"Gen Interface JP"`、見出し用 `--font-display` = `"Gen Interface JP Display"`、`--font-mono` はコード表示用に monospace を維持

## デザインシステム（2026-06 リニューアル）
Figma「おすなの部屋」準拠のクリーンなミニマル design。`app/globals.css` のトークン:
1. **Workbench zinc スケール** — `--wb-0`(#ffffff) 〜 `--wb-950`(#0c0c10)。Tailwind ユーティリティとして `bg-wb-50` `text-wb-900` `border-wb-200` 等が使える（`@theme inline` で登録）
2. **アクセント** — `--wb-green: #0dca7a`（トグル ON / ライブインジケーター）。`bg-wb-green`
3. **インクα** — `--ink-a50`〜`--ink-a950`（`rgba(12,12,16,x)`）。ハイラインは `rgba(12,12,16,0.x)` 直書きでも可
4. **shadcn セマンティックトークン** — 上記 zinc にマップ（light 専用）。`--radius: 0.625rem`(10px)
5. **レガシーエイリアス** — `--led-green`/`--ink-dark`/`--cap-white` 等は新パレットに repoint 済み（移行時の安全網）

```
zinc: 0 #ffffff / 50 #f3f4f4 / 100 #e7e7e9 / 200 #dcdce0 / 300 #ceced3 /
      400 #9f9fa9 / 500 #71717b / 600 #52525c / 700 #3f3f46 / 800 #27272a /
      900 #18181b / 950 #0c0c10 ；accent green #0dca7a
```

**サーフェス階層**: ベース背景 `bg-wb-50` / 浮き面（カード・パネル）`bg-wb-0` / 凹面（ピル・入力・プレビュー背景）`bg-wb-50` / ハイライン `border-wb-100`〜`border-wb-200`。
テーマ: ライトモード（`<html className="light">`）。物理UI（アルミ筐体）トークンは廃止。

## ディレクトリ構成
```
app/
  layout.tsx          — ルートレイアウト（Gen Interface JP の <link>、LanguageProvider、BMC widget）
  page.tsx            — ホーム（アプリカード一覧。各カード上部に <AppPreview> のライブキャンバス）
  globals.css         — zinc デザイントークン + ベーススタイル + .color-swatch + .scrollbar-thin
  apps/
    color/page.tsx    — OKLCHカラースケール＆コントラストチェッカー
    shader/page.tsx   — パーリンノイズ背景デザインツール（Three.js）
    image/page.tsx    — 画像補正＆エフェクトツール（Three.js + WebGLシェーダー）
    gradient/page.tsx — メッシュグラデーションツール（Three.js + WebGLシェーダー）
    particle/page.tsx — パーティクルアニメーションツール（Three.js + Points + ShaderMaterial）
    dotmap/page.tsx   — ドット世界地図SVGジェネレーター（d3-geo + topojson-client、Canvas raster方式）
    easing/page.tsx   — ベジェカーブエディター＆アニメーションプレビュー
    signal/page.tsx   — ディザリングシグナルノイズジェネレーター（Canvas 2D + Bayer dither）
    aurora/page.tsx   — シェイプシェーダー × SVGマスク合成ツール（Three.js + GLSL + MediaRecorder）
    badge/page.tsx    — SVG→3Dバッジジェネレーター（Three.js + matcap）
    compress/page.tsx — 画像圧縮・形式変換ツール（UPNG + JSZip、全処理クライアントサイド）
    qr/page.tsx       — スタイルドQRコードジェネレーター（qrcode + 自前SVGレンダラー、jsQRで読取検証済み）
components/
  app-top-bar.tsx     — 全アプリ共通トップバー（← 戻る ピル + <LangToggle>）`useLanguage()` 使用
  app-preview.tsx     — ホームカード用ライブキャンバスプレビュー（IntersectionObserver で遅延マウント。shader/gradient/aurora は実 GLSL、他は FPS 制限 Canvas2D）
  ui/                 — デザインシステムコンポーネント群（詳細は components/ui/README.md）
  ui/README.md        — コンポーネントカタログ（用途・props・使用例の正典）
  ui/control-panel.tsx — zinc aside シェル（header + scroll + 絶対配置 footer 内蔵）
  ui/panel-section.tsx — パネル内セクション（SectionTitle 内蔵、区切り線つき）
  ui/control-row.tsx  — ラベル＋コントロールのピル行
  ui/nested-group.tsx — 子パラメーターのインデント枠（左罫線）
  ui/output-menu.tsx  — フッター書き出しポップアップ（外側クリッククローズ内蔵）
  ui/export-dialog.tsx — コード書き出しダイアログ（close / .html / copy 内蔵）
  ui/flat-button.tsx  — ダイアログ／インラインの平面ボタン（variant: solid/outline）
  ui/code-field.tsx   — CodeField / TextField（暗色インセット textarea / input）
  ui/circle-button.tsx — 丸い追加（＋）ボタン（size-7）
  ui/color-swatch.tsx — 丸型カラーピッカー入力（単独・ベア用途）
  ui/push-button.tsx  — フラットボタン（variant: dark=塗り / light=アウトライン / accent=緑、rounded-[10px]）
  ui/drag-param.tsx   — ドラッグでパラメーター変更するピル（左ラベル+グリップ / 右 値、API 据え置き）
  ui/toggle-switch.tsx — 緑(#0dca7a)ピルトグル（label 有→ピル行 / 無→スイッチのみ。size: sm/md）
  ui/color-row.tsx    — カラー行（label 左 / hex + .color-swatch 右）
  ui/lang-toggle.tsx  — JA/EN セグメンテッドトグル（iOS風。ホーム + AppTopBar で使用）
  ui/button-select.tsx — セグメンテッドセレクター（AAA BB CCC 型）
scripts/
  ds-lint.mjs         — デザインシステム逸脱検出リンター（`npm run lint:ds`、build でも実行）
lib/
  utils.ts            — cn() ユーティリティ
  color-utils.ts      — hexToRGB()（Three.js ShaderMaterial 向け色変換）
  canvas-download.ts  — downloadCanvas() / downloadBlob()（モバイル/デスクトップ分岐）
  translations.ts     — i18n 翻訳テキスト定義（Translations interface + ja/en オブジェクト）
  i18n.tsx            — LanguageProvider / useLanguage() フック
hooks/
  use-clipboard.ts    — useClipboard()（copied state + navigator.clipboard + 自動リセット）
```

## i18n（日本語 / 英語切り替え）
全アプリページで日本語・英語の切り替えに対応。

- `lib/translations.ts` — `Translations` interface と `ja`/`en` オブジェクトを定義
- `lib/i18n.tsx` — `LanguageProvider`（`app/layout.tsx` でラップ済み）と `useLanguage()` フックを export
- 各ページで `const { t } = useLanguage()`（`lang` が必要な場合は追加）
- トップバーは `<AppTopBar />` コンポーネントが `useLanguage()` を内部で呼んで処理
- 翻訳キーを追加するときは `Translations` interface / `ja` / `en` の3か所に追加する
- ボタンテキストは `[ {t.xxx} ]` 形式（角括弧含む）で統一

## スタイリングルール
- **Tailwind CSS のみ使用**（CSS Modules は使わない）
- Tailwind v4 の important 修飾子は `!` サフィックス（例: `bg-black/55!`）
- **生レシピのコピペ禁止。詳細は `components/ui/README.md`**
- `scripts/ds-lint.mjs` が違反を検出するとビルドが落ちる（Vercel 含む）。デモ／プレビューコンテンツで生レシピが必要な場合のみ `// ds-lint-disable` … `// ds-lint-enable`（JSX 内は `{/* ds-lint-disable */}` 形式）でフェンス
- スクロール領域には `scrollbar-thin` を付与

### デザインシステムコンポーネント必須

| コンポーネント | 用途 |
|---|---|
| `ControlPanel` | zinc aside シェル（header + scroll + 絶対配置 footer 内蔵） |
| `PanelSection` + `SectionTitle` | パネル内セクション区切りと見出し（title = `text-[15px] font-medium text-wb-900`） |
| `ControlRow` | ラベル＋コントロール（select/toggle/swatch）のピル行 |
| `NestedGroup` | 子パラメーターのインデント枠（左罫線） |
| `OutputMenu` / `OutputMenuItem` | フッターの書き出しポップアップ（外側クローズ内蔵） |
| `ExportDialog` | コード書き出しダイアログ（close・.html DL・copy ボタン内蔵） |
| `FlatButton` | ダイアログ／インラインの平面ボタン（variant: solid/outline） |
| `CodeField` / `TextField` | 暗色インセット textarea / input（コード・数値出力） |
| `CircleButton` | 丸い追加（＋）ボタン（size-7） |
| `ColorSwatch` / `ColorRow` | 丸型カラーピッカー入力 |
| `PushButton` | フラットボタン（variant: dark/light/accent、size: sm/md/lg） |
| `ButtonSelect` | フロステッドのミニ・セグメント・コントロール |

## アプリ追加の手順
1. `app/apps/<app-name>/page.tsx` を作成
2. `app/page.tsx` の `APP_KEYS` 配列と `APP_HREFS` にエントリ追加
3. 必要に応じて `npx shadcn@latest add <component>` でUIコンポーネント追加
4. レイアウトは `ControlPanel` + `PanelSection` で組む（`components/ui/README.md` §4 参照）
5. パラメーター操作は `DragParam`、トグルは `ToggleSwitch`、ピルボタンは `PushButton`、ダイアログ内ボタンは `FlatButton`
6. 書き出しポップアップは `OutputMenu`、コード出力ダイアログは `ExportDialog`
7. ダウンロードは `downloadCanvas` / `downloadBlob`、クリップボードは `useClipboard` を使用
8. `lib/translations.ts` に新アプリのキーを追加し、`useLanguage()` で `t` を取得
9. `npm run lint:ds` がデザインシステム逸脱を検出しビルドを落とす（Vercel 含む）。デモ／プレビューコンテンツで生レシピが必要な場合のみ `// ds-lint-disable` … `// ds-lint-enable`（または `{/* ds-lint-disable */}` 形式）でフェンス

## アプリ共通レイアウトパターン
ボタンラベルはブラケット `[ ]` を使わず素のテキスト（リニューアルで廃止）。リセットはフッター左の `PushButton variant="light" shrink-0` に配置し、右側に `OutputMenu`（内蔵トリガーが `flex-1` ダーク）を並べる。

```tsx
import { AppTopBar } from "@/components/app-top-bar";
import { ControlPanel } from "@/components/ui/control-panel";
import { PanelSection } from "@/components/ui/panel-section";
import { OutputMenu, OutputMenuItem } from "@/components/ui/output-menu";
import { ExportDialog } from "@/components/ui/export-dialog";
import { PushButton } from "@/components/ui/push-button";

<div className="fixed inset-0 z-50 flex flex-col md:flex-row bg-wb-50">
  {/* キャンバスエリア */}
  <div className="h-[55vh] md:h-auto md:flex-1 relative min-w-0 shrink-0">  {/* aurora のみ 40vh */}
    {/* Three.js canvas / SVG preview */}
    <AppTopBar />
  </div>

  {/* コントロールサーフェス */}
  <ControlPanel
    title={t.apps.xxx.name}
    headerAction={<PushButton size="sm" variant="light" onClick={reset}>{t.reset}</PushButton>}
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

  <ExportDialog open={showExport} onOpenChange={setShowExport}
    title={t.apps.xxx.name} code={exportCode} filename="xxx.html" />
</div>
```

完全サンプル（全コンポーネントのインポート含む）は `components/ui/README.md` §4 を参照。

## ダイアログボタンのスタイル統一
`FlatButton` を使う（raw `<button>` に生レシピ直書き禁止）。

```tsx
import { FlatButton } from "@/components/ui/flat-button";

<FlatButton variant="outline" onClick={close}>{t.close}</FlatButton>
<FlatButton onClick={copy}>{t.copy}</FlatButton>
```

コード出力ダイアログは `ExportDialog` 一発（close・.html DL・copy ボタンすべて内蔵）。

## 注意点
- Three.js は SSR 不可 → `useEffect` 内で `await import("three")` の動的インポートパターン
- Three.js で `preserveDrawingBuffer: true` はダウンロード用（`canvas.toDataURL()` に必要）
- Three.js v0.182 の色空間: `ColorManagement` がデフォルト有効。ShaderMaterial では `renderer.outputColorSpace = THREE.LinearSRGBColorSpace` を設定し、色は `hexToRGB()` で手動パースして `Float32Array` で渡す（`THREE.Color` の自動sRGB→リニア変換をバイパス）
- キャンバス上のドラッグ操作: パフォーマンスのため、ドラッグ中は React state をバイパスして uniform + DOM を直接更新し、ドラッグ終了時に state に反映するパターンを使用
- ダウンロード: `lib/canvas-download.ts` の `downloadCanvas`（canvas）/ `downloadBlob`（SVG等blob）を使用。デスクトップは `<a>` リンク、スマホ（`/iPhone|iPad|iPod|Android/i`）は Web Share API でシェアシート表示
- クリップボードコピー: `hooks/use-clipboard.ts` の `useClipboard(delay?)` を使用。`{ copy, copied }` を返す
- `hexToRGB`: `lib/color-utils.ts` から import。Three.js ShaderMaterial で色をfloat[]として渡す際に使用
- `next build` 中に `.next` キャッシュが壊れることがある → `rm -rf .next` で解消
- stale な next-server プロセスが port 3000 に残ると Internal Server Error になる → `kill -9 $(lsof -ti :3000)` で解消
- ドメイン: ムームードメインで `suna.design` を管理、`workbench` サブドメインを CNAME で Vercel に向けている
- **DragParam の蓄積バグ**: `currentValue.current` にスナップ済み整数を保存すると小さいデルタが蓄積できず値が固まる。`currentValue.current = rawNext`（生float）として保存し、`onChange(snap(rawNext))` でスナップは出力時のみ行う。外部 `value` からの更新はドラッグ中は無視（`if (!isDragging.current) currentValue.current = value`）
- **`.color-swatch`（カラーピッカー）**: `width: 28px; height: 28px; border-radius: 8px`（角丸チップ）を `globals.css` で定義済み。サイズを明示しないと潰れるので注意
- **Three.js ブレンドモード**: `SubtractiveBlending`（3）と `MultiplyBlending`（4）は `material.premultipliedAlpha = true` が必須（未設定だとコンソールエラー）。`NormalBlending`（1）と `AdditiveBlending`（2）は不要
- **Three.js AdditiveBlending と明るい背景**: `AdditiveBlending` は `bg + particle > 1.0` でクランプされ白くなる。明るい背景と組み合わせる場合は `NormalBlending` をデフォルトにする
- **シグナルノイズ波のキャンセル**: 複数レイヤーの位相オフセットに `(l / layers) * Math.PI * 2` を使うと `layers=2` で `sin(x) + sin(x+π) = 0` となり完全キャンセル。無理数オフセット `l * 0.9` を使うことで回避
- **QRドットモジュールの読み取り耐性**: ドット形状の基準半径はセル比 `r=0.5`（隣接円が接する）。サイズ変化（ジッター）はデータ/ECモジュールのみに適用し、**機能パターン（タイミング・アライメント・フォーマット情報）は `matrix.isReserved(row,col)` で常に r=0.5 を維持**（縮めるとデコーダがグリッドを見失う）。実測: jsQR（厳格）は変化 0.5（r≥0.39）まで、ZXing（実機相当）は変化 1.0（r≥0.28）でも読取可 → スライダーは 0–1 とし 0.6 超で注意ヒント表示。ロゴは上に被せず**交差モジュールをくり抜く**（knockout）方式 — パッド矩形は廃止済み、透過背景でもクリーンな空白になる。「QRコード」は商標 → 画面に「(株)デンソーウェーブの登録商標です」表記を常設（`t.qr.trademark`）

## Aurora固有の注意点
- **GLSL 9-tap ブラー**: `uBlur` uniform で `getShaderCol()` を9点サンプリングし `mask` との合成前に適用。CSS `canvas.style.filter` をシェーダーエフェクトに使うとマスク輪郭まで滲むので GLSL 内で処理する
- **CSS キャンバスブラー（シェイプぼかし）**: `canvasBlur` param → `renderer.domElement.style.filter = blur(Xpx)` で全体ぼかし。シェーダーブラーとは独立した別 param
- **Iconify Collection API**: `GET https://api.iconify.design/collection?prefix=material-symbols` の `data.icons` は配列ではなく `{name:{}}` のオブジェクト → `Object.keys(data.icons)` で名前一覧を取得。`-outline` / `-sharp` サフィックスを除外して基本バリアントのみ使用
- **MediaRecorder 動画書き出しパターン**:
  1. 録画前に `renderer.setPixelRatio(1); renderer.setSize(recW, recH, false)` で高解像度にリサイズ（`updateStyle:false` で表示サイズは変えない）
  2. `composite = document.createElement('canvas')` → `composite.captureStream(30)` → `MediaRecorder`
  3. RAF ループで `ctx2d.drawImage(glCanvas, 0, 0, w, h)` を composite に転写（canvasBlur は `ctx2d.filter` で適用）
  4. 録画終了後 `finally` ブロックで `renderer.setPixelRatio(dpr); renderer.setSize(origW, origH)` 復元
  5. MIME タイプは `['video/webm;codecs=vp9', 'video/webm', 'video/mp4'].find(isTypeSupported)` で検出、未対応なら `new MediaRecorder(stream)`（引数なし）でブラウザ既定を使う
  6. `recorder.onstop` で `recorder.mimeType`（実際の型）から拡張子を決定
- **書き出しポップアップは `OutputMenu` を使う**（pointerdown レースは内蔵処理済み）。カスタム行（動画書き出しなど）からは `useOutputMenuClose()` で close を取得

## アナリティクス
- **Vercel Analytics** 導入済み（`@vercel/analytics/react`）。`app/layout.tsx` に `<Analytics />` コンポーネント配置
- Vercelダッシュボード > プロジェクト > Analytics タブで閲覧（初回は有効化が必要な場合あり）

## ドットマップ固有の注意点
- **d3-geo**, **topojson-client** を使用（SSR不可 → `useEffect` 内で動的インポート）
- 陸地判定: GeoJSON → Canvas raster（8192px幅）に描画し、O(1)のピクセルルックアップで高速化
- 国ハイライト: 国別rasterを `useRef<Map>` でキャッシュ（遅延生成）
- TopoJSON（`public/data/world-110m.json`）のIDはゼロ埋め3桁文字列（例: `"032"`）。`COUNTRY_NAME_JA` マッピングは先頭ゼロなし → ルックアップ時に `String(Number(id))` で変換
- 国名は全て日本語（`COUNTRY_NAME_JA` に174カ国分のマッピング）
- Mercator投影の緯度範囲: -56° 〜 71°（高緯度の歪み回避のため意図的にクリップ）
