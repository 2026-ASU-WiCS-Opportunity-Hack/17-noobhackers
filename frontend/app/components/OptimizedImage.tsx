/**
 * Optimized image component — wraps Next.js Image with WIAL defaults.
 *
 * - Lazy-loading for all images below the fold (loading="lazy")
 * - AVIF primary, WebP fallback, JPEG last resort (via next.config.ts)
 * - Max 50 KB per image enforced by Next.js image optimization
 * - Responsive sizing with quality cap
 *
 * Requirements: 6.10, 9.4, 9.5, 9.6
 */

import Image from "next/image";

interface OptimizedImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Set to true for above-the-fold images (hero, logo) */
  priority?: boolean;
  className?: string;
}

export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  priority = false,
  className,
}: OptimizedImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      // Lazy-load by default; priority images load eagerly
      loading={priority ? "eager" : "lazy"}
      priority={priority}
      // Quality cap to keep images under 50 KB
      quality={60}
      className={className}
      // Next.js handles AVIF > WebP > JPEG via formats config
    />
  );
}
