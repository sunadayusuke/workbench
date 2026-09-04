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
    compress/page.tsx — 画像圧縮・形式変換 + PDF圧縮 + 動画圧縮ツール（UPNG + JSZip + pdf-lib + mediabunny/WebCodecs + ffmpeg.wasm fallback、全処理クライアントサイド）
    qr/page.tsx       — スタイルドQRコードジェネレーター（qrcode + 自前SVGレンダラー、jsQRで読取検証済み）
    webp/page.tsx     — WebPコンバーター（動画/コマ画像→アニメーションWebP。canvas.toBlob + 自前RIFF/ANMFマキサー、Safari は libwebp wasm フォールバック、Pillow検証済み）
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
  ui/removable-row.tsx — ColorRow と同じピル外殻のラベルのみ行（× 削除のみ・色なしリスト用）
scripts/
  ds-lint.mjs         — デザインシステム逸脱検出リンター（`npm run lint:ds`、build でも実行）
lib/
  utils.ts            — cn() ユーティリティ
  color-utils.ts      — hexToRGB()（Three.js ShaderMaterial 向け色変換）
  canvas-download.ts  — downloadCanvas() / downloadBlob()（モバイル/デスクトップ分岐）
  pdf-compress.ts     — compressPdf()（pdf-lib で画像XObjectを再圧縮するPDF軽量化。compress アプリ専用）
  video-compress.ts   — compressVideo()（WebCodecs + mediabunny で MP4/MOV を AV1/H.264 MP4 に再エンコード。compress アプリ専用）
  video-compress-ffmpeg.ts — WebCodecs 非対応環境・デコード不能入力用フォールバック（ffmpeg.wasm。ワーカーは public/ffmpeg/ から自己ホスト）
  webp-anim.ts        — アニメーションWebPのマキサー/デマルチプレクサ（RIFF/ANMF 自前構築・解析。純関数・ブラウザAPI非依存で Node でも動く。webp / compress 共用）
  webp-encode.ts      — 静止 WebP のフレームエンコーダ（canvas.toBlob 主経路 + Safari 用 自己ホスト libwebp wasm。webp / compress 共用）
  video-to-webp.ts    — 動画/画像列→アニメWebP のオーケストレーター（フレーム抽出 + 重複コマ統合 + 背景透過キーイング。webp アプリ専用）
  webp-anim-compress.ts — アニメWebP の再圧縮（デマルチプレクス → 純関数合成 → 差分矩形の再エンコード → 再結合。compress アプリ専用）
  app-previews/       — ホームカードプレビューの実装（アプリごとに1ファイル。components/app-preview.tsx から遅延ロード）
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
  <div className="h-[35vh] md:h-auto md:flex-1 relative min-w-0 shrink-0">  {/* モバイル: view 3 / aside 7 で全アプリ統一 */}
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

