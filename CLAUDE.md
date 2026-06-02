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
components/
  app-top-bar.tsx     — 全アプリ共通トップバー（← 戻る ピル + <LangToggle>）`useLanguage()` 使用
  app-preview.tsx     — ホームカード用ライブキャンバスプレビュー（IntersectionObserver で遅延マウント。shader/gradient/aurora は実 GLSL、他は FPS 制限 Canvas2D）
  ui/                 — shadcn/ui（button, select, dialog, label, input — 全て zinc にリスタイル済み）
  ui/push-button.tsx  — フラットボタン（variant: dark=塗り / light=アウトライン / accent=緑、rounded-[10px]）
  ui/drag-param.tsx   — ドラッグでパラメーター変更するピル（左ラベル+グリップ / 右 値、API 据え置き）
  ui/toggle-switch.tsx — 緑(#0dca7a)ピルトグル（label 有→ピル行 / 無→スイッチのみ。size: sm/md）
  ui/color-row.tsx    — カラー行（label 左 / hex + .color-swatch 右）
  ui/lang-toggle.tsx  — JA/EN セグメンテッドトグル（iOS風。ホーム + AppTopBar で使用）
  ui/button-select.tsx — セグメンテッドセレクター（AAA BB CCC 型）
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
- アプリ背景 `bg-wb-50`、コントロールパネル `bg-wb-0`、`md:border-l md:border-wb-200`、`shadow-[0_-8px_24px_rgba(12,12,16,0.08)]`
- ボタンはフラット（`<PushButton>`）: 主アクション `variant="dark"`、副 `variant="light"`。3D 押し込みは廃止
- コード出力テキストエリア: `bg-wb-50 text-wb-900 border border-wb-200 rounded-[10px] font-mono text-[12px] focus-visible:ring-2 focus-visible:ring-wb-900`（コード/hex 値のみ font-mono を残す）
- カラーピッカー（`<input type="color">`）は `.color-swatch` クラス（globals.css で 8px 角丸・押し込みアニメ定義済み）
- ヘッダー帯: `flex items-center px-5 h-14 shrink-0 border-b border-wb-100` + タイトル `text-[16px] font-semibold text-wb-900`
- セクションタイトル: `text-[13px] font-semibold text-wb-700`（font-mono / uppercase は使わない）
- ネスト要素（子パラメーター）: `pl-3 border-l-2 border-wb-200`
- スクロール領域には `scrollbar-thin` を付与

## アプリ追加の手順
1. `app/apps/<app-name>/page.tsx` を作成
2. `app/page.tsx` の `APP_KEYS` 配列と `APP_HREFS` にエントリ追加
3. 必要に応じて `npx shadcn@latest add <component>` でUIコンポーネント追加
4. パラメーター操作は `DragParam`、トグルは `ToggleSwitch`、ボタンは `PushButton` を使用
5. ダウンロードは `downloadCanvas` / `downloadBlob`、クリップボードは `useClipboard` を使用
6. `lib/translations.ts` に新アプリのキーを追加し、`useLanguage()` で `t` を取得

## アプリ共通レイアウトパターン
ボタンラベルはブラケット `[ ]` を使わず素のテキスト（リニューアルで廃止）。リセットは原則フッターに `[リセット][主アクション]` 行で配置（フッターが複雑な多段エクスポートの場合のみヘッダーに残す）。
```tsx
import { AppTopBar } from "@/components/app-top-bar";

<div className="fixed inset-0 z-50 flex flex-col md:flex-row bg-wb-50">
  {/* キャンバスエリア */}
  <div className="h-[55vh] md:h-auto md:flex-1 relative min-w-0 shrink-0">
    {/* Three.js canvas / SVG preview */}
    <AppTopBar />  {/* ← 戻る ピル + JA/EN トグルを自動で出す */}
  </div>

  {/* コントロールサーフェス */}
  <aside className="flex-1 md:flex-none md:w-[320px] shrink-0 bg-wb-0 shadow-[0_-8px_24px_rgba(12,12,16,0.08)] md:shadow-none md:border-l md:border-wb-200 flex flex-col overflow-hidden">
    {/* ヘッダー（タイトルのみ） */}
    <div className="flex items-center px-5 h-14 shrink-0 border-b border-wb-100">
      <span className="text-[16px] font-semibold text-wb-900 select-none">{t.apps.xxx.name}</span>
    </div>
    {/* スクロール可能なパラメーターエリア */}
    <div className="flex-1 overflow-y-auto scrollbar-thin flex flex-col">
      {/* セクションごとに border-b border-wb-100 で区切る。セクション見出しは text-[13px] font-semibold text-wb-700 */}
    </div>
    {/* フッター（リセット + 主アクション） */}
    <div className="shrink-0 px-5 py-4 border-t border-wb-100 flex items-center gap-2.5">
      <PushButton variant="light" onClick={handleReset} className="flex-1">{t.reset}</PushButton>
      <PushButton variant="dark" className="flex-[2]" onClick={...}>{t.download}</PushButton>
    </div>
  </aside>
</div>
```

## ダイアログボタンのスタイル統一
shadcn `Button` は使わず、rawの `<button>` で以下のスタイル（ブラケット無し・sans）:
```tsx
// キャンセル・閉じる（副）ボタン
<button className="h-10 px-4 rounded-[10px] bg-wb-0 border border-wb-200 text-wb-900 text-[14px] font-medium hover:bg-wb-50 transition-colors select-none" onClick={...}>
  {t.close}
</button>
// アクション（コピー・ダウンロード等・主）ボタン
<button className="h-10 px-4 rounded-[10px] bg-wb-900 text-wb-0 text-[14px] font-medium hover:bg-wb-800 active:bg-wb-950 transition-colors select-none" onClick={...}>
  {t.copy}
</button>
```

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
- **ポップアップメニューと pointerdown の競合**: `document.addEventListener('pointerdown', closeHandler)` + 絶対配置ポップアップの組み合わせは、ボタン押下時に close → click で reopen するレースが起きやすい。フッターの書き出しボタンはポップアップを使わずインライン行レイアウトにする
- **フッター書き出しエリアのレイアウト**: ラベル列 `w-14 shrink-0` + ボタン `flex-1` の行 × 3（Image / Video / Code）。ボタンには `size="sm" whitespace-nowrap` を付ける

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
