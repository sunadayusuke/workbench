export interface Translations {
  // Common
  back: string;
  settings: string;
  reset: string;
  close: string;
  copy: string;
  copied: string;
  download: string;
  exportCode: string;
  exportCodeTitle: string;
  exportCss: string;
  cancel: string;
  colors: string;

  // Home
  homeSubtitle: string;
  apps: {
    color: { name: string; description: string };
    shader: { name: string; description: string };
    image: { name: string; description: string };
    easing: { name: string; description: string };
    gradient: { name: string; description: string };
    particle: { name: string; description: string };
    dotmap: { name: string; description: string };
    signal: { name: string; description: string };
  };

  // Signal page
  signal: {
    mode: string;
    wave: string;
    ripple: string;
    random: string;
    plasma: string;
    grid: string;
    gridSize: string;
    shape: string;
    square: string;
    circle: string;
    motion: string;
    speed: string;
    frequency: string;
    amplitude: string;
    spread: string;
    noise: string;
    layers: string;
    colors: string;
    fgColor: string;
    midColor: string;
    bgColor: string;
    transparentBg: string;
  };

  // Color page
  color: {
    preview: string;
    contrastCheck: string;
    compareColor: string;
    contrastRatio: string;
    colorScale: string;
    uiSample: string;
    baseColor: string;
    scaleName: string;
    scaleNameHint: string;
    oklchL: string;
    oklchC: string;
    oklchH: string;
    outOfGamut: string;
    exportCssTitle: string;
    copySvg: string;
    colorFormat: string;
    outputFormat: string;
    sampleText: string;
    // UI sample strings
    monthlyReport: string;
    published: string;
    prevMonth: string;
    save: string;
    draft: string;
    notification: string;
    newUpdate: string;
    email: string;
    dashboard: string;
    project: string;
  };

  // Shader page
  shader: {
    mode: string;
    flow: string;
    wave: string;
    ripple: string;
    morph: string;
    speed: string;
    distortion: string;
    noiseScale: string;
    aberration: string;
    bgColor: string;
    color1: string;
    color2: string;
    colorLabel: string;
    intensity: string;
    threshold: string;
    exportCodeTitle: string;
  };

  // Gradient page
  gradient: {
    aspectRatio: string;
    phone: string;
    desktop: string;
    square: string;
    custom: string;
    gradientType: string;
    mesh: string;
    linear: string;
    radial: string;
    type: string;
    spread: string;
    angle: string;
    scale: string;
    noise: string;
    color: string;
    shuffle: string;
    addColor: string;
    effects: string;
    grain: string;
    particle: string;
    granularity: string;
    halftone: string;
    rib: string;
    density: string;
    shift: string;
    chromaticAberration: string;
    wave: string;
    frequency: string;
    direction: string;
    random: string;
    width: string;
    height: string;
    output: string;
  };

  // Particle page
  particle: {
    formation: string;
    mode: string;
    scale: string;
    variation: string;
    scatter: string;
    scatterDistance: string;
    particleCount: string;
    size: string;
    sizeVariation: string;
    opacity: string;
    colorSection: string;
    transparentBg: string;
    bgColor: string;
    particleColor: string;
    addColor: string;
    colorSpeed: string;
    colorFrequency: string;
    animation: string;
    animationType: string;
    speed: string;
    noiseScale: string;
    turbulence: string;
    frequency: string;
    amplitude: string;
    interaction: string;
    mouseHover: string;
    attraction: string;
    exportCode: string;
    exportImage: string;
    exportCodeTitle: string;
    enterText: string;
    selectSvg: string;
    flow: string;
    wave: string;
    diffusion: string;
    free: string;
    sphere: string;
    cube: string;
    ring: string;
    text: string;
    svg: string;
    mouse: string;
  };

  // Dotmap page
  dotmap: {
    mapSettings: string;
    density: string;
    lngShift: string;
    gridPattern: string;
    vertical: string;
    diagonal: string;
    appearance: string;
    dotColor: string;
    transparentBg: string;
    bgColor: string;
    dotRadius: string;
    shape: string;
    circle: string;
    hexagon: string;
    countryHighlight: string;
    addCountry: string;
    selectCountry: string;
    svgDownload: string;
    loading: string;
    countries: string;
    solid: string;
  };

  // Image page
  image: {
    dropHint: string;
    clickHint: string;
    selectImage: string;
    changeImage: string;
    basicAdjustments: string;
    brightness: string;
    contrast: string;
    saturation: string;
    exposure: string;
    highlights: string;
    shadows: string;
    effects: string;
    glitch: string;
    seed: string;
    noise: string;
    blur: string;
    vignette: string;
    pixelate: string;
    rgbShift: string;
    type: string;
    linear: string;
    radial: string;
    angle: string;
    wave: string;
    frequency: string;
    halftone: string;
    scanline: string;
    colorEffects: string;
    cyanYellow: string;
    greenMagenta: string;
    hueShift: string;
    fade: string;
    duotone: string;
    shadow: string;
    highlight: string;
    format: string;
    quality: string;
    tone: string;
    fx: string;
  };

  // Easing page
  easing: {
    duration: string;
    presets: string;
    exportCode: string;
    pressButton: string;
    cardTitle: string;
    hoverHint: string;
    open: string;
    close: string;
    confirm: string;
    confirmQuestion: string;
    saved: string;
    savedDesc: string;
    menu: string;
    home: string;
    profile: string;
    settingsMenu: string;
    help: string;
    share: string;
    shareQuestion: string;
    email: string;
    sns: string;
    copyLink: string;
    scenes: {
      button: string;
      modal: string;
      toast: string;
      sidebar: string;
      drawer: string;
      card: string;
      gallery: string;
    };
  };
}

