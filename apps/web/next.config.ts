import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "9000",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/chronicle-uploads/:path*",
        destination: "http://localhost:9000/chronicle-uploads/:path*",
      },
    ];
  },
};

export default nextConfig;
