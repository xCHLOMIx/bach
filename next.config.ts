import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  compress: true, // Enable gzip compression
  productionBrowserSourceMaps: false, // Reduce bundle size in production
  experimental: {
    optimizePackageImports: ["recharts", "lucide-react"], // Tree-shake unused exports
  },
};

export default nextConfig;
