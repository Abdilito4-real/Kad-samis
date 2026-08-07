"use client";

import { useState } from "react";
import { Download, PlusSquare, Share } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { cn } from "@/lib/utils";

interface DownloadAppButtonProps {
  className?: string;
  variant?: "solid" | "outline";
}

/**
 * Landing-page "Download app" CTA. Kadsamis has no app-store listing — this
 * triggers the browser's native PWA install prompt where that API exists
 * (Chrome/Edge/Android), and falls back to a short "how to install"
 * explainer everywhere else (iOS Safari has no install API at all; other
 * browsers may not have fired beforeinstallprompt yet). Renders nothing
 * once the app is already running installed, since there's nothing left to
 * offer.
 */
export function DownloadAppButton({ className, variant = "solid" }: DownloadAppButtonProps) {
  const { canInstall, promptInstall, isInstalled, isIOS } = useInstallPrompt();
  const [showHelp, setShowHelp] = useState(false);

  if (isInstalled) return null;

  const handleClick = async () => {
    if (canInstall) {
      await promptInstall();
      return;
    }
    setShowHelp(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          variant === "solid"
            ? "inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
            : "inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition hover:border-emerald-400/40 hover:text-emerald-500",
          className
        )}
      >
        <Download className="h-4 w-4" />
        Download App
      </button>

      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Install Kadsamis</DialogTitle>
            <DialogDescription>
              {isIOS
                ? "Your browser doesn't support one-tap install — add it from the share menu instead:"
                : "Your browser doesn't support one-tap install right now — you can still add it manually:"}
            </DialogDescription>
          </DialogHeader>

          {isIOS ? (
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">1</span>
                <span className="flex items-center gap-1.5">
                  Tap the Share icon <Share className="h-4 w-4 shrink-0" /> in Safari's toolbar.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">2</span>
                <span className="flex items-center gap-1.5">
                  Scroll down and tap <PlusSquare className="h-4 w-4 shrink-0" /> "Add to Home Screen".
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">3</span>
                <span>Tap Add — Kadsamis now opens full-screen from your home screen, like any other app.</span>
              </li>
            </ol>
          ) : (
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">1</span>
                <span>Open your browser's menu (usually ⋮ or ⋯ in the toolbar).</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">2</span>
                <span>Look for "Install Kadsamis…", "Add to Home screen", or "Apps → Install this site as an app".</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">3</span>
                <span>Confirm — Kadsamis then opens in its own window, without the browser's address bar.</span>
              </li>
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
