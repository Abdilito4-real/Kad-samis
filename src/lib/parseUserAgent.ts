/**
 * Turns a raw User-Agent header into a short "Browser on Platform" label
 * for security-facing surfaces (sign-in notifications, passkey device
 * list) — not a full UA parser, just enough to read like "Chrome on
 * Windows" or "Safari on iPhone" instead of the raw UA string.
 */
export function describeUserAgent(userAgent: string | null | undefined): string {
  if (!userAgent) return "Unknown device";

  const ua = userAgent;

  let browser = "Unknown browser";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\//.test(ua)) browser = "Opera";
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = "Chrome";
  else if (/CriOS\//.test(ua)) browser = "Chrome";
  else if (/FxiOS\//.test(ua)) browser = "Firefox";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = "Safari";

  let platform = "Unknown device";
  if (/iPhone/.test(ua)) platform = "iPhone";
  else if (/iPad/.test(ua)) platform = "iPad";
  else if (/Android/.test(ua)) platform = "Android";
  else if (/Macintosh|Mac OS X/.test(ua)) platform = "Mac";
  else if (/Windows/.test(ua)) platform = "Windows";
  else if (/Linux/.test(ua)) platform = "Linux";

  return `${browser} on ${platform}`;
}
