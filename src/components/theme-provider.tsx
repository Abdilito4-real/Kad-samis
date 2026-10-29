"use client";

import type { ComponentProps } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

// Prop types derived from the component itself rather than imported from
// "next-themes/dist/types" — that deep import reaches past the package's
// public API into its internal file layout, which a minor/patch bump can
// (and did — see the dependabot build failure this replaced) restructure
// out from under it. next-themes doesn't re-export ThemeProviderProps from
// its main entry point, so ComponentProps<typeof NextThemesProvider> is the
// version-agnostic way to get the same type safety without depending on
// where the library happens to keep its .d.ts files internally.
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
