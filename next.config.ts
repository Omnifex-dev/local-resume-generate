import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a verification build use its own folder (npm run build:check) so it
  // never overwrites the files of a running `next dev` in .next/.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Native / Node-only packages must not be bundled into server chunks.
  serverExternalPackages: ["@node-rs/argon2", "pino", "word-extractor"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
