import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

export const FREE_SOURCE_LIMIT = 10

export const GATED_FEATURES = {
  FULL_TEXT:   'full_text',
  DIGEST:      'digest',
  NEWSLETTER:  'newsletter',
  FOLDERS:     'folders',
  EXPORT:      'export',
  STATS:       'stats',
}

const PlanContext = createContext({})

export function PlanProvider({ children }) {
  const { user } = useAuth()
  const [plan, setPlan]             = useState('free')
  const [planSource, setPlanSource] = useState(null)
  const [planExpiresAt, setPlanExpiresAt] = useState(null)
  const [loading, setLoading]       = useState(true)

  const fetchPlan = useCallback(async () => {
    if (!user) { setPlan('free'); setLoading(false); return }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('plan, plan_source, plan_expires_at')
        .eq('id', user.id)
        .maybeSingle()
      if (error) throw error
      if (data) {
        const expired = data.plan_expires_at && new Date(data.plan_expires_at) < new Date()
        setPlan(expired ? 'free' : (data.plan || 'free'))
        setPlanSource(data.plan_source || null)
        setPlanExpiresAt(data.plan_expires_at ? new Date(data.plan_expires_at) : null)
      }
    } catch (err) {
      console.warn('Plan fetch failed:', err.message)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { fetchPlan() }, [fetchPlan])

  const isPro = plan === 'pro'

  const canAddSource = useCallback((currentCount) => {
    if (isPro) return true
    return currentCount < FREE_SOURCE_LIMIT
  }, [isPro])

  const canUseFeature = useCallback(() => {
    return isPro
  }, [isPro])

  return (
    <PlanContext.Provider value={{
      isPro, plan, planSource, planExpiresAt, loading,
      canAddSource, canUseFeature,
      refresh: fetchPlan,
    }}>
      {children}
    </PlanContext.Provider>
  )
}

export const usePlan = () => useContext(PlanContext)
