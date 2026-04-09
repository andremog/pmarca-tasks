import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Suppress hydration warnings from browser extensions
  reactStrictMode: true,
};

export default nextConfig;
