import { useEffect, useState } from 'react'

const MOBILE_MEDIA_QUERY = '(max-width: 900px)'

export function useIsMobile() {
  const getIsMobile = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false
    }
    return window.matchMedia(MOBILE_MEDIA_QUERY).matches
  }

  const [isMobile, setIsMobile] = useState<boolean>(getIsMobile)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY)
    const onChange = () => setIsMobile(mediaQuery.matches)

    onChange()

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', onChange)
      return () => mediaQuery.removeEventListener('change', onChange)
    }

    mediaQuery.addListener(onChange)
    return () => mediaQuery.removeListener(onChange)
  }, [])

  return isMobile
}
