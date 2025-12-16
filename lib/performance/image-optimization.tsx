'use client'

import React, { useState, useEffect, useRef } from 'react'

export interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  priority?: boolean
  quality?: number
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
  onLoad?: () => void
  onError?: () => void
}

/**
 * Optimized Image Component with lazy loading and blur placeholder
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  quality: _quality = 75,
  placeholder = 'blur',
  blurDataURL,
  onLoad,
  onError
}) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(priority)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (priority || !imgRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setIsInView(true)
            observer.disconnect()
          }
        })
      },
      {
        rootMargin: '50px'
      }
    )

    observer.observe(imgRef.current)

    return () => observer.disconnect()
  }, [priority])

  const handleLoad = () => {
    setIsLoaded(true)
    onLoad?.()
  }

  const handleError = () => {
    onError?.()
  }

  // Generate blur placeholder if not provided
  const defaultBlurDataURL = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNlNWU3ZWIiLz48L3N2Zz4='

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        width: width ? `${width}px` : '100%',
        height: height ? `${height}px` : 'auto'
      }}
    >
      {/* Blur Placeholder */}
      {placeholder === 'blur' && !isLoaded && (
        <img
          src={blurDataURL || defaultBlurDataURL}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-sm scale-110"
          aria-hidden="true"
        />
      )}

      {/* Actual Image */}
      <img
        ref={imgRef}
        src={isInView ? src : undefined}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        className={`
          w-full h-full object-cover
          transition-opacity duration-300
          ${isLoaded ? 'opacity-100' : 'opacity-0'}
        `}
      />
    </div>
  )
}

/**
 * Progressive Image Component
 * Loads low-quality placeholder first, then high-quality version
 */
export interface ProgressiveImageProps {
  lowQualitySrc: string
  highQualitySrc: string
  alt: string
  className?: string
}

export const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  lowQualitySrc,
  highQualitySrc,
  alt,
  className = ''
}) => {
  const [currentSrc, setCurrentSrc] = useState(lowQualitySrc)
  const [isHighQualityLoaded, setIsHighQualityLoaded] = useState(false)

  useEffect(() => {
    const img = new Image()
    img.src = highQualitySrc
    img.onload = () => {
      setCurrentSrc(highQualitySrc)
      setIsHighQualityLoaded(true)
    }
  }, [highQualitySrc])

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={`
        ${className}
        transition-all duration-300
        ${!isHighQualityLoaded ? 'blur-sm' : 'blur-0'}
      `}
    />
  )
}

/**
 * Responsive Image Component
 * Serves different image sizes based on viewport
 */
export interface ResponsiveImageProps {
  srcSet: {
    mobile: string
    tablet: string
    desktop: string
  }
  alt: string
  className?: string
}

export const ResponsiveImage: React.FC<ResponsiveImageProps> = ({
  srcSet,
  alt,
  className = ''
}) => {
  return (
    <picture>
      <source media="(max-width: 768px)" srcSet={srcSet.mobile} />
      <source media="(max-width: 1024px)" srcSet={srcSet.tablet} />
      <source media="(min-width: 1025px)" srcSet={srcSet.desktop} />
      <img
        src={srcSet.desktop}
        alt={alt}
        className={className}
        loading="lazy"
        decoding="async"
      />
    </picture>
  )
}
