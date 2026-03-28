import type { NextConfig } from "next";

/**
 * Next.js configuration with image optimization.
 *
 * - AVIF primary, WebP fallback (JPEG handled natively by Next.js Image)
 * - Brotli compression enabled by default in Next.js production builds
 * - Image size limits enforced at the component level
 *
 * Requirements: 6.10, 9.4, 9.5, 9.6, 9.7, 1.4
 */
const nextConfig: NextConfig = {
  images: {
    // AVIF first, then WebP — Next.js Image component uses this order
    formats: ["image/avif", "image/webp"],
    // Max image sizes for responsive srcset generation
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    // Allow images from S3 bucket and placeholder domains
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "wial-platform-assets.s3.amazonaws.com",
      },
    ],
  },
  // Brotli compression is enabled by default in Next.js production
  compress: true,
};

export default nextConfig;
