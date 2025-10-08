/**
 * Image Optimization Utilities
 *
 * Features:
 * - Automatic format detection (WebP, AVIF)
 * - Responsive image sizing
 * - Lazy loading helpers
 * - LQIP (Low Quality Image Placeholder) generation
 * - CDN integration
 */

import type { ImageLoaderProps } from 'next/image'

// ========================
// IMAGE SIZE CONFIGURATIONS
// ========================

export const IMAGE_SIZES = {
  thumbnail: { width: 128, height: 128, quality: 75 },
  avatar: { width: 256, height: 256, quality: 85 },
  card: { width: 400, height: 300, quality: 80 },
  hero: { width: 1920, height: 1080, quality: 85 },
  full: { width: 2560, height: 1440, quality: 90 },
} as const

export const RESPONSIVE_SIZES = {
  mobile: '(max-width: 640px) 100vw',
  tablet: '(max-width: 1024px) 80vw',
  desktop: '(max-width: 1920px) 60vw',
  wide: '50vw',
}

// ========================
// IMAGE LOADER (CDN Integration)
// ========================

/**
 * Custom image loader for CDN or custom image service
 * Can be configured to work with Cloudinary, Imgix, Cloudflare Images, etc.
 */
export function customImageLoader({ src, width, quality }: ImageLoaderProps): string {
  const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL

  if (cdnUrl) {
    // Example for Cloudflare Images or similar CDN
    return `${cdnUrl}/${src}?w=${width}&q=${quality || 75}&f=auto`
  }

  // Fallback to Next.js default
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality || 75}`
}

// ========================
// RESPONSIVE SIZE HELPERS
// ========================

/**
 * Generate responsive sizes string for different breakpoints
 */
export function generateResponsiveSizes(config: {
  mobile?: string
  tablet?: string
  desktop?: string
  wide?: string
}): string {
  const sizes: string[] = []

  if (config.mobile) sizes.push(`(max-width: 640px) ${config.mobile}`)
  if (config.tablet) sizes.push(`(max-width: 1024px) ${config.tablet}`)
  if (config.desktop) sizes.push(`(max-width: 1920px) ${config.desktop}`)
  if (config.wide) sizes.push(config.wide)

  return sizes.join(', ') || '100vw'
}

/**
 * Get optimal image size based on viewport
 */
export function getOptimalImageSize(type: keyof typeof IMAGE_SIZES) {
  return IMAGE_SIZES[type]
}

// ========================
// LQIP (Low Quality Image Placeholder)
// ========================

/**
 * Generate LQIP blur data URL for placeholder
 */
export function generateLQIP(width = 10, height = 10): string {
  // This generates a tiny base64 placeholder
  // In production, this would be generated at build time
  const canvas = typeof window !== 'undefined' ? document.createElement('canvas') : null
  if (!canvas) {
    // Server-side fallback
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${width} ${height}'%3E%3Crect width='${width}' height='${height}' fill='%23f3f4f6'/%3E%3C/svg%3E`
  }

  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  if (ctx) {
    // Create gradient placeholder
    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, '#f3f4f6')
    gradient.addColorStop(1, '#e5e7eb')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  }

  return canvas.toDataURL('image/jpeg', 0.1)
}

// ========================
// IMAGE FORMAT DETECTION
// ========================

/**
 * Check if browser supports modern image formats
 */
export function supportsWebP(): boolean {
  if (typeof window === 'undefined') return false

  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1

  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0
}

export function supportsAVIF(): boolean {
  if (typeof window === 'undefined') return false

  // AVIF support check
  const avif = new Image()
  avif.src =
    'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A='

  return new Promise<boolean>((resolve) => {
    avif.onload = () => resolve(true)
    avif.onerror = () => resolve(false)
  }) as any
}

// ========================
// IMAGE OPTIMIZATION PRESETS
// ========================

