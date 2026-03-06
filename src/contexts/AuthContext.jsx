import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setSession(session ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setSession(session ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email, password, displayName = '') => {
    const result = await supabase.auth.signUp({ email, password })
    // Write display_name to profile immediately after signup
    if (!result.error && result.data?.user && displayName.trim()) {
      await supabase
        .from('profiles')
        .upsert({ id: result.data.user.id, display_name: displayName.trim() })
    }
    return result
  }
  const signIn  = async (email, password) => supabase.auth.signInWithPassword({ email, password })
  const signOut = async () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
