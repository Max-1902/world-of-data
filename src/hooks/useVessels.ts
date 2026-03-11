import { useState, useEffect, useRef } from 'react'
import { connectAISStream, type Vessel } from '../services/aisstream'

export function useVessels(enabled: boolean) {
  const [vessels, setVessels] = useState<Vessel[]>([])
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!enabled) {
      setVessels([])
      cleanupRef.current?.()
      cleanupRef.current = null
      return
    }

    cleanupRef.current = connectAISStream(setVessels)

    return () => {
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [enabled])

  return { vessels }
}