## コンプレッサー（compress）固有の注意点
- **PDF圧縮は `lib/pdf-compress.ts` の `compressPdf()`**。Acrobat の「ファイルサイズを縮小」と同方針で、PDFオブジェクトツリーを走査し**埋め込み画像XObjectのみを再圧縮**（ダウンサンプル + JPEG再エンコード）して差し替える。**テキスト・ベクターのコンテンツストリームは一切触らない**ので文字は選択可能・シャープなまま残る（実測: 画像主体PDFで balanced 約 −60%、出力は3ページPDFとして再オープン可・テキスト Tj オペレータ保持を検証済み）
- ページのラスタライズ方式は**採らない**（テキストが画像化されるため）。あくまで画像ストリーム差し替え
- **透過の扱い（最重要・"画像が消える"バグの核心と修正）**: 再圧縮ループ前に「他画像から `/SMask`・`/Mask` で参照される ref」を集める **maskRefs プリパス**を実行し、**ソフトマスク/マスク本体は絶対に再圧縮しない**（=1成分 DeviceGray のまま保持）。理由: ソフトマスクを3成分 DeviceRGB JPEG に書き換えると無効マスクになり、厳格なビューア（Preview/Acrobat）が**親画像ごと描画しなくなる**（= 画像が消える）。**バグの原因はこれ**。pdf-lib の `embedPng` はSMaskに `/Decode` を付けるため合成テストでは偶然踏まず、実PDFのSMaskは `/Decode` なしが多く確実に踏む
- **透過画像のベース（色）は再圧縮する（Acrobat同等）**: `/SMask` または stream `/Mask` を**持つ**ベース画像は、色データを JPEG 再エンコードして圧縮するが **ダウンスケールはしない**（`{...preset, maxEdge:0}`）。寸法を変えないことで、触っていないグレーマスクと整合が保たれる（マスク参照は新dictへ引き継ぐ）。これで透過画像も大きく縮む（実測: Flate-RGB 819KB → JPEG 35KB、PDF全体 1.01MB → 254KB ≈ −76%、base×alpha 合成の可視性は前後で不変）。**色キー `/Mask`（PDFArray）を持つ画像はスキップ**（ロッシー再エンコードでキー色がずれるため）
- 対応する画像フィルタ: **単一フィルタのみ**（`/Filter` が配列＝多段フィルタはスキップ）。**DCTDecode**（ストリームがそのままJPEG → `createImageBitmap`）と **予測子なしの FlateDecode**（`DecompressionStream('deflate')` で展開、`raw.length === W*H*comps` の**完全一致**のみ採用＝偽りの ICCBased N で4成分が混入する事故を排除）。`colorComponents` は DeviceRGB/DeviceGray と ICCBased(N∈{1,3}) のみ許可（CalRGB/CalGray/Indexed/Separation/DeviceN/Lab はスキップ）。`createImageBitmap` の SOF を見て **4成分(CMYK) JPEG はスキップ**。`/Decode` 配列付き / ImageMask も**安全側でスキップ**（原本維持）
- 各画像は try/catch で囲み、失敗時は原本を残す。再エンコード後が元より大きければ差し替えない。`doc.save({useObjectStreams:true})` 後に**再度 `PDFDocument.load` で開いてページ数一致を検証**し、壊れていれば**元ファイルをそのまま返す**。元サイズ以上でも元ファイルを返す（決して肥大化／破損させない）
- 色空間は再エンコード後 `DeviceRGB` 固定。透過画像のベースは `/SMask`・`/Mask`(ref) を新dictへ引き継ぐ
- 検証方法メモ: プレビューsandboxでは pdf.js のラスタライズも `<iframe>` 内ネイティブPDFレンダリングも動かない。画像ストリームを pdf-lib で取り出し `createImageBitmap`/`DecompressionStream` で直接デコードする「分離デコード検証」＋ `/Length` とストリーム実バイト数の一致確認＋手組みPDF（`/Decode` なしの DeviceGray SMask）での再現/回帰＋**base×alpha 合成キャンバスの可視性比較**で代替した
- **dev 起動中に `npm run build` を回すと共有 `.next` が壊れて Internal Server Error になる**（既知）。dev とビルドは同時に走らせない。復旧は dev サーバー再起動（`.next` 再生成）、それでも駄目なら `rm -rf .next`
- pdf-lib は SSR 不可ではないが**動的 import**（`await import("pdf-lib")`）で初期バンドルから外す。型は `import type { PDFDict as TPDFDict }` を使う（`InstanceType<typeof PDFDict>` は protected constructor で TS エラー）
- **プリセットはDPIダウンサンプルが主レバー（Acrobat準拠）**: 単なる品質差(0.72/0.55/0.42)＋高すぎるピクセル上限だと、よくある〜1600px画像では解像度が落ちず差が小さい（実測 high64/balanced51/max37KB程度）。そこで**ページのコンテンツストリームをミニ解釈（q/Q/cm/Do とForm XObjectの再帰、CTMから画像の実表示サイズpt算出）** → `effDpi = px*72/表示pt` → プリセット目標DPIへダウンサンプル。`PRESETS` は `{quality, dpi, maxEdgeFallback}`（Acrobat准拠 Print/eBook/Screen: high:0.85/300dpi、balanced:0.6/150dpi、max:0.38/72dpi）。表示サイズ不明時のみ `maxEdgeFallback` を使用。プリセット差を出すには **high のDPIを高め(=潰しすぎない)・max を低め**にしてレンジを広げるのが要点（200dpi 等で high も攻めると全プリセットが潰れて差が出ない）。**透過ベースは寸法維持のため目標DPIを適用せず（maxEdge=0）品質のみ**。コンテンツ解釈は try/catch で全面ガード（失敗してもサイズ推定が外れるだけ＝破損しない、fallbackへ）。実測: 1600px@230dpi の画像が high1389px/balanced903px/max583px、12.8〜58.9KB と明確に差が出る
- UI: PDFは `kind:"pdf"` として扱い、サムネは "PDF" グリフ。画像形式セレクトは「キュー内が全てPDFのとき」隠す。PDF品質セレクトは high/balanced/max の3プリセット

