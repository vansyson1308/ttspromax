import type { Metadata } from "next";
import "./globals.css";
import { ClientProviders } from "./providers";

export const metadata: Metadata = {
  title: "TTS Pro | Free AI Text to Speech & Pet News Studio",
  description:
    "Free AI text-to-speech with 350+ voices and a Pet News studio that turns any cat/dog photo into a lip-synced news broadcast. No registration, runs in your browser.",
  keywords:
    "free text to speech, AI voice generator, vietnamese tts, pet news, talking pet video, lip sync video maker",
  applicationName: "TTS Pro",
  authors: [{ name: "TTS Pro" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        {/* Import map for TalkingHead CDN — maps bare "three" specifiers to CDN */}
        <script
          type="importmap"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              imports: {
                "three": "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js",
                "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/",
              },
            }),
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var cl = document.documentElement.classList;
                var theme = localStorage.getItem('theme');
                if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  cl.add('dark');
                } else {
                  cl.remove('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="bg-gray-50 text-gray-800 dark:bg-dark-bg dark:text-gray-200 transition-colors duration-300 min-h-screen flex flex-col">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