const ja: Translations = {
  back: "← 戻る",
  settings: "設定",
  reset: "リセット",
  close: "閉じる",
  copy: "クリップボードにコピー",
  copied: "コピーしました",
  download: "ダウンロード",
  exportCode: "コード出力",
  exportCodeTitle: "コード出力 — 軽量版HTML",
  exportCss: "CSS出力",
  cancel: "キャンセル",
  colors: "カラー",

  homeSubtitle: "sunaのデザイン作業台",
  apps: {
    color: { name: "カラー", description: "OKLCHカラースケール＆コントラストチェッカー" },
    shader: { name: "ノイズシェーダー", description: "パーリンノイズ背景デザインツール" },
    image: { name: "イメージ", description: "画像補正＆エフェクトツール" },
    easing: { name: "イージング", description: "ベジェカーブエディター＆アニメーションプレビュー" },
    gradient: { name: "グラデーション", description: "メッシュグラデーション壁紙ジェネレーター" },
    particle: { name: "パーティクル", description: "テキスト＆SVGパーティクルアニメーション" },
    dotmap: { name: "ドットマップ", description: "ドット世界地図SVGジェネレーター" },
    signal: { name: "シグナルノイズ", description: "ディザリングシグナルノイズジェネレーター" },
  },

  color: {
    preview: "プレビュー",
    contrastCheck: "コントラストチェック",
    compareColor: "比較色",
    contrastRatio: "コントラスト比",
    colorScale: "カラースケール",
    uiSample: "UIサンプル",
    baseColor: "ベースカラー",
    scaleName: "スケール名",
    scaleNameHint: "CSS変数のプレフィックス（例: --{name}-500）",
    oklchL: "L（明度）",
    oklchC: "C（彩度）",
    oklchH: "H（色相）",
    outOfGamut: "sRGBガマット外（クランプ表示）",
    exportCssTitle: "CSS出力 — OKLCHカラースケール",
    copySvg: "SVGコピー",
    colorFormat: "カラー形式",
    outputFormat: "出力形式",
    sampleText: "サンプルテキスト",
    monthlyReport: "月間レポート",
    published: "公開中",
    prevMonth: "前月比 +12.5%",
    save: "保存する",
    draft: "下書き",
    notification: "お知らせ",
    newUpdate: "新しいアップデートが利用可能です。",
    email: "メールアドレス",
    dashboard: "ダッシュボード",
    project: "プロジェクト",
  },

  shader: {
    mode: "モード",
    flow: "フロー",
    wave: "ウェーブ",
    ripple: "リップル",
    morph: "モーフ",
    speed: "速度",
    distortion: "歪み",
    noiseScale: "ノイズスケール",
    aberration: "色収差",
    bgColor: "背景色",
    color1: "カラー 1",
    color2: "カラー 2",
    colorLabel: "色",
    intensity: "強度",
    threshold: "しきい値",
    exportCodeTitle: "コード出力 — 軽量版HTML",
  },

  gradient: {
    aspectRatio: "アスペクト比",
    phone: "スマホ (9:16)",
    desktop: "デスクトップ (16:9)",
    square: "正方形 (1:1)",
    custom: "カスタム",
    gradientType: "グラデーション",
    mesh: "メッシュ",
    linear: "リニア",
    radial: "ラジアル",
    type: "タイプ",
    spread: "広がり",
    angle: "角度",
    scale: "スケール",
    noise: "ノイズ",
    color: "カラー",
    shuffle: "シャッフル",
    addColor: "+ カラー追加",
    effects: "エフェクト",
    grain: "グレイン",
    particle: "粒子",
    granularity: "粒度",
    halftone: "ハーフトーン",
    rib: "リブ",
    density: "密度",
    shift: "ズレ",
    chromaticAberration: "色収差",
    wave: "ウェーブ",
    frequency: "周波数",
    direction: "方向",
    random: "ランダム",
    width: "幅",
    height: "高さ",
    output: "出力",
  },

  particle: {
    formation: "フォーメーション",
    mode: "モード",
    scale: "スケール",
    variation: "ばらつき",
    scatter: "散布",
    scatterDistance: "散布距離",
    particleCount: "数",
    size: "サイズ",
    sizeVariation: "サイズ変動",
    opacity: "不透明度",
    colorSection: "カラー",
    transparentBg: "背景透過",
    bgColor: "背景色",
    particleColor: "パーティクル色",
    addColor: "+ 追加",
    colorSpeed: "カラー速度",
    colorFrequency: "カラー周波数",
    animation: "アニメーション",
    animationType: "タイプ",
    speed: "速度",
    noiseScale: "ノイズスケール",
    turbulence: "乱流",
    frequency: "周波数",
    amplitude: "振幅",
    interaction: "インタラクション",
    mouseHover: "マウスホバー",
    attraction: "吸い付き",
    exportCode: "コード出力",
    exportImage: "画像として出力",
    exportCodeTitle: "コード出力 — 軽量版HTML",
    enterText: "テキストを入力",
    selectSvg: "SVGファイルを選択",
    flow: "フロー",
    wave: "ウェーブ",
    diffusion: "拡散",
    free: "自由",
    sphere: "球",
    cube: "キューブ",
    ring: "リング",
    text: "テキスト",
    svg: "SVG",
    mouse: "マウス",
  },

  dotmap: {
    mapSettings: "マップ設定",
    density: "密度（行数）",
    lngShift: "横シフト（経度）",
    gridPattern: "グリッドパターン",
    vertical: "垂直",
    diagonal: "斜め",
    appearance: "外観",
    dotColor: "ドット色",
    transparentBg: "背景透過",
    bgColor: "背景色",
    dotRadius: "ドット半径",
    shape: "形状",
    circle: "円",
    hexagon: "六角形",
    countryHighlight: "国ハイライト",
    addCountry: "国を追加",
    selectCountry: "国を選択...",
    svgDownload: "SVGダウンロード",
    loading: "読み込み中...",
    countries: "国",
    solid: "ソリッド",
  },

  image: {
    dropHint: "画像をドラッグ＆ドロップ",
    clickHint: "またはクリックしてファイルを選択",
    selectImage: "画像を選択",
    changeImage: "別の画像を選択",
    basicAdjustments: "基本補正",
    brightness: "明るさ",
    contrast: "コントラスト",
    saturation: "彩度",
    exposure: "露出",
    highlights: "ハイライト",
    shadows: "シャドウ",
    effects: "エフェクト",
    glitch: "グリッチ",
    seed: "シード",
    noise: "ノイズ",
    blur: "ぼかし",
    vignette: "ビネット",
    pixelate: "ピクセレート",
    rgbShift: "RGBシフト",
    type: "タイプ",
    linear: "リニア",
    radial: "ラジアル",
    angle: "角度",
    wave: "ウェーブ",
    frequency: "周波数",
    halftone: "ハーフトーン",
    scanline: "スキャンライン",
    colorEffects: "カラーエフェクト",
    cyanYellow: "シアン ↔ イエロー",
    greenMagenta: "グリーン ↔ マゼンタ",
    hueShift: "色相シフト",
    fade: "フェード",
    duotone: "デュオトーン",
    shadow: "シャドウ",
    highlight: "ハイライト",
    format: "形式",
    quality: "品質",
    tone: "トーン",
    fx: "エフェクト",
  },

  signal: {
    mode: "モード",
    wave: "ウェーブ",
    ripple: "リップル",
    random: "ランダム",
    plasma: "プラズマ",
    grid: "グリッド",
    gridSize: "セルサイズ",
    shape: "形状",
    square: "四角",
    circle: "円",
    motion: "モーション",
    speed: "速度",
    frequency: "周波数",
    amplitude: "振幅",
    spread: "広がり",
    noise: "ノイズ",
    layers: "レイヤー",
    colors: "カラー",
    fgColor: "前景色",
    midColor: "中間色",
    bgColor: "背景色",
    transparentBg: "背景透過",
  },

  easing: {
    duration: "デュレーション",
    presets: "プリセット",
    exportCode: "コード出力",
    pressButton: "ボタンを押す",
    cardTitle: "カードタイトル",
    hoverHint: "ホバーでエフェクトを確認",
    open: "開く",
    close: "閉じる",
    confirm: "確認",
    confirmQuestion: "この操作を実行しますか？",
    saved: "保存しました",
    savedDesc: "変更が正常に保存されました",
    menu: "メニュー",
    home: "ホーム",
    profile: "プロフィール",
    settingsMenu: "設定",
    help: "ヘルプ",
    share: "共有",
    shareQuestion: "このリンクを共有しますか？",
    email: "メール",
    sns: "SNS",
    copyLink: "コピー",
    scenes: {
      button: "ボタン",
      modal: "モーダル",
      toast: "トースト",
      sidebar: "サイドバー",
      drawer: "ドロワー",
      card: "カード",
      gallery: "ギャラリー",
    },
  },
};

