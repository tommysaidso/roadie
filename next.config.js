/** @type {import('next').NextConfig} */
// Rocky talks to mymymy's FastAPI for catalog/works data when available.
const MYMYMY_API = process.env.MYMYMY_API_URL || "http://localhost:8000";
module.exports = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ["better-sqlite3"],
  async rewrites() {
    return [
      // proxy mymymy catalog endpoints under /mymymy/* for the browser
      { source: "/mymymy/:path*", destination: `${MYMYMY_API}/:path*` },
    ];
  },
};
