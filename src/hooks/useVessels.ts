import { useState, useEffect, useRef, useCallback } from 'react'
import { connectAISStream, type Vessel } from '../services/aisstream'

export function useVessels(enabled: boolean) {
  const [vessels, setVessels] = useState<Vessel[]>([])
  const cleanupRef = useRef<(() => void) | null>(null)

  const connect = useCallback(() => {
    cleanupRef.current?.()
    cleanupRef.current = connectAISStream(setVessels)
  }, [])

  useEffect(() => {
    if (!enabled) {
      setVessels([])
      cleanupRef.current?.()
      cleanupRef.current = null
      return
    }

    connect()

    return () => {
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [enabled, connect])

  const refresh = useCallback(() => {
    if (enabled) connect()
  }, [enabled, connect])

  return { vessels, refresh }
}
