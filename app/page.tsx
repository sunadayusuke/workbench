"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n";
import { LangToggle } from "@/components/ui/lang-toggle";
import { AppPreview } from "@/components/app-preview";

const APP_KEYS = ["color", "shader", "image", "compress", "easing", "gradient", "particle", "dotmap", "signal", "aurora", "badge"] as const;

const APP_HREFS: Record<typeof APP_KEYS[number], string> = {
  color:    "/apps/color",
  shader:   "/apps/shader",
  image:    "/apps/image",
  compress: "/apps/compress",
  easing:   "/apps/easing",
  gradient: "/apps/gradient",
  particle: "/apps/particle",
  dotmap:   "/apps/dotmap",
  signal:   "/apps/signal",
  aurora:   "/apps/aurora",
  badge:    "/apps/badge",
};

export default function Home() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-wb-50 text-wb-900">
      <div className="px-5 pt-6 pb-20 md:px-8 md:pt-8 md:pb-20">

        {/* Header */}
        <header className="mb-6 flex items-center justify-between md:mb-8">
          <img
            src="/images/workbench_logo.svg"
            alt="Workbench"
            className="w-[132px] md:w-[144px]"
            style={{ filter: "brightness(0)" }}
          />
          <div className="flex items-center gap-3 md:gap-4">
            <p className="hidden text-[14px] text-wb-500 md:block">{t.homeSubtitle}</p>
            <a
              href="https://x.com/YusukeSunada"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X"
              className="flex size-10 items-center justify-center opacity-70 transition-opacity hover:opacity-100"
            >
              <img src="/images/x_logo.svg" alt="X" className="w-5" style={{ filter: "brightness(0)" }} />
            </a>
            <LangToggle />
          </div>
        </header>

        {/* App grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {APP_KEYS.map((key) => {
            const href = APP_HREFS[key];
            const app = t.apps[key];
            return (
              <Link
                key={href}
                href={href}
                className="group relative flex select-none flex-col gap-3 rounded-[16px] bg-wb-0 p-3 shadow-[0px_4px_20px_-8px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-[cubic-bezier(0.22,0.61,0.36,1)] will-change-transform hover:-translate-y-1 active:-translate-y-0.5 active:duration-150"
              >
                {/* hover shadow as an opacity crossfade — avoids box-shadow repaint jank */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-[16px] opacity-0 shadow-[0px_18px_40px_-12px_rgba(0,0,0,0.2)] transition-opacity duration-300 ease-out group-hover:opacity-100"
                />
                <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[10px] bg-wb-100 shadow-[0px_8px_10px_-4px_rgba(0,0,0,0.06)]">
                  <AppPreview appKey={key} className="absolute inset-0 transition-transform duration-[450ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] will-change-transform group-hover:scale-[1.04]" />
                </div>
                <div className="relative flex w-full items-end gap-3 p-1">
                  <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                    <p className="truncate text-[14px] font-medium text-wb-900">{app.name}</p>
                    <p className="truncate text-[11px] text-wb-500">{app.description}</p>
                  </div>
                  <span
                    aria-hidden
                    className="shrink-0 text-[16px] leading-none text-wb-400 transition-[color,transform] duration-300 ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:translate-x-1 group-hover:text-wb-600"
                  >
                    →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

      </div>
    </div>
  );
}
