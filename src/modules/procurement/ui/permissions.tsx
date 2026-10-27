'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'

/**
 * The permissions the page read for the signed-in user. They only decide what the screen shows: the server and the
 * database check every request again, so a wrong or stale list can hide a button but can never allow an action.
 */
const PermissionContext = createContext<ReadonlySet<string>>(new Set())

export function PermissionProvider({ permissions, children }: { permissions: readonly string[]; children: ReactNode }) {
  const set = useMemo(() => new Set(permissions), [permissions])
  return <PermissionContext.Provider value={set}>{children}</PermissionContext.Provider>
}

/** True when the user holds every one of the given permissions. */
export function useCan(...needed: string[]): boolean {
  const held = useContext(PermissionContext)
  return needed.every((permission) => held.has(permission))
}

/** True when the user holds at least one of the given permissions. */
export function useCanAny(...needed: string[]): boolean {
  const held = useContext(PermissionContext)
  return needed.some((permission) => held.has(permission))
}
