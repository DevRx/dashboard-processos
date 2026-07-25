import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/",
        destination: "/api/home",
      },
      {
        source: "/login",
        destination: "/api/login",
      },
      {
        source: "/register",
        destination: "/api/register",
      },
    ]
  },
}

export default nextConfig
