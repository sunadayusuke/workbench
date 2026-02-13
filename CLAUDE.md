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
- **Three.js** — シェーダーアプリで使用
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
    shader/page.tsx   — WebGLシェーダーデザインツール（Three.js）
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

## 注意点
- Three.js は SSR 不可 → `useEffect` 内で `await import("three")` の動的インポートパターン
- Tailwind v4 の important 修飾子は `!` サフィックス（例: `bg-black/55!`）
- ドメイン: ムームードメインで `suna.design` を管理、`workbench` サブドメインを CNAME で Vercel に向けている
