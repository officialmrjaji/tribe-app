import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        hostname: "img.clerk.com",
        protocol: "https",
      },
      {
        hostname: "*.clerk.accounts.dev",
        protocol: "https",
      },
      {
        hostname: "subveleqwhbnnwhzycyu.supabase.co",
        protocol: "https",
      },
    ],
  },
};

export default nextConfig;
