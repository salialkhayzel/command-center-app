"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"

export interface User {
  empno: string
  displayName: string
  department: string
  section: string
  jobTitle: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (empno: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const storedToken = localStorage.getItem("auth_token")
    if (storedToken) {
      fetch("/api/auth/session", {
        headers: { Authorization: `Bearer ${storedToken}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.authenticated) {
            setToken(storedToken)
            setUser(data.user)
          } else {
            localStorage.removeItem("auth_token")
          }
        })
        .catch(() => {
          localStorage.removeItem("auth_token")
        })
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = useCallback(async (empno: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empno, password }),
      })
      const data = await res.json()
      if (data.success) {
        localStorage.setItem("auth_token", data.token)
        setToken(data.token)
        setUser(data.user)
        return { success: true }
      }
      return { success: false, error: data.error || "Login failed" }
    } catch {
      return { success: false, error: "Network error. Please try again." }
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token")
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
