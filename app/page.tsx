"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n";

const APP_KEYS = ["color", "shader", "image", "easing", "gradient", "particle", "dotmap"] as const;

const APP_HREFS: Record<typeof APP_KEYS[number], string> = {
  color:    "/apps/color",
  shader:   "/apps/shader",
  image:    "/apps/image",
  easing:   "/apps/easing",
  gradient: "/apps/gradient",
  particle: "/apps/particle",
  dotmap:   "/apps/dotmap",
};

export default function Home() {
  const { lang, toggle, t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#d2d2d2] text-[#242424] px-6 py-10 md:px-12 md:py-12">

      {/* Header */}
      <header className="flex items-center justify-between mb-12 md:mb-16">
        <img
          src="/images/workbench_logo.svg"
          alt="Workbench"
          className="w-[110px] md:w-[130px]"
          style={{ filter: "brightness(0)" }}
        />
        <div className="flex items-center gap-4">
          <p className="text-[12px] font-mono uppercase tracking-[0.18em] text-[#242424] select-none hidden md:block">
            {t.homeSubtitle}
          </p>
          <button
            onClick={toggle}
            className="bg-[#242424] text-white font-mono text-[12px] uppercase tracking-[0.12em] px-3 py-1.5 hover:bg-[#333] active:bg-[#1a1a1a] transition-colors select-none"
          >
            [ {lang === "ja" ? "EN" : "JA"} ]
          </button>
          <a
            href="https://x.com/YusukeSunada"
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-70 hover:opacity-100 transition-opacity"
          >
            <img src="/images/x_logo.svg" alt="X" className="w-[14px]" style={{ filter: "brightness(0)" }} />
          </a>
        </div>
      </header>

      {/* Label */}
      <p className="text-[12px] font-mono uppercase tracking-[0.28em] text-[#242424] mb-5 select-none">
        Applications
      </p>

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 mb-14 border-t border-l border-[#242424]">
        {APP_KEYS.map((key) => {
          const href = APP_HREFS[key];
          const app = t.apps[key];
          return (
            <Link
              key={href}
              href={href}
              className="group bg-[#d2d2d2] hover:bg-[#d8d8d8] active:bg-[#cccccc] p-6 flex flex-col justify-center border-r border-b border-[#242424] transition-colors duration-100 select-none"
            >
              <p className="text-[12px] font-mono uppercase tracking-[0.08em] text-[#242424] font-medium mb-2 group-hover:text-black transition-colors">
                {app.name}
              </p>
              <p className="text-[12px] font-mono text-[#242424] leading-relaxed group-hover:text-[#242424] transition-colors">
                {app.description}
              </p>
            </Link>
          );
        })}
      </div>

    </div>
  );
}
