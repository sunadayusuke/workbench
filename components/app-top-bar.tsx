"use client";

import Link from "next/link";
import { PushButton } from "@/components/ui/push-button";
import { useLanguage } from "@/lib/i18n";

export function AppTopBar() {
  const { lang, toggle, t } = useLanguage();
  return (
    <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3 md:p-4 z-10 pointer-events-none [&>*]:pointer-events-auto">
      <Link href="/">
        <PushButton variant="dark" size="sm">[ {t.back} ]</PushButton>
      </Link>
      <PushButton onClick={toggle} variant="dark" size="sm">
        [ {lang === "ja" ? "EN" : "JA"} ]
      </PushButton>
    </div>
  );
}
