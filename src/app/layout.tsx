import type React from "react";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/auth-provider";
import { AppToaster } from "@/components/app-toaster";
import "./globals.css";

// Self-hosted at build time instead of the old `@import url(fonts.googleapis.com/...)`
// in globals.css — that pattern costs two extra render-blocking round trips
// (fonts.googleapis.com for the CSS, then fonts.gstatic.com for the actual
// font files) before any text can paint. next/font fetches once at build
// time, serves the files from this origin, and inlines the @font-face CSS
// with size-adjusted metrics — no extra connections, no layout shift from a
// fallback-to-webfont swap.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-inter",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth" className={inter.variable}>
      <head>
        <title>Kadsamis</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          name="description"
          content="Kadsamis — Kaduna State Asset Management Information System"
        />
        <meta name="theme-color" content="#ffffff" />
        <meta name="application-name" content="Kadsamis" />
        {/* Home-screen/window label on iOS and installed-PWA title bars on
            desktop both read this instead of falling back to the manifest
            name every time — same reason the manifest name/short_name were
            shortened to match. */}
        <meta name="apple-mobile-web-app-title" content="Kadsamis" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" />
        {/* iOS "Add to Home Screen" doesn't read manifest.json icons — it needs
            its own apple-touch-icon link, otherwise it falls back to a
            screenshot of the page instead of the branded icon. */}
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="min-h-screen bg-background antialiased">
        {/* Light is the first-visit default — next-themes persists to localStorage
            the moment a user explicitly toggles it, and that stored choice always
            wins over defaultTheme on later visits. */}
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <AuthProvider>
            {children}
            <AppToaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
