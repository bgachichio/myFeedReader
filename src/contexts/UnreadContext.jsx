import { createContext, useContext, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const UnreadContext = createContext({})

export function UnreadProvider({ children }) {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  const refreshUnreadCount = useCallback(async () => {
    if (!user) return
    try {
      const { count } = await supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
      setUnreadCount(count || 0)
    } catch {}
  }, [user])

  const decrementUnread = useCallback((by = 1) => {
    setUnreadCount(prev => Math.max(0, prev - by))
  }, [])

  const clearUnread = useCallback(() => setUnreadCount(0), [])

  return (
    <UnreadContext.Provider value={{ unreadCount, refreshUnreadCount, decrementUnread, clearUnread }}>
      {children}
    </UnreadContext.Provider>
  )
}

export const useUnread = () => useContext(UnreadContext)
