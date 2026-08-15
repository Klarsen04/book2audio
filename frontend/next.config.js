/** @type {import('next').NextConfig} */

// Where /api/* is proxied:
// - BACKEND_URL set (docker-compose, self-host) → use it.
// - On Vercel with no BACKEND_URL → no rewrite here, so vercel.json's
//   rewrite to the Render backend applies instead.
// - Bare local dev → the backend on localhost:8000.
const backendUrl =
  process.env.BACKEND_URL || (process.env.VERCEL ? null : "http://localhost:8000");

const nextConfig = {
  output: "standalone",
  async rewrites() {
    if (!backendUrl) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
