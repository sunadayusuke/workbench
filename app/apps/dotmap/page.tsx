"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ------------------------------------------------------------------ */
/*  Types & Constants                                                  */
/* ------------------------------------------------------------------ */

interface HighlightedCountry {
  code: string;
  name: string;
  color: string;
}

interface MapParams {
  rows: number;
  gridPattern: "vertical" | "diagonal";
  dotColor: string;
  backgroundColor: string;
  bgTransparent: boolean;
  dotRadius: number;
  shape: "circle" | "hexagon";
  lngOffset: number;
  highlightedCountries: HighlightedCountry[];
}

const DEFAULT_PARAMS: MapParams = {
  rows: 136,
  gridPattern: "diagonal",
  dotColor: "#555555",
  backgroundColor: "#ffffff",
  bgTransparent: false,
  dotRadius: 0.4,
  shape: "circle",
  lngOffset: 0,
  highlightedCountries: [],
};

const HIGHLIGHT_PALETTE = [
  "#ff6b6b",
  "#4ecdc4",
  "#45b7d1",
  "#96ceb4",
  "#ffeaa7",
  "#a29bfe",
  "#fd79a8",
  "#00cec9",
];

/* ------------------------------------------------------------------ */
/*  ISO 3166-1 numeric → 日本語国名                                    */
/* ------------------------------------------------------------------ */

const COUNTRY_NAME_JA: Record<string, string> = {
  "4": "アフガニスタン", "8": "アルバニア", "12": "アルジェリア", "24": "アンゴラ",
  "32": "アルゼンチン", "51": "アルメニア", "36": "オーストラリア", "40": "オーストリア",
  "31": "アゼルバイジャン", "44": "バハマ", "50": "バングラデシュ", "112": "ベラルーシ",
  "56": "ベルギー", "84": "ベリーズ", "204": "ベナン", "64": "ブータン",
  "68": "ボリビア", "70": "ボスニア・ヘルツェゴビナ", "72": "ボツワナ", "76": "ブラジル",
  "96": "ブルネイ", "100": "ブルガリア", "854": "ブルキナファソ", "108": "ブルンジ",
  "116": "カンボジア", "120": "カメルーン", "124": "カナダ", "140": "中央アフリカ",
  "148": "チャド", "152": "チリ", "156": "中国", "170": "コロンビア",
  "178": "コンゴ共和国", "180": "コンゴ民主共和国", "188": "コスタリカ", "384": "コートジボワール",
  "191": "クロアチア", "192": "キューバ", "196": "キプロス", "203": "チェコ",
  "208": "デンマーク", "262": "ジブチ", "214": "ドミニカ共和国", "218": "エクアドル",
  "818": "エジプト", "222": "エルサルバドル", "226": "赤道ギニア", "232": "エリトリア",
  "233": "エストニア", "231": "エチオピア", "238": "フォークランド諸島", "242": "フィジー",
  "246": "フィンランド", "250": "フランス", "266": "ガボン", "270": "ガンビア",
  "268": "ジョージア", "276": "ドイツ", "288": "ガーナ", "300": "ギリシャ",
  "304": "グリーンランド", "320": "グアテマラ", "324": "ギニア", "624": "ギニアビサウ",
  "328": "ガイアナ", "332": "ハイチ", "340": "ホンジュラス", "348": "ハンガリー",
  "352": "アイスランド", "356": "インド", "360": "インドネシア", "364": "イラン",
  "368": "イラク", "372": "アイルランド", "376": "イスラエル", "380": "イタリア",
  "388": "ジャマイカ", "392": "日本", "400": "ヨルダン", "398": "カザフスタン",
  "404": "ケニア", "408": "北朝鮮", "410": "韓国", "414": "クウェート",
  "417": "キルギス", "418": "ラオス", "428": "ラトビア", "422": "レバノン",
  "426": "レソト", "430": "リベリア", "434": "リビア", "440": "リトアニア",
  "442": "ルクセンブルク", "807": "北マケドニア", "450": "マダガスカル", "454": "マラウイ",
  "458": "マレーシア", "466": "マリ", "478": "モーリタニア", "484": "メキシコ",
  "498": "モルドバ", "496": "モンゴル", "499": "モンテネグロ", "504": "モロッコ",
  "508": "モザンビーク", "104": "ミャンマー", "516": "ナミビア", "524": "ネパール",
  "528": "オランダ", "540": "ニューカレドニア", "554": "ニュージーランド", "558": "ニカラグア",
  "562": "ニジェール", "566": "ナイジェリア", "578": "ノルウェー", "512": "オマーン",
  "586": "パキスタン", "275": "パレスチナ", "591": "パナマ", "598": "パプアニューギニア",
  "600": "パラグアイ", "604": "ペルー", "608": "フィリピン", "616": "ポーランド",
  "620": "ポルトガル", "630": "プエルトリコ", "634": "カタール", "642": "ルーマニア",
  "643": "ロシア", "646": "ルワンダ", "682": "サウジアラビア", "686": "セネガル",
  "688": "セルビア", "694": "シエラレオネ", "703": "スロバキア", "705": "スロベニア",
  "90": "ソロモン諸島", "706": "ソマリア", "710": "南アフリカ", "728": "南スーダン",
  "724": "スペイン", "144": "スリランカ", "729": "スーダン", "740": "スリナム",
  "748": "エスワティニ", "752": "スウェーデン", "756": "スイス", "760": "シリア",
  "158": "台湾", "762": "タジキスタン", "834": "タンザニア", "764": "タイ",
  "626": "東ティモール", "768": "トーゴ", "780": "トリニダード・トバゴ", "788": "チュニジア",
  "792": "トルコ", "795": "トルクメニスタン", "800": "ウガンダ", "804": "ウクライナ",
  "784": "アラブ首長国連邦", "826": "イギリス", "840": "アメリカ合衆国", "858": "ウルグアイ",
  "860": "ウズベキスタン", "548": "バヌアツ", "862": "ベネズエラ", "704": "ベトナム",
  "887": "イエメン", "894": "ザンビア", "716": "ジンバブエ",
  "10": "南極", "732": "西サハラ", "260": "仏領南方・南極地域",
};

