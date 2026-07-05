"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useLang } from "@/lib/i18n";
import { useState, useEffect } from "react";

export function Header() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { lang, setLang, t } = useLang();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <header className="bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border sticky top-0 z-40 shadow-sm transition-colors duration-300">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link className="flex items-center gap-2" href="/">
          <span className="text-xl md:text-2xl font-black text-brand">TTS Pro</span>
        </Link>

        {/* Nav */}
        <div className="flex items-center gap-4 md:gap-6">
          {/* Pet News link */}
          <Link
            href="/pet-news"
            className={`font-bold flex items-center gap-1 transition ${
              pathname?.startsWith("/pet-news")
                ? "text-brand"
                : "text-gray-600 dark:text-gray-300 hover:text-brand"
            }`}
          >
            <span>{"\uD83D\uDCFA"}</span>
            <span className="hidden sm:inline">{t("pet_news_nav")}</span>
          </Link>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-700" />

          {/* Language switcher */}
          <button
            onClick={() => setLang(lang === "vi" ? "en" : "vi")}
            className="flex items-center gap-1 text-gray-600 dark:text-gray-300 hover:text-brand transition font-bold"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m10.5 21 5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 0 1 6-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 0 1-3.827-5.802" />
            </svg>
            <span className="uppercase text-sm">{lang}</span>
          </button>

          {/* Theme toggle */}
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="text-gray-600 dark:text-gray-300 hover:text-brand transition"
              title="Toggle theme"
            >
              {theme === "dark" ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
