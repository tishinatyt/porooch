interface DemoEnvironment { DEV?: boolean; VITE_SHOW_DEMO_EVENTS?: string }

// Explicit opt-in for development only. A production build cannot enable it,
// even if VITE_SHOW_DEMO_EVENTS is accidentally set in deployment settings.
export function demoEventsEnabled(env: DemoEnvironment | undefined = import.meta.env): boolean {
  return env?.DEV === true && env.VITE_SHOW_DEMO_EVENTS === 'true'
}