### 動画圧縮（compress の video 対応）
- **主経路は WebCodecs + mediabunny（v1.51+、`lib/video-compress.ts` の `compressVideo()`）**。ブラウザ内蔵エンコーダーで MP4/MOV を再エンコードし、**AV1 で H.264 比 −60%前後**（実測: 同条件で AV1 193KB vs H.264 526KB）。mediabunny は pure TS/ESM で**動的 import**（初期バンドル外・ランタイムDL なし・COOP/COEP 不要）。出力は MP4 固定（fastStart "in-memory"、音声 AAC 160k/128k/96k）
- 新 API: `compressVideo(file, { quality: high|balanced|max, format: auto|h264, resolution: 0|1440|1080|720|480, removeAudio: boolean }, onProgress)`。`removeAudio` は mediabunny 側 `audio:{discard:true}`（discardedTracks の `reason==="discarded_by_user"` は正常扱い）/ ffmpeg 側 `-an`。**音声削除時は AAC エンコード可否チェックもスキップ**するので Firefox でも WebCodecs 経路に乗れる。UI は品質セレクト下の ToggleSwitch「音声を削除」。`format:"auto"` は `getFirstEncodableVideoCodec(["av1","vp9","avc"])` の先頭、`"h264"` は avc 固定。品質は mediabunny の `QUALITY_HIGH/MEDIUM/LOW`（コーデック・解像度・fps を考慮したビットレート算出。**quantizer/CRF 指定は Conversion API に存在しない**ので不採用が確定判断）。`bitrate` を明示すると同コーデック入力でも必ず再エンコードされる（素通し remux で無圧縮になる事故を回避、mediabunny src/conversion.ts で裏取り済み）
- **解像度は短辺キャップ**（`fitShortSide`、アップスケールなし・偶数丸め）。縦動画は幅がキャップされる（旧実装の「高さ literal キャップで縦動画が過剰縮小」を解消）。寸法は `getDisplayWidth/Height()`（回転・PAR 適用後）基準なので iPhone の回転メタデータ付き MOV も正しい
- UI は Select 3つ（出力形式 auto/h264、解像度 デフォルト1080p、品質 デフォルトbalanced）。設定変更で全キュー再処理（gen ガードで stale 結果破棄）
- **フォールバックは `lib/video-compress-ffmpeg.ts`（旧実装を移設）**。発火条件: WebCodecs なし / 対象コーデックがエンコード不可 / **音声トラックありで AAC エンコード不可（Firefox がこれ。無音化事故防止）** / mediabunny 経路の実行時エラー（ProRes 等のデコード不能含む）。Conversion init 後に video/audio の discardedTracks があれば throw してフォールバックへ
- **COOP/COEP ヘッダーは追加しない方針**（サイト全体に効き BMC ウィジェット等の外部埋め込みを壊すため）→ ffmpeg はシングルスレッド core を使用。SharedArrayBuffer 不要
- **ffmpeg.wasm を Next.js/Turbopack で読み込む3つの罠（重要・ここでかなりハマった。現物は `lib/video-compress-ffmpeg.ts`）**:
  1. **ワーカーをバンドルさせない**: 既定の `new Worker(new URL("./worker.js", import.meta.url), {type:"module"})` を Turbopack が解析すると、worker 内の動的 `import(coreURL)` で **`Cannot find module as expression is too dynamic`** ビルドエラー。回避策として **ESM ワーカー3ファイル（`worker.js`/`const.js`/`errors.js`）を `public/ffmpeg/` に自己ホスト**し、`classWorkerURL` に**変数の絶対URL**（`` `${window.location.origin}/ffmpeg/worker.js` ``）を渡す。リテラル `new URL("./worker.js",…)` でなく変数なら Turbopack はバンドルを試みない
  2. **UMD ワーカー（`814.ffmpeg.js`）は使えない**: それを `classWorkerURL` に渡すと module ワーカー化され、内部の core ロードが **webpack 内部 require** になり外部 blob を解決できず **`Cannot find module 'blob:…'`**。→ **ESM ワーカー**（native `import()`）でなければ外部 core を読めない
  3. **core は ESM 版**: ワーカーは module worker なので `import(coreURL).default` で読む。`@ffmpeg/core@0.12.9/dist/**esm**/ffmpeg-core.js`（末尾 `export default createFFmpegCore`）を使う。**UMD core は `export default` が無く `.default` が undefined になり失敗**。`coreURL`/`wasmURL` は `toBlobURL()` で同一オリジン blob 化（COEP 不要のため）
