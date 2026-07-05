"use client";

import { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "react-hot-toast";
import { LangProvider } from "@/lib/i18n";
import { Header } from "./header";
import { Footer } from "./footer";
import ErrorBoundary from "@/components/ErrorBoundary";

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <LangProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <Toaster
          position="top-center"
          toastOptions={{
            style: { background: "#333", color: "#fff", fontWeight: "bold" },
          }}
        />
        <Header />
        <main className="flex-1">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
        <Footer />
      </ThemeProvider>
    </LangProvider>
  );
}
