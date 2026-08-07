import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Applied to every route. This is app-level defense-in-depth, not a
// replacement for a real WAF/edge firewall (Cloudflare, Vercel's own
// platform-level DDoS mitigation, etc.) — those sit in front of the
// request before it ever reaches this code and block volumetric/bot
// traffic this can't see. These headers protect against what a WAF
// doesn't: clickjacking, MIME-sniffing, and script/connection injection
// once a request does arrive.
//
// The CSP intentionally still allows 'unsafe-inline'/'unsafe-eval' for
// scripts — Next.js's own hydration bootstrap and Tailwind/Radix's inline
// styles need it, and moving to a strict nonce-based policy is a larger,
// separate change. What it does block: loading scripts from or sending
// data to any origin other than this app and Supabase — the actual
// injection vector a text-input XSS would try to use.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  // Only takes effect over HTTPS anyway, so this is a no-op in local dev —
  // safe to always send. `preload` is left off since that requires
  // submitting the domain to browsers' HSTS preload list, a one-way
  // decision you should opt into deliberately, not as a side effect here.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://tile.openstreetmap.org",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://*.ingest.sentry.io",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "tile.openstreetmap.org",
      },
    ],
    unoptimized: process.env.NODE_ENV === "development",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Force revalidation so an updated service worker is picked up
        // promptly instead of browsers serving a stale cached copy.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    config.externals.push("pino-pretty", "encoding");
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
  serverExternalPackages: ["@supabase/supabase-js", "@supabase/ssr"],
};

// withSentryConfig wraps the build to upload source maps for readable
// stack traces — it needs SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN to
// actually upload anything, but is safe to leave enabled unconditionally:
// with those unset it just skips the upload step silently rather than
// failing the build (`silent: true` below also quiets that expected case).
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  widenClientFileUpload: true,
  webpack: {
    // Current names for what were `disableLogger`/`automaticVercelMonitors`
    // — those top-level options are deprecated in this SDK version.
    treeshake: { removeDebugLogging: true },
    automaticVercelMonitors: true,
  },
});
