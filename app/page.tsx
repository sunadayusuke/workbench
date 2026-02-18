"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n";

const APP_KEYS = ["color", "shader", "image", "easing", "gradient", "particle", "dotmap"] as const;

const APP_META: Record<typeof APP_KEYS[number], { href: string; icon: string }> = {
  color:    { href: "/apps/color",    icon: "🎨" },
  shader:   { href: "/apps/shader",   icon: "🌊" },
  image:    { href: "/apps/image",    icon: "🖼️" },
  easing:   { href: "/apps/easing",   icon: "⏱️" },
  gradient: { href: "/apps/gradient", icon: "🌈" },
  particle: { href: "/apps/particle", icon: "✨" },
  dotmap:   { href: "/apps/dotmap",   icon: "🌍" },
};

export default function Home() {
  const { lang, toggle, t } = useLanguage();

  return (
    <div className="min-h-screen px-5 py-8 md:px-12 md:py-12">
      <div className="flex flex-col gap-[20px] mb-8 md:flex-row md:items-center md:justify-between md:gap-3 md:mb-12">
        <h1 className="text-[28px] font-bold tracking-tight">
          <img src="/images/workbench_logo.svg" alt="Workbench" className="w-[140px] md:w-[160px] -ml-[3px]" />
        </h1>
        <div className="flex items-center justify-between md:gap-8">
          <button
            onClick={toggle}
            className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-accent select-none"
          >
            {lang === "ja" ? "EN" : "JA"}
          </button>
          <div className="flex items-center gap-3">
            <p className="text-[13px] md:text-[15px] text-muted-foreground">{t.homeSubtitle}</p>
            <a href="https://x.com/YusukeSunada" target="_blank" rel="noopener noreferrer" className="opacity-50 hover:opacity-100 transition-opacity">
              <img src="/images/x_logo.svg" alt="X" className="w-[18px]" />
            </a>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
        {APP_KEYS.map((key) => {
          const meta = APP_META[key];
          const app = t.apps[key];
          return (
            <Link
              key={meta.href}
              href={meta.href}
              className="bg-card border border-border rounded-2xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_2px_8px_rgba(0,0,0,0.04)] transition-all select-none hover:border-foreground hover:bg-accent hover:shadow-[0_2px_4px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.07)] active:scale-[0.98]"
            >
              <div className="text-[28px] mb-3">{meta.icon}</div>
              <div className="text-[15px] font-semibold mb-1">{app.name}</div>
              <div className="text-[13px] text-muted-foreground leading-relaxed">{app.description}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
