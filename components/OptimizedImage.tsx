/**
 * OptimizedImage Component
 * High-performance image loading with Next.js Image optimization
 */

'use client'

import Image, { ImageProps } from 'next/image'
import { useState, useEffect } from 'react'

interface OptimizedImageProps extends Omit<ImageProps, 'placeholder'> {
  /**
   * Show blur placeholder while loading
   * @default true
   */
  showPlaceholder?: boolean

  /**
   * Custom blur data URL
   */
  blurDataURL?: string

  /**
   * Priority loading (disable lazy loading)
   * @default false
   */
  priority?: boolean

  /**
   * Quality (1-100)
   * @default 75
   */
  quality?: number

  /**
   * Fallback image on error
   */
  fallbackSrc?: string

  /**
   * CSS class for container
   */
  containerClassName?: string
}

/**
 * Generate a simple blur placeholder
 */
function generateBlurDataURL(width: number = 8, height: number = 8): string {
  // Simple gray gradient as placeholder
  return `data:image/svg+xml;base64,${Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:rgb(240,240,240);stop-opacity:1" />
          <stop offset="100%" style="stop-color:rgb(200,200,200);stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)"/>
    </svg>`
  ).toString('base64')}`
}

/**
 * OptimizedImage - Highly optimized image component
 *
 * Features:
 * - Automatic AVIF/WebP conversion
 * - Lazy loading by default
 * - Blur placeholder
 * - Error fallback
 * - Responsive sizes
 * - CDN optimization
 *
 * @example
 * ```tsx
 * <OptimizedImage
 *   src="/uploads/ticket-123.jpg"
 *   alt="Ticket attachment"
 *   width={800}
 *   height={600}
 *   priority={false}
 * />
 * ```
 */
export default function OptimizedImage({
  showPlaceholder = true,
  blurDataURL,
  priority = false,
  quality = 75,
  fallbackSrc = '/images/placeholder.jpg',
  containerClassName,
  alt,
  onError,
  ...props
}: OptimizedImageProps) {
  const [imgSrc, setImgSrc] = useState(props.src)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setImgSrc(props.src)
    setHasError(false)
  }, [props.src])

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!hasError) {
      setHasError(true)
      setImgSrc(fallbackSrc)
      console.warn('[OptimizedImage] Failed to load:', props.src)
    }
    onError?.(e)
  }

  // Generate blur placeholder if needed
  const placeholder = showPlaceholder && !priority ? 'blur' : 'empty'
  const blurData =
    blurDataURL ||
    (typeof props.width === 'number' && typeof props.height === 'number'
      ? generateBlurDataURL(props.width, props.height)
      : undefined)

  return (
    <div className={containerClassName}>
      <Image
        {...props}
        src={imgSrc}
        alt={alt}
        quality={quality}
        priority={priority}
        placeholder={placeholder}
        blurDataURL={blurData}
        onError={handleError}
        // Optimize loading
        loading={priority ? 'eager' : 'lazy'}
        // Improve LCP for above-the-fold images
        fetchPriority={priority ? 'high' : 'auto'}
        // Add dimensions for CLS prevention
        style={{
          maxWidth: '100%',
          height: 'auto',
          ...props.style,
        }}
      />
    </div>
  )
}

/**
 * OptimizedAvatar - Optimized circular avatar component
 */
export function OptimizedAvatar({
  src,
  alt,
  size = 40,
  className = '',
  fallbackSrc = '/images/default-avatar.jpg',
  ...props
}: {
  src: string
  alt: string
  size?: number
  className?: string
  fallbackSrc?: string
} & Partial<OptimizedImageProps>) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={size}
      height={size}
      fallbackSrc={fallbackSrc}
      quality={85}
      className={`rounded-full ${className}`}
      {...props}
    />
  )
}

/**
 * OptimizedBackground - Optimized background image component
 */
export function OptimizedBackground({
  src,
  alt = 'Background',
  priority = false,
  className = '',
  children,
  overlay = false,
  overlayOpacity = 0.5,
  ...props
}: {
  src: string
  alt?: string
  priority?: boolean
  className?: string
  children?: React.ReactNode
  overlay?: boolean
  overlayOpacity?: number
} & Partial<OptimizedImageProps>) {
  return (
    <div className={`relative ${className}`}>
      <OptimizedImage
        src={src}
        alt={alt}
        fill
        priority={priority}
        quality={60} // Lower quality for backgrounds
        style={{
          objectFit: 'cover',
          objectPosition: 'center',
        }}
        {...props}
      />
      {overlay && (
        <div
          className="absolute inset-0 bg-black"
          style={{ opacity: overlayOpacity }}
        />
      )}
      {children && (
        <div className="relative z-10">
          {children}
        </div>
      )}
    </div>
  )
}

/**
 * OptimizedThumbnail - Optimized small thumbnail
 */
export function OptimizedThumbnail({
  src,
  alt,
  size = 64,
  className = '',
  ...props
}: {
  src: string
  alt: string
  size?: number
  className?: string
} & Partial<OptimizedImageProps>) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={size}
      height={size}
      quality={60} // Lower quality for thumbnails
      className={`rounded ${className}`}
      {...props}
    />
  )
}

/**
 * OptimizedLogo - Optimized logo with priority loading
 */
export function OptimizedLogo({
  src,
  alt,
  width = 120,
  height = 40,
  className = '',
  ...props
}: {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
} & Partial<OptimizedImageProps>) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={width}
      height={height}
      quality={90}
      priority={true} // Logos are usually above-the-fold
      className={className}
      {...props}
    />
  )
}
