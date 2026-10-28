import { createContext, useContext } from 'react'

/**
 * How a panel sends the viewer to the map. The map lives only in the Map destination, so every "Show on map" control
 * turns its layer on and then calls this. Outside the app (tests, previews) it does nothing.
 */
export const OpenMapContext = createContext<() => void>(() => {})
export const useOpenMap = () => useContext(OpenMapContext)
