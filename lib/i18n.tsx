"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { translations, Translations } from "./translations";

type Lang = "ja" | "en";

interface LangContextValue {
  lang: Lang;
  toggle: () => void;
  t: Translations;
}

const LangContext = createContext<LangContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    const saved = localStorage.getItem("lang") as Lang | null;
    if (saved === "en" || saved === "ja") {
      setLang(saved);
    } else {
      setLang(navigator.language.startsWith("ja") ? "ja" : "en");
    }
  }, []);

  const toggle = useCallback(() => {
    setLang((prev) => {
      const next = prev === "ja" ? "en" : "ja";
      localStorage.setItem("lang", next);
      return next;
    });
  }, []);

  return (
    <LangContext.Provider value={{ lang, toggle, t: translations[lang] }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
