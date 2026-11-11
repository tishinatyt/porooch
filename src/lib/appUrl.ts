// Production callbacks and shared links use one configured public origin.
// Development and Node-based component tests keep their current origin.
export function appOrigin(): string {
  return new URL(import.meta.env?.VITE_APP_URL || window.location.origin).origin
}
