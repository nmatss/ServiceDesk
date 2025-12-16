/**
 * Mobile Performance Optimizations
 * Utilities to improve mobile performance and user experience
 */

/**
 * Remove 300ms tap delay on mobile devices
 */
export function removeTapDelay() {
  if (typeof document !== 'undefined') {
    document.addEventListener('touchstart', () => {}, { passive: true })
  }
}

/**
 * Optimize viewport for mobile devices
 */
export function optimizeViewport() {
  if (typeof document !== 'undefined') {
    // Prevent zoom on input focus
    const viewport = document.querySelector('meta[name=viewport]')
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover')
    }

    // Add iOS web app meta tags
    const metaTags = [
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'theme-color', content: '#0ea5e9' }
    ]

    metaTags.forEach(({ name, content }) => {
      if (!document.querySelector(`meta[name="${name}"]`)) {
        const meta = document.createElement('meta')
        meta.name = name
        meta.content = content
        document.head.appendChild(meta)
      }
    })
  }
}

/**
 * Enable passive event listeners for better scroll performance
 */
export function enablePassiveListeners() {
  if (typeof window !== 'undefined') {
    let supportsPassive = false
    try {
      const opts = Object.defineProperty({}, 'passive', {
        get() {
          supportsPassive = true
        }
      })
      window.addEventListener('testPassive', null as any, opts)
      window.removeEventListener('testPassive', null as any, opts)
    } catch (e) {
      // Passive not supported
    }

    if (supportsPassive) {
      // Override addEventListener to make touch/wheel events passive by default
      const addEventListener = EventTarget.prototype.addEventListener
      EventTarget.prototype.addEventListener = function (type: any, listener: any, options?: any) {
        const passiveEvents = ['touchstart', 'touchmove', 'wheel', 'mousewheel']
        if (passiveEvents.includes(type) && typeof options !== 'object') {
          options = { passive: true }
        }
        return addEventListener.call(this, type, listener, options)
      }
    }
  }
}

/**
 * Optimize font loading for mobile
 */
export function optimizeFontLoading() {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    // Use font-display: swap for better performance
    const style = document.createElement('style')
    style.textContent = `
      @font-face {
        font-display: swap;
      }
    `
    document.head.appendChild(style)

    // Preload critical fonts
    const criticalFonts = [
      '/fonts/inter-var.woff2'
    ]

    criticalFonts.forEach(font => {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'font'
      link.type = 'font/woff2'
      link.crossOrigin = 'anonymous'
      link.href = font
      document.head.appendChild(link)
    })
  }
}

/**
 * Lazy load images with IntersectionObserver
 */
export function lazyLoadImages(): IntersectionObserver | undefined {
  if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement
          const src = img.dataset.src
          if (src) {
            img.src = src
            img.removeAttribute('data-src')
            observer.unobserve(img)
          }
        }
      })
    }, {
      rootMargin: '50px'
    })

    document.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img)
    })

    return imageObserver
  }

  return undefined
}

/**
 * Optimize scroll performance with requestAnimationFrame
 */
export function optimizeScroll(callback: () => void) {
  let ticking = false

  const handleScroll = () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        callback()
        ticking = false
      })
      ticking = true
    }
  }

  window.addEventListener('scroll', handleScroll, { passive: true })

  return () => {
    window.removeEventListener('scroll', handleScroll)
  }
}

/**
 * Debounce resize events
 */
export function optimizeResize(callback: () => void, delay = 150) {
  let timeoutId: NodeJS.Timeout

  const handleResize = () => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(callback, delay)
  }

  window.addEventListener('resize', handleResize, { passive: true })

  return () => {
    clearTimeout(timeoutId)
    window.removeEventListener('resize', handleResize)
  }
}

/**
 * Reduce animations on low-end devices
 */
export function reduceAnimationsOnLowEnd(): boolean {
  if (typeof navigator !== 'undefined') {
    const connection = (navigator as any).connection ||
                      (navigator as any).mozConnection ||
                      (navigator as any).webkitConnection

    // Detect low-end device conditions
    const isLowEnd = (
      // Slow network
      (connection && (connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g')) ||
      // Low memory (if available)
      ((navigator as any).deviceMemory && (navigator as any).deviceMemory < 4) ||
      // Reduced motion preference
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )

    if (isLowEnd && typeof document !== 'undefined') {
      document.documentElement.classList.add('reduce-animations')

      // Add CSS to reduce animations
      const style = document.createElement('style')
      style.textContent = `
        .reduce-animations * {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      `
      document.head.appendChild(style)
    }

    return isLowEnd
  }

  return false
}

/**
 * Preconnect to critical origins
 */
export function preconnectCriticalOrigins(origins: string[]) {
  if (typeof document !== 'undefined') {
    origins.forEach(origin => {
      const link = document.createElement('link')
      link.rel = 'preconnect'
      link.href = origin
      link.crossOrigin = 'anonymous'
      document.head.appendChild(link)
    })
  }
}

/**
 * Resource hints for better performance
 */
export function addResourceHints() {
  if (typeof document !== 'undefined') {
    const hints = [
      { rel: 'dns-prefetch', href: '//fonts.googleapis.com' },
      { rel: 'dns-prefetch', href: '//fonts.gstatic.com' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' }
    ]

    hints.forEach(({ rel, href, crossOrigin }) => {
      const link = document.createElement('link')
      link.rel = rel
      link.href = href
      if (crossOrigin) {
        link.crossOrigin = crossOrigin
      }
      document.head.appendChild(link)
    })
  }
}

/**
 * Initialize all mobile optimizations
 */
export function initMobileOptimizations() {
  if (typeof window === 'undefined') return

  // Remove tap delay
  removeTapDelay()

  // Optimize viewport
  optimizeViewport()

  // Enable passive listeners
  enablePassiveListeners()

  // Optimize fonts
  optimizeFontLoading()

  // Lazy load images
  lazyLoadImages()

  // Reduce animations on low-end devices
  reduceAnimationsOnLowEnd()

  // Add resource hints
  addResourceHints()

  console.log('Mobile optimizations initialized')
}

/**
 * Performance monitoring for mobile
 */
export function monitorPerformance() {
  if (typeof window === 'undefined' || !window.performance) return

  // Web Vitals tracking
  const reportWebVital = (metric: { name: string; value: number }) => {
    console.log(`[Web Vital] ${metric.name}:`, metric.value)

    // Send to analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', metric.name, {
        value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
        event_category: 'Web Vitals',
        non_interaction: true
      })
    }
  }

  // Largest Contentful Paint (LCP)
  const lcpObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries()
    const lastEntry = entries[entries.length - 1] as any
    reportWebVital({ name: 'LCP', value: lastEntry.renderTime || lastEntry.loadTime })
  })
  lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })

  // First Input Delay (FID)
  const fidObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries()
    entries.forEach((entry: any) => {
      reportWebVital({ name: 'FID', value: entry.processingStart - entry.startTime })
    })
  })
  fidObserver.observe({ type: 'first-input', buffered: true })

  // Cumulative Layout Shift (CLS)
  let clsValue = 0
  const clsObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as any[]) {
      if (!entry.hadRecentInput) {
        clsValue += entry.value
      }
    }
    reportWebVital({ name: 'CLS', value: clsValue })
  })
  clsObserver.observe({ type: 'layout-shift', buffered: true })

  // Time to First Byte (TTFB)
  const navigationEntry = performance.getEntriesByType('navigation')[0] as any
  if (navigationEntry) {
    reportWebVital({ name: 'TTFB', value: navigationEntry.responseStart })
  }
}