/* ------------------------------------------------------------------ */
/*  Mercator helpers                                                   */
/* ------------------------------------------------------------------ */

const LAT_MIN = -56;
const LAT_MAX = 71;
const LNG_MIN = -180;
const LNG_MAX = 180;

function mercatorY(lat: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

const Y_TOP = mercatorY(LAT_MAX);
const Y_BOT = mercatorY(LAT_MIN);
const Y_RANGE = Y_TOP - Y_BOT;
const X_RANGE = LNG_MAX - LNG_MIN;
const ASPECT = X_RANGE / (Y_RANGE * (180 / Math.PI));

/* ------------------------------------------------------------------ */
/*  Rasterize GeoJSON → bitmap for O(1) point-in-land lookup          */
/* ------------------------------------------------------------------ */

const RASTER_W = 8192;
const RASTER_H = Math.round(RASTER_W / ASPECT);

function rasterizeFeature(
  d3Geo: any,
  feature: any,
): Uint8ClampedArray {
  const canvas = document.createElement("canvas");
  canvas.width = RASTER_W;
  canvas.height = RASTER_H;
  const ctx = canvas.getContext("2d")!;

  const projection = d3Geo
    .geoMercator()
    .translate([RASTER_W / 2, RASTER_H / 2])
    .scale(1)
    .fitSize([RASTER_W, RASTER_H], {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [LNG_MIN, LAT_MIN],
            [LNG_MAX, LAT_MIN],
            [LNG_MAX, LAT_MAX],
            [LNG_MIN, LAT_MAX],
            [LNG_MIN, LAT_MIN],
          ],
        ],
      },
      properties: {},
    });

  const path = d3Geo.geoPath(projection, ctx);
  ctx.fillStyle = "#000";
  ctx.beginPath();
  path(feature);
  ctx.fill();

  return ctx.getImageData(0, 0, RASTER_W, RASTER_H).data;
}

function isLand(
  data: Uint8ClampedArray,
  px: number,
  py: number
): boolean {
  const x = Math.round(px);
  const y = Math.round(py);
  if (x < 0 || x >= RASTER_W || y < 0 || y >= RASTER_H) return false;
  return data[(y * RASTER_W + x) * 4 + 3] > 128;
}