- ffmpeg core（約30MB）はモジュールレベルのシングルトンで**初回のみ CDN(unpkg) から読み込み**、キュー全体で使い回す（`getFFmpeg()`）。失敗時は `loadPromise=null` でリトライ可能。CRF は high 23 / balanced 28 / max 31、短辺キャップは `scale=if(gt(iw\,ih)\,…)` 式（カンマは `\,` エスケープ必須）
- 進捗: mediabunny は `conversion.onProgress`（0–1）、ffmpeg は `ff.on("progress", …)` を `onProgress` に転送（キューは逐次処理なのでグローバル progress = 現在の item）。UI は `変換中 NN%` 表示
- 各動画は try/catch、再エンコードが元サイズ以上なら**原本をそのまま返す**（`ext` は元拡張子）＝決して肥大化させない。動画は `VIDEO_MAX_SIZE=300MB`（mediabunny の BufferTarget も ffmpeg.wasm もメモリバウンド）で画像/PDF の 100MB とは別枠
- **検証メモ（2026-07 更新）**: ブラウザペインのタブは `visibility:hidden` になりがちで **rAF が回らず MediaRecorder でのフィクスチャ生成は不可**（ほぼ空の webm になる）。代わりに **mediabunny 自体（esm.sh から import）+ OffscreenCanvas + CanvasSource で本物の H.264 MP4 をリアルタイム非依存で合成**し、`DataTransfer` 経由で file input に注入する。注意2点: (1) ページ realm に esm.sh コピーを import すると「Mediabunny was loaded twice」警告が出る（`Symbol.for` によるグローバル検出。アプリ実害なし・検証アーティファクト）→ 隔離したいなら iframe realm で生成、(2) **iframe で作った File は iframe を remove すると実体が無効化される** → `arrayBuffer()` で親 realm にコピーしてから捨てる。出力検証は「バイト列に av01/avc1/mp4a があるか + moov が mdat より前（fastStart）」+ **`<video>` で実デコードして寸法と中間フレームの画素を入力と比較**（実測: 平均差 1.89/255）。実測値: 8Mbps H.264 1080p 3s 2.35MB → AV1 1080p 394KB(−83.6%) / AV1 720p 193KB(−92%) / H.264 720p 526KB(−78.1%)

