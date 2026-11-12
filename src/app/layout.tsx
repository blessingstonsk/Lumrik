import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { AuthProvider } from "@/components/providers/auth";
import { LearnerProvider } from "@/components/providers/learner";
import { MotionProvider } from "@/components/providers/motion";
import { ThemeProvider, themeInitScript } from "@/components/providers/theme";
import { ToastProvider } from "@/components/providers/toast";
import { ServiceWorker } from "@/components/service-worker";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter", display: "swap" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap", weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "Lumrik – Learn Languages Smarter", template: "%s · Lumrik" },
  description: "Bite-sized lessons, spaced-repetition flashcards, speaking practice and an AI conversation tutor.",
  applicationName: "Lumrik",
  appleWebApp: { capable: true, title: "Lumrik", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
};

// Noto families for Indic & CJK scripts. Browsers only download the unicode ranges a page uses.
const NOTO =
  "https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&family=Noto+Sans+Tamil:wght@400;600;700&family=Noto+Sans+Malayalam:wght@400;600;700&family=Noto+Sans+Telugu:wght@400;600;700&family=Noto+Sans+Kannada:wght@400;600;700&family=Noto+Sans+JP:wght@400;700&family=Noto+Sans+KR:wght@400;700&display=swap";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href={NOTO} />
      </head>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-white">
          Skip to content
        </a>
        <MotionProvider>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <LearnerProvider>{children}</LearnerProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
        </MotionProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
