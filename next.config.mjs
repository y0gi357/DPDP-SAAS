import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const nextConfig = {
  poweredByHeader: false,
  turbopack: { root },
  outputFileTracingRoot: root,
  // Hostnames only: these allow LAN clients to load development assets and HMR.
  // Add another address through DEV_ALLOWED_ORIGINS when the local IP changes.
  allowedDevOrigins: [...new Set([
    "192.168.1.6",
    "192.168.40.128",
    ...(process.env.DEV_ALLOWED_ORIGINS ?? "").split(",").map((host) => host.trim()).filter(Boolean),
  ])],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
      {
        source: "/privacy/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};
export default nextConfig;