### アニメーション WebP（compress の webp 対応）
- **compress にアニメ WebP を入れると静止画になっていた原因は `createImageBitmap(file)`**（先頭コマだけ返す）。対応は `lib/webp-anim-compress.ts` の `compressAnimatedWebP(file, {quality}, onProgress)`。キュー側で先頭バイトの VP8X アニメフラグ（`isAnimatedWebP`）を見て、**出力形式が webp に解決されるときだけ**この経路（jpeg/png 指定なら従来どおり静止画）
- 中身: `parseAnimatedWebP`（ANMF デマルチプレクサ。X/Y は格納値×2、blend/dispose フラグ、ALPH/`VP8 `/VP8L 以外のサブチャンクと ICCP/EXIF/XMP は読み飛ばし）→ 各コマを `wrapFrameAsStillWebP` で単独 WebP に包んで `createImageBitmap` → **合成は canvas ではなく純関数（RGBA 配列）**で、WebP 仕様の非 premultiplied source-over と dispose（libwebp `anim_decode.c` と同じく ANIM 背景色は無視して透明化）を実装 → libwebp の合成結果と maxDiff=0 で一致。**直前状態との差分 bbox（x,y は偶数に切り下げ）だけを再エンコードし、no-blend/dispose-none の置換で mux** するので、alpha-blend の多段再圧縮による世代誤差が蓄積しない。変化なしコマは直前コマの duration に統合。膨張時は原本を返す
- マキサー（`buildAnimatedWebP`）はコマごとの `durationMs` と任意の `x/y/width/height`（x,y は偶数必須）に対応。共有フレームエンコーダは `lib/webp-encode.ts`（toBlob 主経路 + Safari 自己ホスト wasm。video-to-webp.ts と共用）
- **画像品質プリセット `IMAGE_QUALITY`**（high 0.9 / PNG ロスレス、balanced 0.8 / 128 色 = 従来の固定値、max 0.65 / 64 色）を追加。**q80 で作った WebP を balanced（q80）で再圧縮しても縮まない**（実測 −0.9%）ので、縮めたいときは max
- 実測: Pillow（`minimize_size=True`）製の部分矩形 + alpha-blend + dispose 入力（6 コマ）→ **−37%**、透過版 → −13%、いずれも再生タイムライン一致（合成画素差 ≤ 0.55/255）。自前ツール出力 63 コマ → コマ数・loop・合計時間を保持
- 検証: `.claude/tmp/webp-tests/e2e/compare-anim.py <in> <out>`（入力の各コマ中点時刻で出力側の合成画素を比較。統合でコマ数が減ってもよい）。**dev の React StrictMode では `addFiles` の `setItems(prev => …)` 内の `createObjectURL(file)` が 2 回呼ばれる**（更新関数の二重実行。本番は 1 回）ので、blob フックで出力を数えるときは `instanceof File` で除外する
- GIF 入力は従来どおり静止 PNG（デコーダが必要。将来課題）

