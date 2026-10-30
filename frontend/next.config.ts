import type { NextConfig } from 'next';

// The browser calls /api on this origin; Next forwards it to the FastAPI backend
// (the `backend` container in production, a local uvicorn in development).
const api = process.env.API_ORIGIN ?? 'http://127.0.0.1:8000';

const config: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: { root: __dirname },
  agentRules: false,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${api}/api/:path*` }];
  },
  experimental: {
    // AI drafts and GitHub calls can take up to a couple of minutes.
    proxyTimeout: 300_000,
  },
};

export default config;
