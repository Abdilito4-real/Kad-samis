"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

// Sonner's own theme defaults to "light" unless told otherwise, so toasts
// rendered a bright white card on top of the dark dashboard. Wiring it to
// next-themes keeps toasts in sync with whichever theme is active.
export function AppToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      expand
      visibleToasts={5}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
    />
  );
}
