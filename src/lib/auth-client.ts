import { inferAdditionalFields } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import type { Auth } from './auth'

export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : '',
  plugins: [inferAdditionalFields<Auth>()],
})

export type Session = typeof authClient.$Infer.Session
export type User = typeof authClient.$Infer.Session.user
