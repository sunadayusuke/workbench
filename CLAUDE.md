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
- **Three.js** — シェーダーアプリ・画像加工アプリで使用
- フォント: **LINE Seed JP**（CSS `@import` で読み込み。next/font/google は非対応だった）

## デザインシステム
`app/globals.css` に4層トークンシステム:
1. **プリミティブスケール** — `--gray-50` 〜 `--gray-950`（OKLCH、彩度ゼロのモノクロ）
2. **shadcn セマンティックトークン** — `--background`, `--foreground`, `--primary` 等
3. **カスタムトークン** — ステータス色、タイポグラフィ、レガシーエイリアス
4. **物理UIトークン** — アルミ筐体・キャップカラー・LED 用

```css
/* 物理UIトークン（globals.css） */
--aluminum-light: #e8e8e9;
--aluminum-mid:   #d8d8da;
--aluminum-dark:  #c8c8ca;
--aluminum-border:#bbbbbe;
--screen-bg:      #080808;
--cap-blue:       #1e3246;
--cap-ochre:      #b59257;
--cap-grey:       #858585;
--cap-orange:     #e84a1b;
--cap-white:      #f0f0f2;
--led-green:      #4af626;
--socket-bg:      #d0d0d2;
```

テーマ: ライトモード（`<html className="light">`）。ダークモードのトークンも定義済み。

## ディレクトリ構成
```
app/
  layout.tsx          — ルートレイアウト（LanguageProvider でラップ）
  page.tsx            — ホーム（アプリカード一覧、アルミラック風）
  globals.css         — デザイントークン + ベーススタイル + .color-swatch
  apps/
    color/page.tsx    — OKLCHカラースケール＆コントラストチェッカー
    shader/page.tsx   — パーリンノイズ背景デザインツール（Three.js）
    image/page.tsx    — 画像補正＆エフェクトツール（Three.js + WebGLシェーダー）
    gradient/page.tsx — メッシュグラデーションツール（Three.js + WebGLシェーダー）
    particle/page.tsx — パーティクルアニメーションツール（Three.js + Points + ShaderMaterial）
    dotmap/page.tsx   — ドット世界地図SVGジェネレーター（d3-geo + topojson-client、Canvas raster方式）
    easing/page.tsx   — ベジェカーブエディター＆アニメーションプレビュー
components/
  ui/                 — shadcn/ui コンポーネント（button, slider, select, dialog, label, separator）
  ui/push-button.tsx  — 物理プッシュボタン（variant: light/dark/accent、押し込みアニメーション）
  ui/drag-param.tsx   — ドラッグ操作でパラメーター変更するラベル+値表示コンポーネント
  ui/toggle-switch.tsx — LED付きトグルスイッチ（size: sm/md）
  ui/knob.tsx         — ロータリーノブ（color: blue/ochre/grey/orange/white）
  ui/led-button.tsx   — LED トグルボタン
  ui/physical-fader.tsx — 縦型フェーダー
  ui/param-slider.tsx — 旧スライダーコンポーネント（gradient/page.tsx で一部使用）
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
- 各ページで `const { lang, toggle, t } = useLanguage()` を使用
- トップバーの `[ JA | EN ]` ボタンで `toggle()` を呼ぶ
- 翻訳キーを追加するときは `Translations` interface / `ja` / `en` の3か所に追加する
- ボタンテキストは `[ {t.xxx} ]` 形式（角括弧含む）で統一

## アプリ追加の手順
1. `app/apps/<app-name>/page.tsx` を作成
2. `app/page.tsx` の `apps` 配列にエントリ追加
3. 必要に応じて `npx shadcn@latest add <component>` でUIコンポーネント追加
4. パラメーター操作は `DragParam`、トグルは `ToggleSwitch`、ボタンは `PushButton` を使用
5. ダウンロードは `downloadCanvas` / `downloadBlob`、クリップボードは `useClipboard` を使用
6. `lib/translations.ts` に新アプリのキーを追加し、`useLanguage()` で `t` を取得

## スタイリングルール
- **Tailwind CSS のみ使用**（CSS Modules は使わない）
- Tailwind v4 の important 修飾子は `!` サフィックス（例: `bg-black/55!`）
- 物理UI共通: アルミ背景 `bg-[linear-gradient(180deg,#e8e8e9,#d8d8da)]`、ボーダー `border-[#bbbbbe]`
- ボタン押し込み: `box-shadow:0_3px_0_#b8b8bc` → active 時 `translateY(3px)` + shadow消去
- 暗色インプット（コード出力・数値入力）: `bg-[#1a1a1a] text-[#e0e0e2] border-[rgba(0,0,0,0.5)] [box-shadow:inset_0_1px_4px_rgba(0,0,0,0.35)]`
- カラーピッカー（`<input type="color">`）は `.color-swatch` クラスを付与（globals.css で丸型・押し込みアニメ定義済み）
- セクションタイトル: `text-[14px] font-mono uppercase tracking-[0.14em] text-[#777]`
- ネスト要素（子パラメーター）: `pl-3 border-l-2 border-[#bbbbbe]`

## アプリ共通レイアウトパターン
```tsx
<div className="fixed inset-0 flex flex-col md:flex-row bg-[#d8d8da]">
  {/* キャンバスエリア */}
  <div className="h-[55vh] md:h-auto md:flex-1 relative">
    {/* Three.js canvas / SVG preview */}
    {/* トップバー（絶対配置） */}
    <div className="absolute inset-x-0 top-0 flex justify-between p-3 z-10 pointer-events-none [&>*]:pointer-events-auto">
      <Link href="/"><PushButton variant="dark" size="sm">[ {t.back} ]</PushButton></Link>
      <PushButton onClick={toggle} variant="dark" size="sm">[ {lang === "ja" ? "EN" : "JA"} ]</PushButton>
    </div>
  </div>

  {/* コントロールサーフェス */}
  <aside className="md:w-[320px] bg-[linear-gradient(180deg,#e8e8e9,#d8d8da)] border-l border-[#bbbbbe] flex flex-col">
    {/* ヘッダー */}
    <div className="flex items-center justify-between px-5 h-12 border-b border-[rgba(0,0,0,0.12)]">
      <span className="text-[14px] font-mono uppercase tracking-[0.22em] text-[#333]">{t.apps.xxx.name}</span>
      <PushButton size="sm" variant="dark" onClick={handleReset}>[ {t.reset} ]</PushButton>
    </div>
    {/* スクロール可能なパラメーターエリア */}
    <div className="flex-1 overflow-y-auto flex flex-col">
      {/* セクションごとに border-b border-[rgba(0,0,0,0.08)] で区切る */}
    </div>
    {/* アクションボタン（固定フッター） */}
    <div className="shrink-0 px-5 py-4 border-t border-[rgba(0,0,0,0.12)]">
      <PushButton variant="dark" className="w-full text-center">[ {t.download} ]</PushButton>
    </div>
  </aside>
</div>
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
