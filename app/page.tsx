"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n";
import { PushButton } from "@/components/ui/push-button";

const APP_KEYS = ["color", "shader", "image", "easing", "gradient", "particle", "dotmap", "signal"] as const;

const APP_HREFS: Record<typeof APP_KEYS[number], string> = {
  color:    "/apps/color",
  shader:   "/apps/shader",
  image:    "/apps/image",
  easing:   "/apps/easing",
  gradient: "/apps/gradient",
  particle: "/apps/particle",
  dotmap:   "/apps/dotmap",
  signal:   "/apps/signal",
};

export default function Home() {
  const { lang, toggle, t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#d8d8da] text-[#242424] px-6 py-10 md:px-12 md:py-12">

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
          <PushButton onClick={toggle} variant="dark" size="sm">
            [ {lang === "ja" ? "EN" : "JA"} ]
          </PushButton>
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5 mb-14">
        {APP_KEYS.map((key) => {
          const href = APP_HREFS[key];
          const app = t.apps[key];
          return (
            <Link
              key={href}
              href={href}
              className={[
                "no-underline block relative overflow-hidden select-none",
                "rounded-[14px]",
                "bg-[linear-gradient(180deg,#e8e8e9_0%,#d4d4d6_100%)]",
                "border border-[rgba(0,0,0,0.18)]",
                "[box-shadow:0_3px_0_#b8b8bc,0_4px_8px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.72)]",
                "active:translate-y-[3px] active:[box-shadow:0_0_0_#b8b8bc,inset_0_1px_4px_rgba(0,0,0,0.1)]",
                "transition-[transform,box-shadow] duration-[50ms]",
                "h-28 md:h-32 p-4 pl-5 flex flex-col justify-between",
              ].join(" ")}
            >
              <div>
                <p className="text-[12px] font-mono uppercase tracking-[0.08em] text-[#1a1a1a] font-bold mb-2">
                  {app.name}
                </p>
                <p className="text-[10px] font-mono text-[#555] leading-relaxed">
                  {app.description}
                </p>
              </div>
              {/* Bottom-right label */}
              <p className="text-[12px] font-mono uppercase tracking-[0.14em] text-[#aaa] text-right">
                {key}
              </p>
            </Link>
          );
        })}
      </div>

    </div>
  );
}
