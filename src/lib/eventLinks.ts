// Only event detail routes may survive onboarding; never accept an external redirect.
export function eventReturnPath(pathname: string): string {
  return /^\/event\/[a-zA-Z0-9_-]+\/?$/.test(pathname) ? pathname.replace(/\/$/, '') : '/'
}

export function eventAuthRedirect(pathname: string, base: string, origin: string): string {
  const appBase = `${base.replace(/\/$/, '')}/`
  const route = pathname.startsWith(appBase) ? `/${pathname.slice(appBase.length)}` : '/'
  return new URL(`${appBase}${eventReturnPath(route).slice(1)}`, origin).toString()
}