export const imagePresets = {
  avatar: {
    width: 256,
    height: 256,
    quality: 85,
    placeholder: 'blur',
    sizes: generateResponsiveSizes({ mobile: '64px', tablet: '128px', desktop: '256px' }),
  },
  thumbnail: {
    width: 400,
    height: 300,
    quality: 80,
    placeholder: 'blur',
    sizes: generateResponsiveSizes({ mobile: '100vw', tablet: '50vw', desktop: '33vw' }),
  },
  hero: {
    width: 1920,
    height: 1080,
    quality: 85,
    priority: true,
    sizes: '100vw',
  },
  card: {
    width: 600,
    height: 400,
    quality: 80,
    placeholder: 'blur',
    sizes: generateResponsiveSizes({ mobile: '100vw', tablet: '50vw', desktop: '400px' }),
  },
} as const

// ========================
// LAZY LOADING HELPERS
// ========================

/**
 * Intersection Observer for lazy loading images
 */
export function createImageObserver(
  callback: (entry: IntersectionObserverEntry) => void,
  options?: IntersectionObserverInit
): IntersectionObserver | null {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    return null
  }

  return new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        callback(entry)
      }
    })
  }, options || { rootMargin: '50px' })
}

/**
 * Preload critical images
 */
export function preloadImage(src: string, as: 'image' = 'image'): void {
  if (typeof window === 'undefined') return

  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = as
  link.href = src

  // Add modern format hints
  if (supportsWebP()) {
    link.type = 'image/webp'
  }

  document.head.appendChild(link)
}

/**
 * Preload multiple images
 */
export function preloadImages(images: string[]): void {
  images.forEach((src) => preloadImage(src))
}

// ========================
// IMAGE COMPRESSION UTILITIES
// ========================

/**
 * Calculate optimal quality based on image size
 */
export function calculateOptimalQuality(width: number, height: number): number {
  const pixels = width * height

  if (pixels < 100000) return 90 // Small images: high quality
  if (pixels < 500000) return 85 // Medium images: good quality
  if (pixels < 1000000) return 80 // Large images: balanced
  return 75 // Very large images: compressed
}

/**
 * Get image dimensions from URL or file
 */
export async function getImageDimensions(
  src: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('getImageDimensions only works in browser'))
      return
    }

    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = reject
    img.src = src
  })
}

// ========================
// CDN HELPERS
// ========================

/**
 * Generate Cloudflare Images URL
 */
export function cloudflareImageUrl(
  imageId: string,
  options: {
    width?: number
    height?: number
    quality?: number
    format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png'
    fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad'
  } = {}
): string {
  const accountHash = process.env.NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_HASH
  if (!accountHash) return imageId

  const params = new URLSearchParams()
  if (options.width) params.set('width', options.width.toString())
  if (options.height) params.set('height', options.height.toString())
  if (options.quality) params.set('quality', options.quality.toString())
  if (options.format) params.set('format', options.format)
  if (options.fit) params.set('fit', options.fit)

  return `https://imagedelivery.net/${accountHash}/${imageId}/${params.toString()}`
}

/**
 * Generate Cloudinary URL
 */
export function cloudinaryImageUrl(
  publicId: string,
  options: {
    width?: number
    height?: number
    quality?: number
    format?: string
    crop?: string
  } = {}
): string {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  if (!cloudName) return publicId

  const transformations: string[] = []

  if (options.width) transformations.push(`w_${options.width}`)
  if (options.height) transformations.push(`h_${options.height}`)
  if (options.quality) transformations.push(`q_${options.quality}`)
  if (options.format) transformations.push(`f_${options.format}`)
  if (options.crop) transformations.push(`c_${options.crop}`)

  const transform = transformations.join(',')
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transform}/${publicId}`
}

// ========================
// EXPORT HELPER COMPONENTS
// ========================

export const ImageHelpers = {
  preload: preloadImage,
  preloadMultiple: preloadImages,
  getDimensions: getImageDimensions,
  generateLQIP,
  supportsWebP,
  supportsAVIF,
  calculateOptimalQuality,
  createObserver: createImageObserver,
}

export default {
  loader: customImageLoader,
  presets: imagePresets,
  sizes: IMAGE_SIZES,
  helpers: ImageHelpers,
}
