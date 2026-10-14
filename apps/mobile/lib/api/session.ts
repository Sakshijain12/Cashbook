let version = 0
const listeners = new Set<() => void>()

export const sessionVersion = () => version
export function invalidateSession() {
  version += 1
  for (const listener of listeners) listener()
}
export function onSessionInvalidated(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}