## WebPコンバーター（webp）固有の注意点
- **アニメーションWebP をブラウザで直接書き出す API は存在しない** → フレームごとの静止 WebP を `lib/webp-anim.ts` の自前マキサー（RIFF/VP8X/ANIM/ANMF）で連結する。マキサーは純関数・ブラウザAPI非依存（Node でそのまま動く＝Pillow と組み合わせてユニット検証可能）
- **マキサー最大の罠は奇数ペイロードの偶数パディング**: チャンクのペイロードが奇数長なら 0x00 を1バイト詰めて偶数境界に揃えるが、**サイズフィールドにはパディングを含めない**。忘れると「一部のデコーダでだけ壊れる」。FourCC `VP8 ` は**末尾半角スペース**（`'VP8'` 前方一致だと `VP8L` に誤マッチ）。ANIM の loopCount は uint16LE で **0=無限**。ANMF の X/Y は仕様上「実座標÷2」で格納
- **フレームエンコードの経路**: 主経路 `canvas.toBlob('image/webp')`（Chrome/Edge/**Firefox 96+**）。**blob.type の検証必須**（非対応ブラウザは PNG に静かにフォールバックする）。Safari は `@jsquash/webp`（libwebp wasm、Squoosh 由来）にフォールバック。実行時の経路選択は毎回 `toDataURL('image/webp')` プローブ
- **@jsquash/webp を runtime import してはいけない（ffmpeg と同型の Turbopack 罠）**: `import("@jsquash/webp")` は `npm run build`（webpack/Turbopack とも）は通るが、**dev の Turbopack ランタイムで内部の `import('./codec/enc/webp_enc_simd.js')` が破綻**する（`import.meta.url` が file:// に化けて `net::ERR_FILE_NOT_FOUND` + Emscripten グルーの `Identifier 'Module' has already been declared`、しかも import() が reject せず **uncaught でハング**）。→ **`webp_enc(.simd).js/.wasm` 4ファイルを `public/jsquash-webp/` に自己ホスト**し、**変数URLの native import**（`` `${window.location.origin}/jsquash-webp/webp_enc_simd.js` ``）で `.default` factory を取得。`locateFile` は渡さない（グルーが `import.meta.url` 基準で同ディレクトリの .wasm を自力解決する）。SIMD 判定は wasm-feature-detect と同一のプローブバイト直書き。パッケージは devDependencies に **exact pin（コピー元専用・runtime import ゼロ）**。CDN は使わない（「全処理ブラウザ内・外部送信なし」がこのアプリの前提）
- **Blink は `toBlob` の quality 1.0 を lossless（VP8L）として扱う** → サイズが不連続に跳ね、wasm 経路（lossy のまま）と挙動が割れるため、canvas 経路のみ quality を 0.995 上限にクランプ
- フレーム抽出は `<video>` シーク方式（`seeked` を1回ずつ await、`duration - 0.0001` エスケープ、5秒タイムアウト）。キーフレーム間隔によっては同じ絵が続きうるが GIF 代替用途では許容（rVFC 全フレーム取得は将来の改善候補）
- 画像モード（コマ画像→アニメ）: ファイル名の**自然順ソート**（`localeCompare` numeric）、キャンバスは1枚目基準、異寸は contain 中央配置・**余白は透明のまま**（ALPH 付きフレーム → マキサーが VP8X のアルファフラグ 0x10 を自動で立てる）
- **サイズは原理的に動画より大きい**（全コマ独立圧縮。AV1 24fps 8s 232KB → 12fps 96コマで 1.64MB）。効くレバーの実測: **重複コマの統合 −34%**（後半が静止する AI 生成動画では 96 コマ中 33 が直前採用コマと同一。4px ストライド・チャンネル差 >12 の画素が 0.5% 未満なら同一とみなし、エンコードせず直前コマの表示時間を延長 = ANMF はコマごと duration）/ fps 12→8 −33% / 解像度 720→480 −55% / 品質 80→70 −21%。**差分矩形（変化 bbox だけ記録）は毛が全面で揺れる素材だと効果 9%、高圧縮 method 6 は −3%** で不採用。重複判定は**キーイング前の RGB** で行う（アルファは色の関数で独立情報がなく、含めると境界ノイズで統合率が 33→25 に落ちた）
- **背景透過（クロマキー）の正解は「外周からの領域拡張 + 正規化 Color-to-Alpha」**。固定幅ソフト帯 `dist∈[t0, t0+soft]` 方式は (1) キャラ内部の白〜クリーム（目・歯・本のページ）も抜ける（実測ページの 71% が半透明）、(2) アルファが実際の混合率と合わず白フリンジが残る（半透明画素の平均色 (239,218,185)・白寄り 87%。エンコード前の PNG でも同じ = 圧縮ではなく式の問題）。正解: 画像の外周にある「背景に近い画素」から BFS で連結領域を拡張 → 領域内のみ `α = maxₙ |Pₙ−Bₙ| / max(Bₙ, 255−Bₙ)` を `[tLow, 0.9]` で線形リスケール、色は `(P − B(1−α)) / α` で厳密アンブレンド。実測: ページ 100% 不透明・半透明エッジ平均 (208,96,15)=オレンジ・白寄り 0%・サイズ差なし・12ms/コマ。**GIMP 原式 `(P−B)/(255−B)` は B≈253 のとき 254 のノイズで α=0.5 になり破綻**するので正規化を変えている。許容度 UI は tLow（背景ノイズの切り捨て、既定 0.10。上限 0.9 は `KEY_SOLID_DISTANCE` 定数）。**領域拡張は 2 段階**（2026-09 修正）: (1) 外周から `distance < KEY_PASS_DISTANCE (0.5)` の画素だけを flood → (2) そこから**距離が単調に増える方向にだけ**登る（`KEY_ASCENT_EPS` 以上増える近傍のみ、上限 0.9）。当初は「distance < 0.9 なら通過」の 1 段階だったが、**圧縮や動きでグレー化した輪郭線（距離 0.5〜0.9）を flood がすり抜けて顔の内側の白（目・歯）まで抜ける**バグがあった（マスコット動画で内部白の漏れ 100%、コマごとにムラ）。単調登りは背景→輪郭のグラデーションは登れるが輪郭を越えて内側へ降りられないので漏れず（漏れ 0.4%）、毛のような柔らかいエッジのアンブレンドも維持できる（単純な 1px 膨張だと縁 13,087px が取り残された）。**既知のトレードオフ**: **背景に近いパステル色の被写体（距離 0.5 未満: 肌色 d≈0.25・水色 d≈0.32）が外周の背景と直接接していると flood に食われて半透明化・色シフトする**（Color-to-Alpha の原理的な限界。距離 0.5 以上の被写体は 2 段階化で縁の数 px しか影響しなくなった）。実写・パステル系で問題になったら `KEY_PASS_DISTANCE` を tLow 相対にするか「ソフトネス」を UI に出す。実装は `lib/video-to-webp.ts` の `keyBackground()`（ImageData 非依存の純関数 → `.claude/tmp/webp-tests/keying-test.ts` で Node 検証）。背景色は `detectBackgroundColor()`（外周 2 リングの最頻色）で自動検出
- 透過のサイズコスト: アルファ面（ロスレス）の追加で、毛のように輪郭が長いキャラは **+80〜110%**（ハードエッジなら +25%）。libwebp の alpha_quality を落としても −9% 程度で割に合わない。透明画素の RGB を近傍色で埋める dilation は効果ゼロ（exact=0 のクリーンアップで既に足りている）
- 色: 変換自体の色差はキャラ部分で平均 1.2/255（毛のオレンジは前後で同一）。「動画と色が違う」と感じる場合の容疑は `<video>` 要素の表示経路（macOS は BT.709 動画を静止画と別ガンマで表示 → 中間調が明るい）。**この差は Chrome の CDP スクリーンショット（コンポジタ読み戻し）に写らず、`screencapture` も sandbox で不可**なので、ペインの screenshot では検証できない → ユーザーの目で比較する
- **検証メモ（2026-09）**: 生成物の機械検証は **Pillow（ローカル導入済み）** が最適 — `is_animated / n_frames / size / info['loop'] / seek(i)+load() 後の info['duration']`（**load() しないと duration が None**）+ `getpixel` でフレーム順まで見られる。fixture の静止 WebP（lossy/lossless/RGBA）も Pillow で生成できるので **ffmpeg 不要**。E2E の fixture 動画は mediabunny（esm.sh）+ OffscreenCanvas 合成（compress の検証メモ参照）。ブラウザ生成 blob の取り出しは **base64 の手動転写は事故る**（実際に2バイト欠損した）→ ローカル受信サーバー（`python3 http.server` 拡張）に `fetch POST` で転送するか、`URL.createObjectURL` をフックして **Blob 参照ごと**保持（URL だけだと downloadBlob 後に revoke されて fetch 不能）

## アナリティクス
- **Vercel Analytics** 導入済み（`@vercel/analytics/react`）。`app/layout.tsx` に `<Analytics />` コンポーネント配置
- Vercelダッシュボード > プロジェクト > Analytics タブで閲覧（初回は有効化が必要な場合あり）

## ドットマップ固有の注意点
- **d3-geo**, **topojson-client** を使用（SSR不可 → `useEffect` 内で動的インポート）
- 陸地判定: GeoJSON → Canvas raster（8192px幅）に描画し、O(1)のピクセルルックアップで高速化
- 国ハイライト: 国別rasterを `useRef<Map>` でキャッシュ（遅延生成）
- **国で絞り込む（focus mode）**: `params.focusCountry`（国コード文字列、`""`＝世界全体がデフォルト）を選ぶとその1か国のみ描画＋ズームフィット。UI はコントロール最上段の単一 `Select`（先頭に「世界全体」オプション、`value="world"`→`""` に変換）。国ラスターの不透明ピクセルから **raster空間の bbox** を `rasterBounds()` で算出し `countryBoundsCache` にキャッシュ。pad を足した矩形 `[regMinX,regMinY,regW,regH]` にグリッドを線形マップ（raster は Mercator 済みなので線形補間で正しいズームになる）。world モードは `regMinX=0/regW=RASTER_W` で従来式に一致（同一コードパス）。focus 時は `focusRaster` の `isLand` でその国のセルだけ描画し、`lngOffset` は無効化。ハイライト色は focus 内でもそのまま効く。子午線をまたぐ国（ロシア等）は bbox が全幅になり近似的（許容）
- **データセットは `public/data/countries-50m.json`（world-atlas / Natural Earth 1:50m）**。`objects` に `countries` と `land` の両方を含むので単一 fetch で従来コードのまま動く。**110m（旧 `world-110m.json`、177国）はシンガポール・バーレーン・ブルネイ・マルタ・モナコ・香港・マカオ等の小国/島嶼国を大量に欠落**していたため 50m（235国、id付き236 features）に差し替えた。10m は 3.6MB と重く追加は微小な領土のみなので不採用（50m は 756KB）。旧 `world-110m.json` は未使用（削除可）
- IDはゼロ埋め3桁文字列（例: `"032"`, `"048"`）。`COUNTRY_NAME_JA` マッピングは先頭ゼロなし → ルックアップ時に `String(Number(id))` で変換（50m でも同一形式）
- **同一 ID の複数 feature に注意**: 50m は本国と海外領土を別 feature・同一 ISO id で持つことがある（例: `036` = Australia + Ashmore and Cartier Is.）。国リストは **id で dedup（先頭=本国を採用）** しないと React の duplicate key 警告＋重複行になる。`getCountryRaster` は **同一 id の全 feature を FeatureCollection でまとめてラスタライズ**（多島・飛び地対応）
- 国名は全て日本語（`COUNTRY_NAME_JA` に **235カ国/地域**、50m の id付き全件をカバー）。50m 追加分の日本語名は 3 翻訳者×1 照合の consensus/verify ワークフローで生成・検証（ISO 3166-1 準拠、島嶼は「諸島」・複合名は「・」）
- Mercator投影の緯度範囲: -56° 〜 71°（高緯度の歪み回避のため意図的にクリップ）
