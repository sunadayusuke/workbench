import Link from "next/link";

const apps = [
  {
    name: "カラー",
    description: "OKLCHカラースケール＆コントラストチェッカー",
    href: "/apps/color",
    icon: "🎨",
  },
  {
    name: "ノイズシェーダー",
    description: "パーリンノイズ背景デザインツール",
    href: "/apps/shader",
    icon: "🌊",
  },
  {
    name: "イメージ",
    description: "画像補正＆エフェクトツール",
    href: "/apps/image",
    icon: "🖼️",
  },
  {
    name: "イージング",
    description: "ベジェカーブエディター＆アニメーションプレビュー",
    href: "/apps/easing",
    icon: "⏱️",
  },
  {
    name: "グラデーション",
    description: "メッシュグラデーション壁紙ジェネレーター",
    href: "/apps/gradient",
    icon: "🌈",
  },
  {
    name: "パーティクル",
    description: "テキスト＆SVGパーティクルアニメーション",
    href: "/apps/particle",
    icon: "✨",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen px-5 py-8 md:px-12 md:py-12">
      <div className="flex flex-col gap-[20px] mb-8 md:flex-row md:items-center md:justify-between md:gap-3 md:mb-12">
        <h1 className="text-[28px] font-bold tracking-tight">
          <img src="/images/workbench_logo.svg" alt="Workbench" className="w-[140px] md:w-[160px] -ml-[3px]" />
        </h1>
        <div className="flex items-center justify-between md:gap-8">
          <p className="text-[13px] md:text-[15px] text-muted-foreground">sunaのデザイン作業台</p>
          <a href="https://x.com/YusukeSunada" target="_blank" rel="noopener noreferrer" className="opacity-50 hover:opacity-100 transition-opacity">
            <img src="/images/x_logo.svg" alt="X" className="w-[18px]" />
          </a>
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
        {apps.map((app) => (
          <Link
            key={app.href}
            href={app.href}
            className="bg-card border border-border rounded-2xl p-6 transition-all select-none hover:border-foreground hover:bg-accent active:scale-[0.98]"
          >
            <div className="text-[28px] mb-3">{app.icon}</div>
            <div className="text-[15px] font-semibold mb-1">{app.name}</div>
            <div className="text-[13px] text-muted-foreground leading-relaxed">{app.description}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
