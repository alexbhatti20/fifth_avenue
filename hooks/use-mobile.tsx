import * as React from "react"

const MOBILE_BREAKPOINT = 768
const TABLET_BREAKPOINT = 1024

// Enhanced mobile detection with SSR support
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    // SSR-safe initial value - check if window exists
    if (typeof window !== 'undefined') {
      return window.innerWidth < MOBILE_BREAKPOINT
    }
    return false
  })

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}

// Check if tablet viewport
export function useIsTablet() {
  const [isTablet, setIsTablet] = React.useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const w = window.innerWidth
      return w >= MOBILE_BREAKPOINT && w < TABLET_BREAKPOINT
    }
    return false
  })

  React.useEffect(() => {
    const onChange = () => {
      const w = window.innerWidth
      setIsTablet(w >= MOBILE_BREAKPOINT && w < TABLET_BREAKPOINT)
    }
    const mql = window.matchMedia(`(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: ${TABLET_BREAKPOINT - 1}px)`)
    mql.addEventListener("change", onChange)
    onChange()
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isTablet
}

// Combined device type hook with memoization
export function useDeviceType() {
  const [deviceType, setDeviceType] = React.useState<'mobile' | 'tablet' | 'desktop'>(() => {
    if (typeof window !== 'undefined') {
      const w = window.innerWidth
      if (w < MOBILE_BREAKPOINT) return 'mobile'
      if (w < TABLET_BREAKPOINT) return 'tablet'
      return 'desktop'
    }
    return 'desktop'
  })

  React.useEffect(() => {
    const onChange = () => {
      const w = window.innerWidth
      if (w < MOBILE_BREAKPOINT) {
        setDeviceType('mobile')
      } else if (w < TABLET_BREAKPOINT) {
        setDeviceType('tablet')
      } else {
        setDeviceType('desktop')
      }
    }
    
    // Use resize observer for better performance
    window.addEventListener('resize', onChange, { passive: true })
    onChange()
    
    return () => window.removeEventListener('resize', onChange)
  }, [])

  return deviceType
}

// Touch device detection
export function useIsTouchDevice() {
  const [isTouch, setIsTouch] = React.useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return 'ontouchstart' in window || navigator.maxTouchPoints > 0
    }
    return false
  })

  React.useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0)
  }, [])

  return isTouch
}

// Safe area insets for notched phones
export function useSafeAreaInsets() {
  const [insets, setInsets] = React.useState({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  })

  React.useEffect(() => {
    const updateInsets = () => {
      const style = getComputedStyle(document.documentElement)
      setInsets({
        top: parseInt(style.getPropertyValue('--sat') || '0', 10) || 
             parseInt(style.getPropertyValue('env(safe-area-inset-top)') || '0', 10),
        bottom: parseInt(style.getPropertyValue('--sab') || '0', 10) ||
                parseInt(style.getPropertyValue('env(safe-area-inset-bottom)') || '0', 10),
        left: parseInt(style.getPropertyValue('--sal') || '0', 10) ||
              parseInt(style.getPropertyValue('env(safe-area-inset-left)') || '0', 10),
        right: parseInt(style.getPropertyValue('--sar') || '0', 10) ||
               parseInt(style.getPropertyValue('env(safe-area-inset-right)') || '0', 10),
      })
    }
    
    updateInsets()
    window.addEventListener('resize', updateInsets, { passive: true })
    return () => window.removeEventListener('resize', updateInsets)
  }, [])

  return insets
}

// Viewport dimensions hook with debouncing
export function useViewportSize() {
  const [size, setSize] = React.useState(() => {
    if (typeof window !== 'undefined') {
      return { width: window.innerWidth, height: window.innerHeight }
    }
    return { width: 0, height: 0 }
  })

  React.useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>
    
    const handleResize = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        setSize({ width: window.innerWidth, height: window.innerHeight })
      }, 100)
    }
    
    window.addEventListener('resize', handleResize, { passive: true })
    handleResize()
    
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return size
}