const en: Translations = {
  back: "← Back",
  settings: "Settings",
  reset: "Reset",
  close: "Close",
  copy: "Copy to Clipboard",
  copied: "Copied!",
  download: "Download",
  exportCode: "Export Code",
  exportCodeTitle: "Code Export — Standalone HTML",
  exportCss: "Export CSS",
  cancel: "Cancel",
  colors: "Colors",

  homeSubtitle: "suna's design workbench",
  apps: {
    color: { name: "Color", description: "OKLCH color scale & contrast checker" },
    shader: { name: "Noise Shader", description: "Perlin noise background design tool" },
    image: { name: "Image", description: "Image adjustment & effects tool" },
    easing: { name: "Easing", description: "Bézier curve editor & animation preview" },
    gradient: { name: "Gradient", description: "Mesh gradient wallpaper generator" },
    particle: { name: "Particle", description: "Text & SVG particle animation" },
    dotmap: { name: "Dot Map", description: "Dot world map SVG generator" },
    signal: { name: "Signal Noise", description: "Dithered signal noise generator" },
  },

  color: {
    preview: "Preview",
    contrastCheck: "Contrast Check",
    compareColor: "Compare Color",
    contrastRatio: "Contrast Ratio",
    colorScale: "Color Scale",
    uiSample: "UI Sample",
    baseColor: "Base Color",
    scaleName: "Scale Name",
    scaleNameHint: "CSS variable prefix (e.g. --{name}-500)",
    oklchL: "L (Lightness)",
    oklchC: "C (Chroma)",
    oklchH: "H (Hue)",
    outOfGamut: "Out of sRGB gamut (clamped)",
    exportCssTitle: "CSS Export — OKLCH Color Scale",
    copySvg: "Copy SVG",
    colorFormat: "Color Format",
    outputFormat: "Output Format",
    sampleText: "Sample text",
    monthlyReport: "Monthly Report",
    published: "Live",
    prevMonth: "vs last month +12.5%",
    save: "Save",
    draft: "Draft",
    notification: "Notice",
    newUpdate: "A new update is available.",
    email: "Email address",
    dashboard: "Dashboard",
    project: "Projects",
  },

  shader: {
    mode: "Mode",
    flow: "Flow",
    wave: "Wave",
    ripple: "Ripple",
    morph: "Morph",
    speed: "Speed",
    distortion: "Distortion",
    noiseScale: "Noise Scale",
    aberration: "Chromatic Aberration",
    bgColor: "Background Color",
    color1: "Color 1",
    color2: "Color 2",
    colorLabel: "Color",
    intensity: "Intensity",
    threshold: "Threshold",
    exportCodeTitle: "Code Export — Standalone HTML",
  },

  gradient: {
    aspectRatio: "Aspect Ratio",
    phone: "Mobile (9:16)",
    desktop: "Desktop (16:9)",
    square: "Square (1:1)",
    custom: "Custom",
    gradientType: "Gradient",
    mesh: "Mesh",
    linear: "Linear",
    radial: "Radial",
    type: "Type",
    spread: "Spread",
    angle: "Angle",
    scale: "Scale",
    noise: "Noise",
    color: "Color",
    shuffle: "Shuffle",
    addColor: "+ Add Color",
    effects: "Effects",
    grain: "Grain",
    particle: "Particle",
    granularity: "Granularity",
    halftone: "Halftone",
    rib: "Rib",
    density: "Density",
    shift: "Shift",
    chromaticAberration: "Chromatic Aberration",
    wave: "Wave",
    frequency: "Frequency",
    direction: "Direction",
    random: "Random",
    width: "Width",
    height: "Height",
    output: "Output",
  },

  particle: {
    formation: "Formation",
    mode: "Mode",
    scale: "Scale",
    variation: "Variation",
    scatter: "Scatter",
    scatterDistance: "Scatter Distance",
    particleCount: "Count",
    size: "Size",
    sizeVariation: "Size Variation",
    opacity: "Opacity",
    colorSection: "Color",
    transparentBg: "Transparent BG",
    bgColor: "Background Color",
    particleColor: "Particle Color",
    addColor: "+ Add",
    colorSpeed: "Color Speed",
    colorFrequency: "Color Frequency",
    animation: "Animation",
    animationType: "Type",
    speed: "Speed",
    noiseScale: "Noise Scale",
    turbulence: "Turbulence",
    frequency: "Frequency",
    amplitude: "Amplitude",
    interaction: "Interaction",
    mouseHover: "Mouse Hover",
    attraction: "Attraction",
    exportCode: "Export Code",
    exportImage: "Export Image",
    exportCodeTitle: "Code Export — Standalone HTML",
    enterText: "Enter text",
    selectSvg: "Select SVG file",
    flow: "Flow",
    wave: "Wave",
    diffusion: "Diffusion",
    free: "Free",
    sphere: "Sphere",
    cube: "Cube",
    ring: "Ring",
    text: "Text",
    svg: "SVG",
    mouse: "Mouse",
  },

  dotmap: {
    mapSettings: "Map Settings",
    density: "Density (rows)",
    lngShift: "Lng Shift",
    gridPattern: "Grid Pattern",
    vertical: "Vertical",
    diagonal: "Diagonal",
    appearance: "Appearance",
    dotColor: "Dot Color",
    transparentBg: "Transparent BG",
    bgColor: "Background Color",
    dotRadius: "Dot Radius",
    shape: "Shape",
    circle: "Circle",
    hexagon: "Hexagon",
    countryHighlight: "Country Highlight",
    addCountry: "Add Country",
    selectCountry: "Select country...",
    svgDownload: "Download SVG",
    loading: "Loading...",
    countries: "Countries",
    solid: "Solid",
  },

  image: {
    dropHint: "Drag & drop an image",
    clickHint: "or click to select a file",
    selectImage: "Select Image",
    changeImage: "Change Image",
    basicAdjustments: "Basic Adjustments",
    brightness: "Brightness",
    contrast: "Contrast",
    saturation: "Saturation",
    exposure: "Exposure",
    highlights: "Highlights",
    shadows: "Shadows",
    effects: "Effects",
    glitch: "Glitch",
    seed: "Seed",
    noise: "Noise",
    blur: "Blur",
    vignette: "Vignette",
    pixelate: "Pixelate",
    rgbShift: "RGB Shift",
    type: "Type",
    linear: "Linear",
    radial: "Radial",
    angle: "Angle",
    wave: "Wave",
    frequency: "Frequency",
    halftone: "Halftone",
    scanline: "Scanline",
    colorEffects: "Color Effects",
    cyanYellow: "Cyan ↔ Yellow",
    greenMagenta: "Green ↔ Magenta",
    hueShift: "Hue Shift",
    fade: "Fade",
    duotone: "Duotone",
    shadow: "Shadow",
    highlight: "Highlight",
    format: "Format",
    quality: "Quality",
    tone: "Tone",
    fx: "Effects",
  },

  signal: {
    mode: "Mode",
    wave: "Wave",
    ripple: "Ripple",
    random: "Random",
    plasma: "Plasma",
    grid: "Grid",
    gridSize: "Cell Size",
    shape: "Shape",
    square: "Square",
    circle: "Circle",
    motion: "Motion",
    speed: "Speed",
    frequency: "Frequency",
    amplitude: "Amplitude",
    spread: "Spread",
    noise: "Noise",
    layers: "Layers",
    colors: "Colors",
    fgColor: "Foreground",
    midColor: "Midtone",
    bgColor: "Background",
    transparentBg: "Transparent BG",
  },

  easing: {
    duration: "Duration",
    presets: "Presets",
    exportCode: "Export Code",
    pressButton: "Press button",
    cardTitle: "Card Title",
    hoverHint: "Hover to preview effect",
    open: "Open",
    close: "Close",
    confirm: "Confirm",
    confirmQuestion: "Do you want to proceed?",
    saved: "Saved",
    savedDesc: "Changes saved successfully.",
    menu: "Menu",
    home: "Home",
    profile: "Profile",
    settingsMenu: "Settings",
    help: "Help",
    share: "Share",
    shareQuestion: "Share this link?",
    email: "Email",
    sns: "Social",
    copyLink: "Copy",
    scenes: {
      button: "Button",
      modal: "Modal",
      toast: "Toast",
      sidebar: "Sidebar",
      drawer: "Drawer",
      card: "Card",
      gallery: "Gallery",
    },
  },
};

export const translations: Record<"ja" | "en", Translations> = { ja, en };
