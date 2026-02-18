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
`app/globals.css` に3層トークンシステム:
1. **プリミティブスケール** — `--gray-50` 〜 `--gray-950`（OKLCH、彩度ゼロのモノクロ）
2. **shadcn セマンティックトークン** — `--background`, `--foreground`, `--primary` 等
3. **カスタムトークン** — ステータス色、タイポグラフィ、レガシーエイリアス

テーマ: ライトモード（`<html className="light">`）。ダークモードのトークンも定義済み。

## ディレクトリ構成
```
app/
  layout.tsx          — ルートレイアウト（シンプル、サイドバーなし）
  page.tsx            — ホーム（アプリカード一覧）
  globals.css         — デザイントークン + ベーススタイル
  apps/
    color/page.tsx    — OKLCHカラースケール＆コントラストチェッカー
    shader/page.tsx   — パーリンノイズ背景デザインツール（Three.js）
    image/page.tsx    — 画像補正＆エフェクトツール（Three.js + WebGLシェーダー）
    gradient/page.tsx — メッシュグラデーションツール（Three.js + WebGLシェーダー）
    particle/page.tsx — パーティクルアニメーションツール（Three.js + Points + ShaderMaterial）
    dotmap/page.tsx   — ドット世界地図SVGジェネレーター（d3-geo + topojson-client、Canvas raster方式）
components/
  ui/                 — shadcn/ui コンポーネント（button, slider, select, dialog, label, separator, sheet）
lib/
  utils.ts            — cn() ユーティリティ
```

## アプリ追加の手順
1. `app/apps/<app-name>/page.tsx` を作成
2. `app/page.tsx` の `apps` 配列にエントリ追加
3. 必要に応じて `npx shadcn@latest add <component>` でUIコンポーネント追加

## スタイリングルール
- **Tailwind CSS のみ使用**（CSS Modules は使わない — 統一済み）
- Tailwind で表現できない擬似要素スタイル等は `globals.css` の `@layer base` に記述
- shadcn/ui コンポーネントにはカスタムで `cursor-pointer`, `active:scale-[0.97]` 等のインタラクションを追加済み

## UI言語
全テキスト日本語。

## レスポンシブ対応
- 全ページ対応済み。ブレークポイントは `md:` (768px)
- 各アプリのレイアウト: モバイルは `flex-col`（キャンバス60vh + 設定パネル40vh）、デスクトップは `flex-row`（キャンバス + サイドバー）
- モバイル時の設定パネルには上方向シャドウ（`shadow-[0_-8px_24px_...]`）でレイヤー感を出す
- ホーム: ヘッダーはモバイルで縦積み、デスクトップで横並び

## アプリ共通レイアウトパターン
- トップバー: 戻るボタン（全ページ `backdrop-blur-xl` 付き。暗背景は `bg-black/55!`、明背景は `bg-white/75!`）
- サイドバー: ヘッダーにタイトル + リセットボタン（`<Button variant="secondary" size="sm">`）、設定スライダー群 + アクションボタン（CSS出力 / ダウンロード等）を最下部に配置
- ネスト要素: 親パラメータが有効な時だけ子オプションを表示（`pl-3 border-l-2 border-border`）
- 背景透過トグル: パーティクル・ドットマップで使用。ONでチェッカーボードプレビュー表示

## 注意点
- Three.js は SSR 不可 → `useEffect` 内で `await import("three")` の動的インポートパターン
- Three.js で `preserveDrawingBuffer: true` はダウンロード用（`canvas.toDataURL()` に必要）
- Three.js v0.182 の色空間: `ColorManagement` がデフォルト有効。ShaderMaterial では `renderer.outputColorSpace = THREE.LinearSRGBColorSpace` を設定し、色は `hexToRGB()` で手動パースして `Float32Array` で渡す（`THREE.Color` の自動sRGB→リニア変換をバイパス）
- ShaderMaterial でカスタムシェーダーを書く場合、`THREE.Color` のuniformは色空間変換が入るため、`float[]` 配列で直接渡す方が安全
- キャンバス上のドラッグ操作: パフォーマンスのため、ドラッグ中は React state をバイパスして uniform + DOM を直接更新し、ドラッグ終了時に state に反映するパターンを使用
- ダウンロード: デスクトップは `canvas.toDataURL()` + `<a>` で直接ダウンロード、スマホ（`/iPhone|iPad|iPod|Android/i`）のみ Web Share API でシェアシート表示
- `next build` 中に `.next` キャッシュが壊れることがある → `rm -rf .next` で解消
- Tailwind v4 の important 修飾子は `!` サフィックス（例: `bg-black/55!`）
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
