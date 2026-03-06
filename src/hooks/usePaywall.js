/**
 * usePaywall — simple paywall gate hook.
 * Returns true if user can proceed, false + opens PaywallModal if not.
 */

import { useState, useCallback } from 'react'
import { usePlan } from '../contexts/PlanContext'

export function usePaywall() {
  const { canUseFeature } = usePlan()
  const [paywallFeature, setPaywallFeature] = useState(null)

  const gate = useCallback((feature) => {
    if (canUseFeature(feature)) return true
    setPaywallFeature(feature)
    return false
  }, [canUseFeature])

  const closePaywall = useCallback(() => setPaywallFeature(null), [])

  return { gate, paywallFeature, closePaywall }
}
