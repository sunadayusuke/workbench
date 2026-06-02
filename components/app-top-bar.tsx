"use client";

import Link from "next/link";
import { LangToggle } from "@/components/ui/lang-toggle";
import { useLanguage } from "@/lib/i18n";

export function AppTopBar() {
  const { t } = useLanguage();
  return (
    <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-3 md:p-4 pointer-events-none [&>*]:pointer-events-auto">
      <Link
        href="/"
        className="inline-flex h-10 select-none items-center rounded-full border border-white bg-white/70 px-4 text-[14px] font-semibold text-wb-900 backdrop-blur-[20px] shadow-[0px_2px_36px_-8px_rgba(0,0,0,0.16)] transition-colors hover:bg-white/90"
      >
        {t.back}
      </Link>
      <LangToggle />
    </div>
  );
}
