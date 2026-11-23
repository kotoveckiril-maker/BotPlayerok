import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker-сборка использует standalone-выход (STANDALONE=1).
  // Обычный `npm start` работает без него.
  ...(process.env.STANDALONE === "1" ? { output: "standalone" as const } : {}),
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
