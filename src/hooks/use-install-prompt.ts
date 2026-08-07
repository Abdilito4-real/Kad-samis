"use client";

import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

/**
 * Drives the landing page's "Download app" button. Kadsamis is a PWA
 * (public/manifest.json + public/sw.js) rather than something distributed
 * through an app store, so "downloading" it means triggering the browser's
 * native install flow.
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // The service worker previously only registered once a user opted into
    // push notifications on the settings page — most people landing on "/"
    // never triggered that, and Chrome/Edge won't fire beforeinstallprompt
    // without an active registration. Registering it here as soon as the
    // landing page loads is what actually makes the button work.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const standaloneDisplay = window.matchMedia("(display-mode: standalone)").matches;
    const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(standaloneDisplay || iosStandalone);

    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  // A captured beforeinstallprompt event can only be used once — clear it
  // either way so a second click falls through to the manual-instructions
  // path instead of silently doing nothing.
  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return null;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return choice.outcome;
  }, [deferredPrompt]);

  return { canInstall: !!deferredPrompt, promptInstall, isInstalled, isIOS };
}
