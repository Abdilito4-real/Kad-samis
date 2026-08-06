import type { NextConfig } from "next";

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

export default nextConfig;