function svgToRaster(
  svgX: number,
  svgY: number,
  cols: number,
  rows: number
): [number, number] {
  return [
    (svgX / cols) * RASTER_W,
    (svgY / rows) * RASTER_H,
  ];
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function ParamSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-baseline">
        <Label className="text-[13px]">{label}</Label>
        <span className="text-xs font-mono text-muted-foreground tabular-nums">
          {value.toFixed(step < 0.01 ? 3 : step < 1 ? 2 : 0)}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-[13px]">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-8 border border-border rounded-xl bg-transparent cursor-pointer p-0 color-swatch"
        />
        <span className="text-xs font-mono text-muted-foreground">
          {value}
        </span>
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/*  Hexagon SVG path helper                                            */
/* ------------------------------------------------------------------ */

function hexPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    pts.push(
      `${(cx + r * Math.cos(angle)).toFixed(3)},${(cy + r * Math.sin(angle)).toFixed(3)}`
    );
  }
  return `M${pts.join("L")}Z`;
}

/* ------------------------------------------------------------------ */
/*  Module / data types                                                */
/* ------------------------------------------------------------------ */

interface CountryEntry {
  code: string;
  name: string;
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function DotMapPage() {
  const [params, setParams] = useState<MapParams>(DEFAULT_PARAMS);
  const [ready, setReady] = useState(false);
  const [countryList, setCountryList] = useState<CountryEntry[]>([]);

  const d3GeoRef = useRef<any>(null);
  const landRasterRef = useRef<Uint8ClampedArray | null>(null);
  const countriesGeoRef = useRef<any>(null);
  const countryRasterCache = useRef<Map<string, Uint8ClampedArray>>(new Map());

  const updateParam = useCallback(
    <K extends keyof MapParams>(key: K, value: MapParams[K]) => {
      setParams((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // Load modules, rasterize land
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import("d3-geo"),
      import("topojson-client"),
      fetch("/data/world-110m.json").then((r) => r.json()),
    ])
      .then(([d3, tj, topo]) => {
        if (cancelled) return;
        d3GeoRef.current = d3;

        const land = tj.feature(topo, topo.objects.land);
        landRasterRef.current = rasterizeFeature(d3, land);

        const countries = tj.feature(topo, topo.objects.countries);
        countriesGeoRef.current = countries;

        const list: CountryEntry[] = (countries as any).features
          .filter((f: any) => f.id != null && f.properties.name)
          .map((f: any) => ({
            code: String(f.id),
            name: COUNTRY_NAME_JA[String(Number(f.id))] || f.properties.name,
          }))
          .sort((a: CountryEntry, b: CountryEntry) =>
            a.name.localeCompare(b.name, "ja")
          );
        setCountryList(list);
        setReady(true);
      })
      .catch((err) => {
        console.error("DotMap init error:", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Get (or cache) a country raster
  const getCountryRaster = useCallback((code: string): Uint8ClampedArray | null => {
    const cached = countryRasterCache.current.get(code);
    if (cached) return cached;
    const d3 = d3GeoRef.current;
    const countriesGeo = countriesGeoRef.current;
    if (!d3 || !countriesGeo) return null;
    const feature = (countriesGeo as any).features.find(
      (f: any) => String(f.id) === code
    );
    if (!feature) return null;
    const raster = rasterizeFeature(d3, feature);
    countryRasterCache.current.set(code, raster);
    return raster;
  }, []);

  // Generate dots — instant via raster lookup
  const svgString = useMemo(() => {
    if (!ready || !landRasterRef.current) return "";

    const landData = landRasterRef.current;
    const rows = params.rows;
    const cols = Math.round(rows * ASPECT);
    const r = params.dotRadius;
    const bgColor = params.backgroundColor;
    const defaultColor = params.dotColor;
    const isHex = params.shape === "hexagon";
    const pattern = params.gridPattern;
    const lngOff = params.lngOffset;

    // Preload country rasters for highlighted countries
    const highlights: Array<{ raster: Uint8ClampedArray; color: string }> = [];
    for (const hc of params.highlightedCountries) {
      const raster = getCountryRaster(hc.code);
      if (raster) highlights.push({ raster, color: hc.color });
    }

    const parts: string[] = [];
    parts.push(
      `<svg viewBox="-1 -1 ${cols + 2} ${rows + 2}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;">`
    );
    if (!params.bgTransparent) {
      parts.push(
        `<rect x="-1" y="-1" width="${cols + 2}" height="${rows + 2}" fill="${bgColor}" />`
      );
    }

    for (let row = 0; row < rows; row++) {
      const isDiagOffset = pattern === "diagonal" && row % 2 === 1;
      const offset = isDiagOffset ? 0.5 : 0;

      for (let col = 0; col < cols; col++) {
        const svgX = col + offset;
        const svgY = row;

        // Apply lng offset: shift the raster lookup horizontally (wrapping)
        let rasterX = (svgX / cols) * RASTER_W + (lngOff / X_RANGE) * RASTER_W;
        // Wrap around
        rasterX = ((rasterX % RASTER_W) + RASTER_W) % RASTER_W;
        const rasterY = (svgY / rows) * RASTER_H;

        if (!isLand(landData, rasterX, rasterY)) continue;

        // Determine color
        let fill = defaultColor;
        for (const h of highlights) {
          if (isLand(h.raster, rasterX, rasterY)) {
            fill = h.color;
            break;
          }
        }

        if (isHex) {
          parts.push(
            `<path d="${hexPath(svgX, svgY, r)}" fill="${fill}" />`
          );
        } else {
          parts.push(
            `<circle cx="${svgX.toFixed(2)}" cy="${svgY}" r="${r}" fill="${fill}" />`
          );
        }
      }
    }

    parts.push("</svg>");
    return parts.join("\n");
  }, [ready, params, getCountryRaster]);

  // Download SVG
  const handleDownload = useCallback(() => {
    if (!svgString) return;
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const canShare =
      isMobile &&
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function";
    if (canShare) {
      const file = new File([blob], "dotmap.svg", { type: "image/svg+xml" });
      if (navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file] }).catch(() => {});
        return;
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dotmap.svg";
    a.click();
    URL.revokeObjectURL(url);
  }, [svgString]);

  // Add highlighted country
  const addCountry = useCallback(
    (code: string) => {
      const country = countryList.find((c) => c.code === code);
      if (!country) return;
      if (params.highlightedCountries.some((c) => c.code === code)) return;
      const colorIdx =
        params.highlightedCountries.length % HIGHLIGHT_PALETTE.length;
      updateParam("highlightedCountries", [
        ...params.highlightedCountries,
        { code, name: country.name, color: HIGHLIGHT_PALETTE[colorIdx] },
      ]);
    },
    [countryList, params.highlightedCountries, updateParam]
  );

  const removeCountry = useCallback(
    (code: string) => {
      updateParam(
        "highlightedCountries",
        params.highlightedCountries.filter((c) => c.code !== code)
      );
    },
    [params.highlightedCountries, updateParam]
  );

  const updateCountryColor = useCallback(
    (code: string, color: string) => {
      updateParam(
        "highlightedCountries",
        params.highlightedCountries.map((c) =>
          c.code === code ? { ...c, color } : c
        )
      );
    },
    [params.highlightedCountries, updateParam]
  );

  const handleReset = useCallback(() => {
    setParams(DEFAULT_PARAMS);
  }, []);

  const availableCountries = useMemo(() => {
    const highlightedCodes = new Set(
      params.highlightedCountries.map((c) => c.code)
    );
    return countryList.filter((c) => !highlightedCodes.has(c.code));
  }, [countryList, params.highlightedCountries]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col md:flex-row bg-background">
      {/* Preview area */}
      <div className="h-[55vh] md:h-auto md:flex-1 relative min-w-0 shrink-0">
        <div
          className="w-full h-full p-6 md:p-12 overflow-hidden"
          style={{
            backgroundColor: params.bgTransparent ? undefined : params.backgroundColor,
            backgroundImage: params.bgTransparent
              ? "repeating-conic-gradient(#e0e0e0 0% 25%, #fff 0% 50%)"
              : undefined,
            backgroundSize: params.bgTransparent ? "16px 16px" : undefined,
          }}
        >
          {!ready ? (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          ) : (
            <div
              className="w-full h-full flex items-center justify-center [&>svg]:max-w-full [&>svg]:max-h-full"
              dangerouslySetInnerHTML={{ __html: svgString }}
            />
          )}
        </div>

        {/* Top bar */}
        <div className="absolute inset-x-0 top-0 flex items-center p-3 md:p-4 z-10 pointer-events-none [&>*]:pointer-events-auto">
          <Link href="/">
            <Button
              variant="outline"
              size="sm"
              className="bg-white/75! border-black/10! text-foreground/80! backdrop-blur-xl hover:bg-white/90! hover:border-black/20!"
            >
              ← 戻る
            </Button>
          </Link>
        </div>
      </div>

      {/* Sidebar */}
      <aside className="flex-1 md:flex-none md:w-75 shrink bg-background shadow-[0_-8px_24px_rgba(0,0,0,0.12)] md:shadow-none border-t md:border-t-0 md:border-l border-border flex flex-col overflow-hidden">
        <div className="px-6 py-3 md:pt-5 md:pb-4 border-b border-border shrink-0 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold -tracking-[0.01em]">
            ドットマップ
          </h2>
          <Button variant="secondary" size="sm" onClick={handleReset}>
            リセット
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-4 px-6 py-5 pb-8">
          <SectionHeader>マップ設定</SectionHeader>

          <ParamSlider
            label="密度（行数）"
            value={params.rows}
            min={20}
            max={250}
            step={1}
            onChange={(v) => updateParam("rows", v)}
          />

          <ParamSlider
            label="横シフト（経度）"
            value={params.lngOffset}
            min={-180}
            max={180}
            step={1}
            onChange={(v) => updateParam("lngOffset", v)}
          />

          <div className="flex flex-col gap-2">
            <Label className="text-[13px]">グリッドパターン</Label>
            <Select
              value={params.gridPattern}
              onValueChange={(v) =>
                updateParam("gridPattern", v as "vertical" | "diagonal")
              }
            >
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vertical">垂直</SelectItem>
                <SelectItem value="diagonal">斜め</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <SectionHeader>外観</SectionHeader>

          <ColorRow
            label="ドット色"
            value={params.dotColor}
            onChange={(v) => updateParam("dotColor", v)}
          />

          <div className="flex items-center justify-between">
            <Label className="text-[13px]">背景透過</Label>
            <button
              type="button"
              role="switch"
              aria-checked={params.bgTransparent}
              onClick={() => updateParam("bgTransparent", !params.bgTransparent)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${params.bgTransparent ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-sm transition-transform ${params.bgTransparent ? "translate-x-4" : "translate-x-0"}`} />
            </button>
          </div>
          {!params.bgTransparent && (
            <ColorRow
              label="背景色"
              value={params.backgroundColor}
              onChange={(v) => updateParam("backgroundColor", v)}
            />
          )}

          <ParamSlider
            label="ドット半径"
            value={params.dotRadius}
            min={0.1}
            max={0.6}
            step={0.05}
            onChange={(v) => updateParam("dotRadius", v)}
          />

          <div className="flex flex-col gap-2">
            <Label className="text-[13px]">形状</Label>
            <Select
              value={params.shape}
              onValueChange={(v) =>
                updateParam("shape", v as "circle" | "hexagon")
              }
            >
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="circle">円</SelectItem>
                <SelectItem value="hexagon">六角形</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <SectionHeader>国ハイライト</SectionHeader>

          {availableCountries.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label className="text-[13px]">国を追加</Label>
              <Select onValueChange={addCountry} value="">
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="国を選択..." />
                </SelectTrigger>
                <SelectContent className="max-h-[240px]">
                  {availableCountries.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {params.highlightedCountries.length > 0 && (
            <div className="flex flex-col gap-2">
              {params.highlightedCountries.map((hc) => (
                <div
                  key={hc.code}
                  className="flex items-center gap-2 pl-3 border-l-2 border-border"
                >
                  <input
                    type="color"
                    value={hc.color}
                    onChange={(e) =>
                      updateCountryColor(hc.code, e.target.value)
                    }
                    className="size-6 border border-border rounded-lg bg-transparent cursor-pointer p-0 color-swatch shrink-0"
                  />
                  <span className="text-[13px] flex-1 truncate">{hc.name}</span>
                  <button
                    onClick={() => removeCountry(hc.code)}
                    className="text-muted-foreground hover:text-foreground text-sm cursor-pointer shrink-0"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <Separator />

          <Button className="w-full" onClick={handleDownload}>
            SVGダウンロード
          </Button>
        </div>
      </aside>
    </div>
  );
}
