// Chernihiv, Ukraine default coords
export const DEFAULT_LAT = 51.4930
export const DEFAULT_LNG = 31.2945

export interface Coords {
  lat: number
  lng: number
}

export function getCurrentPosition(fallback: Coords = { lat: DEFAULT_LAT, lng: DEFAULT_LNG }): Promise<Coords> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(fallback)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(fallback),
      { timeout: 8000 }
    )
  })
}
