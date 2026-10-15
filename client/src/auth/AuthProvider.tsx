import { createContext, useCallback, useContext, useEffect, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../api/auth'
import { isApiError, setUnauthorizedHandler } from '../api/client'
import type { User } from '../api/types'

export const ME_QUERY_KEY = ['auth', 'me'] as const

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  setUser: (user: User) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function loadCurrentUser(): Promise<User | null> {
  try {
    return await authApi.me()
  } catch (error) {
    if (isApiError(error) && error.status === 401) return null
    throw error
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { data, isPending } = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: loadCurrentUser,
    staleTime: Infinity,
    retry: false,
  })

  const switchUser = useCallback(
    (user: User | null) => {
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== ME_QUERY_KEY[0] })
      queryClient.setQueryData(ME_QUERY_KEY, user)
    },
    [queryClient],
  )

  useEffect(() => {
    setUnauthorizedHandler(() => switchUser(null))
    return () => setUnauthorizedHandler(null)
  }, [switchUser])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      switchUser(null)
    }
  }, [switchUser])

  return (
    <AuthContext.Provider value={{ user: data ?? null, isLoading: isPending, setUser: switchUser, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

export function useCurrentUser(): User {
  const { user } = useAuth()
  if (!user) throw new Error('useCurrentUser needs a signed-in user')
  return user
}
