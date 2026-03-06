import { useState, useEffect, useRef, useCallback } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Menu, Search } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import AddFeedModal from '../components/AddFeedModal'
import SearchModal from '../components/SearchModal'
import InstallPrompt from '../components/InstallPrompt'
import FeedDiscoveryModal from '../components/FeedDiscoveryModal'
import NewsletterModal from '../components/NewsletterModal'
import PaywallModal from '../components/PaywallModal'
import { UnreadProvider, useUnread } from '../contexts/UnreadContext'
import { PlanProvider, usePlan, GATED_FEATURES } from '../contexts/PlanContext'
import { useAuth } from '../contexts/AuthContext'
import { getFeeds, upsertArticles, prefetchReadingListContent } from '../lib/feedsService'
import { supabase } from '../lib/supabase'

function DashboardContent() {
  const { user } = useAuth()
  const { canAddSource, canUseFeature, refresh: refreshPlan } = usePlan()
  const { refreshUnreadCount } = useUnread()
  const location = useLocation()
  const navigate = useNavigate()

  const [showAdd, setShowAdd]               = useState(false)
  const [showDiscover, setShowDiscover]     = useState(false)
  const [showNewsletter, setShowNewsletter] = useState(false)
  const [showSearch, setShowSearch]         = useState(false)
  const [paywallFeature, setPaywallFeature] = useState(null)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [refreshKey, setRefreshKey]         = useState(0)
  const [autoRefreshing, setAutoRefreshing] = useState(false)
  const [feedCount, setFeedCount]           = useState(0)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const hasAutoRefreshed = useRef(false)

  // Handle Paystack redirect back after payment
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('payment') === 'success') {
      setPaymentSuccess(true)
      refreshPlan()
      navigate('/dashboard', { replace: true })
      setTimeout(() => setPaymentSuccess(false), 5000)
    }
  }, [location.search])

  // Load feed count for limit checking
  useEffect(() => {
    getFeeds(user.id).then(feeds => setFeedCount(feeds.length)).catch(() => {})
  }, [user.id, refreshKey])


  // Redirect new users to onboarding — fires once per session
  const onboardingChecked = useRef(false)
  useEffect(() => {
    if (!user || onboardingChecked.current) return
    onboardingChecked.current = true
    supabase
      .from('profiles')
      .select('onboarding_complete')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        // Only redirect if we got a clean response and onboarding is explicitly false
        // If column doesn't exist (error) or data is null, don't redirect
        if (!error && data && data.onboarding_complete === false) {
          navigate('/onboarding', { replace: true })
        }
      })
      .catch(() => {})  // Never block dashboard on error
  }, [user?.id])

  const openSearch = useCallback(() => setShowSearch(true), [])

  // Auto-refresh feeds on login
  useEffect(() => {
    if (hasAutoRefreshed.current) return
    hasAutoRefreshed.current = true
    const autoRefresh = async () => {
      setAutoRefreshing(true)
      try {
        const feeds = await getFeeds(user.id)
        if (!feeds.length) return

        // Server-side fetch via edge function — no CORS, no proxies needed
        // Use supabase.functions.invoke() — automatically adds both Authorization + apikey headers
        const { data, error: fnErr } = await supabase.functions.invoke('fetch-feeds', {
          body: { feeds: feeds.map(f => ({ id: f.id, url: f.url })) },
        })
        if (fnErr) throw new Error(`fetch-feeds: ${fnErr.message}`)
        const { results } = data

        const allArticles = []
        ;(results || []).forEach(result => {
          if (!result.items?.length) return
          const feed = feeds.find(f => f.id === result.feedId)
          if (!feed) return
          result.items.slice(0, 20).forEach(item => {
            allArticles.push({
              user_id: user.id, feed_id: feed.id, guid: item.guid,
              title: item.title, link: item.link, description: item.description,
              author: item.author,
              pub_date: item.pubDate ? new Date(item.pubDate).toISOString() : null,
              category: feed.category,
              full_content: item.fullContent || null,
            })
          })
        })

        if (allArticles.length) await upsertArticles(allArticles)
        await refreshUnreadCount()
        setRefreshKey(k => k + 1)
        prefetchReadingListContent(user.id).catch(() => {})
      } catch (e) {
        console.error('[autoRefresh]', e.message)
      } finally {
        setAutoRefreshing(false)
      }
    }
    autoRefresh()
  }, [user.id, refreshUnreadCount])

  const handleAdded = () => {
    setShowAdd(false)
    setRefreshKey(k => k + 1)
    refreshUnreadCount()
    setFeedCount(c => c + 1)
  }

  // Gate: try to add a source
  const handleAddFeedClick = () => {
    if (!canAddSource(feedCount)) {
      setPaywallFeature('sources')
      return
    }
    setShowAdd(true)
  }

  // Gate: newsletter (pro only)
  const handleNewsletterClick = () => {
    if (!canUseFeature(GATED_FEATURES.NEWSLETTER)) {
      setPaywallFeature(GATED_FEATURES.NEWSLETTER)
      return
    }
    setShowNewsletter(true)
  }

  return (
    <div className="min-h-screen bg-[#fafaf9] dark:bg-stone-950 flex">
      <Sidebar
        onAddFeed={handleAddFeedClick}
        onDiscover={() => setShowDiscover(true)}
        onNewsletter={handleNewsletterClick}
        onSearch={openSearch}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        feedCount={feedCount}
      />

      <div className="flex-1 md:ml-56 flex flex-col min-h-screen overflow-x-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-30 bg-white dark:bg-stone-900 border-b border-stone-100 dark:border-stone-800 px-4 py-3 flex items-center justify-between">
          <button onClick={() => setMobileSidebarOpen(true)}
            className="p-2 text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-display font-bold text-lg">
            <span className="text-stone-900 dark:text-stone-100">my</span>
            <span className="text-brand-600">Feed</span>
            <span className="text-stone-900 dark:text-stone-100">Reader</span>
          </span>
          <button onClick={openSearch}
            className="p-2 text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">
            <Search className="w-5 h-5" />
          </button>
        </div>

        <main className="flex-1 p-4 md:p-8 max-w-4xl w-full mx-auto overflow-x-hidden">
          {/* Auto-refresh indicator */}
          {autoRefreshing && (
            <div className="fixed bottom-5 right-5 flex items-center gap-2 bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 shadow-sm rounded-full px-4 py-2 text-xs text-stone-500 dark:text-stone-400 z-50">
              <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse" />
              Refreshing feeds...
            </div>
          )}

          {/* Payment success toast */}
          {paymentSuccess && (
            <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-brand-600 text-white px-5 py-3 rounded-full shadow-lg text-sm font-medium animate-bounce">
              🎉 Welcome to Pro! All features are now unlocked.
            </div>
          )}

          <Outlet context={{ refreshKey, autoRefreshing, setPaywallFeature }} />
        </main>

        <footer className="w-full px-4 md:px-8 py-4 flex items-center justify-between border-t border-stone-100 dark:border-stone-800 mt-auto bg-white dark:bg-stone-900">
          <p className="text-xs text-stone-400 dark:text-stone-500">
            Made with ❤️ by{' '}
            <span className="font-medium text-stone-500 dark:text-stone-400">Brian Gachichio</span>
          </p>
          <a href="https://paystack.shop/pay/gachichio" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-lg transition-colors">
            ☕ Support
          </a>
        </footer>
      </div>

      <InstallPrompt />
      {showDiscover   && <FeedDiscoveryModal onClose={() => setShowDiscover(false)} onAdded={() => { setShowDiscover(false); setRefreshKey(k => k + 1); refreshUnreadCount() }} />}
      {showAdd        && <AddFeedModal onClose={() => setShowAdd(false)} onAdded={handleAdded} />}
      {showSearch     && <SearchModal onClose={() => setShowSearch(false)} />}
      {showNewsletter && <NewsletterModal onClose={() => setShowNewsletter(false)} onAdded={() => { setShowNewsletter(false); setRefreshKey(k => k + 1); refreshUnreadCount() }} />}
      {paywallFeature && <PaywallModal feature={paywallFeature} onClose={() => setPaywallFeature(null)} />}
    </div>
  )
}

export default function DashboardLayout() {
  return (
    <UnreadProvider>
      <PlanProvider>
        <DashboardContent />
      </PlanProvider>
    </UnreadProvider>
  )
}
