import { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCw, Inbox, CheckCheck, X, CheckSquare, Square, MailOpen } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useUnread } from '../contexts/UnreadContext'
import { getFeeds, getArticles, upsertArticles, updateFeedHealth, markArticlesBulk, markAllArticlesRead } from '../lib/feedsService'
import ArticleCard from '../components/ArticleCard'

const PAGE_SIZE = 20

// Module-level article cache — survives navigation, reset on explicit refresh
const feedCache = { articles: null, total: 0, ts: 0, uid: null, category: null, filter: null }
const FEED_CACHE_TTL = 90_000  // 1.5 minutes


// readFilter values: 'unread' | 'all' | 'read'
const READ_FILTERS = [
  { id: 'unread', label: 'Unread only' },
  { id: 'all',    label: 'All articles' },
  { id: 'read',   label: 'Read articles' },
]

export default function FeedView() {
  const { user } = useAuth()
  const { refreshKey, setPaywallFeature } = useOutletContext() || {}
  const { refreshUnreadCount, clearUnread } = useUnread()

  const [articles, setArticles] = useState([])
  const [categories, setCategories] = useState(['All'])
  const [activeCategory, setActiveCategory] = useState('All')
  const [readFilter, setReadFilter] = useState('unread')
  const [sortOrder, setSortOrder] = useState('newest')  // 'newest' | 'oldest'
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [markingRead, setMarkingRead] = useState(false)
  const [error, setError] = useState('')
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)

  // Multi-select
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())

  const sentinelRef = useRef(null)

  const loadArticles = useCallback(async (category = 'All', newOffset = 0, append = false, rf = 'unread', asc = false) => {
    try {
      const result = await getArticles(user.id, { category, limit: PAGE_SIZE, offset: newOffset, readFilter: rf, ascending: asc })
      if (append) setArticles(prev => [...prev, ...result.articles])
      else setArticles(result.articles)
      setHasMore(result.hasMore)
      setTotal(result.total)
      setOffset(newOffset + PAGE_SIZE)
    } catch (err) { setError(err.message) }
  }, [user.id])

  const loadCategories = useCallback(async () => {
    try {
      const feeds = await getFeeds(user.id)
      setCategories(['All', ...new Set(feeds.map(f => f.category).filter(Boolean))])
    } catch {}
  }, [user.id])

  useEffect(() => {
    setLoading(true)
    setOffset(0)
    setSelectedIds(new Set())
    Promise.all([loadArticles(activeCategory, 0, false, readFilter, sortOrder === 'oldest'), loadCategories()])
      .finally(() => setLoading(false))
  }, [refreshKey])

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && !loadingMore && hasMore) handleLoadMore() },
      { threshold: 0.1 }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, offset, activeCategory, readFilter])

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try { await loadArticles(activeCategory, offset, true, readFilter, sortOrder === 'oldest') }
    finally { setLoadingMore(false) }
  }

  const handleCategoryChange = async (cat) => {
    setActiveCategory(cat)
    setLoading(true); setOffset(0); setSelectedIds(new Set())
    try { await loadArticles(cat, 0, false, readFilter, sortOrder === 'oldest') }
    finally { setLoading(false) }
  }

  const handleReadFilterChange = async (rf) => {
    setReadFilter(rf)
    setLoading(true); setOffset(0); setSelectedIds(new Set())
    try { await loadArticles(activeCategory, 0, false, rf, sortOrder === 'oldest') }
    finally { setLoading(false) }
  }

  const handleSortChange = async (order) => {
    setSortOrder(order)
    setLoading(true); setOffset(0)
    try { await loadArticles(activeCategory, 0, false, readFilter, order === 'oldest') }
    finally { setLoading(false) }
  }

  const refreshFeeds = async () => {
    setRefreshing(true); setError('')
    try {
      const feeds = await getFeeds(user.id)
      if (!feeds.length) { setError('No sources added yet.'); return }

      // Use server-side edge function — same as DashboardLayout autoRefresh
      const { data, error: fnErr } = await supabase.functions.invoke('fetch-feeds', {
        body: { feeds: feeds.map(f => ({ id: f.id, url: f.url })) },
      })
      if (fnErr) throw new Error(fnErr.message)

      const allArticles = []
      ;(data?.results || []).forEach(result => {
        const feed = feeds.find(f => f.id === result.feedId)
        if (!feed || !result.items?.length) {
          if (feed) updateFeedHealth(feed.id, { success: false, error: result.error || 'No items' })
          return
        }
        result.items.slice(0, 10).forEach(item => allArticles.push({
          user_id: user.id, feed_id: feed.id, guid: item.guid,
          title: item.title, link: item.link, description: item.description,
          author: item.author,
          pub_date: item.pubDate ? new Date(item.pubDate).toISOString() : null,
          category: feed.category,
          full_content: item.fullContent || null,
        }))
        updateFeedHealth(feed.id, { success: true, articleCount: result.items.length })
      })
      if (allArticles.length) await upsertArticles(allArticles)
      await loadArticles(activeCategory, 0, false, readFilter, sortOrder === 'oldest')
      setOffset(0)
      await loadCategories()
      await refreshUnreadCount()
    } catch (err) { setError('Some feeds failed to refresh: ' + err.message) }
    finally { setRefreshing(false) }
  }

  const handleMarkAllRead = async () => {
    setMarkingRead(true)
    try {
      await markAllArticlesRead(user.id)
      // After marking all read, reload with current filter
      await loadArticles(activeCategory, 0, false, readFilter, sortOrder === 'oldest')
      setOffset(0)
      clearUnread()
    } catch (err) { setError(err.message) }
    finally { setMarkingRead(false) }
  }

  const handleArticleUpdate = (updated) => {
    if (readFilter === 'unread' && updated.is_read) {
      // Remove from list immediately when marked read in unread-only view
      setArticles(prev => prev.filter(a => a.id !== updated.id))
    } else if (readFilter === 'read' && !updated.is_read) {
      // Remove from list immediately when marked unread in read-only view
      setArticles(prev => prev.filter(a => a.id !== updated.id))
    } else {
      setArticles(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a))
    }
    refreshUnreadCount()
  }

  // Multi-select
  const toggleSelectionMode = () => { setSelectionMode(v => !v); setSelectedIds(new Set()) }
  const handleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const handleSelectAll = () => {
    setSelectedIds(selectedIds.size === articles.length ? new Set() : new Set(articles.map(a => a.id)))
  }
  const handleBulkMark = async (isRead) => {
    if (!selectedIds.size) return
    try {
      await markArticlesBulk([...selectedIds], isRead)
      // Remove articles that no longer belong in current filter view
      if ((isRead && readFilter === 'unread') || (!isRead && readFilter === 'read')) {
        setArticles(prev => prev.filter(a => !selectedIds.has(a.id)))
      } else {
        setArticles(prev => prev.map(a => selectedIds.has(a.id) ? { ...a, is_read: isRead } : a))
      }
      setSelectedIds(new Set())
      setSelectionMode(false)
      refreshUnreadCount()
    } catch (err) { setError(err.message) }
  }

  const allSelected = articles.length > 0 && selectedIds.size === articles.length
  const unreadCount = articles.filter(a => !a.is_read).length

  // Empty state copy varies by filter
  const emptyTitle = readFilter === 'unread' ? 'All caught up!' : readFilter === 'read' ? 'No read articles yet' : 'Your feed is empty'
  const emptyBody  = readFilter === 'unread' ? 'No unread articles right now.' : readFilter === 'read' ? 'Articles you read will appear here.' : 'Add a source and articles will appear here.'

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-2xl text-stone-900 dark:text-stone-100">My Feed</h1>
          <p className="text-base text-stone-500 dark:text-stone-400 mt-0.5">
            {total > 0 && <span>{total} articles</span>}
            {readFilter !== 'read' && unreadCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-400 text-xs rounded-full font-medium">
                {unreadCount} unread
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {!selectionMode && readFilter !== 'read' && unreadCount > 0 && (
            <button onClick={handleMarkAllRead} disabled={markingRead}
              className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 text-sm font-medium rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors disabled:opacity-50">
              <CheckCheck className="w-4 h-4" />
              {markingRead ? 'Marking...' : 'Mark all read'}
            </button>
          )}
          <button onClick={toggleSelectionMode}
            className={`flex items-center gap-1.5 px-3 py-2 border text-sm font-medium rounded-lg transition-colors ${
              selectionMode
                ? 'bg-brand-50 dark:bg-brand-900/30 border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-400'
                : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700'
            }`}>
            <CheckSquare className="w-4 h-4" />
            {selectionMode ? 'Cancel' : 'Select'}
          </button>
          <button onClick={refreshFeeds} disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-60">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Selection toolbar */}
      {selectionMode && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-xl flex-wrap">
          <button onClick={handleSelectAll}
            className="flex items-center gap-1.5 text-xs font-medium text-brand-700 dark:text-brand-400">
            {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
          {selectedIds.size > 0 && (
            <>
              <span className="text-xs text-brand-600 dark:text-brand-400 font-medium">
                {selectedIds.size} selected
              </span>
              <div className="flex items-center gap-1.5 ml-auto">
                <button onClick={() => handleBulkMark(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-xs font-medium rounded-lg hover:bg-brand-700 transition-colors">
                  <CheckCheck className="w-3.5 h-3.5" />Mark read
                </button>
                <button onClick={() => handleBulkMark(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 text-xs font-medium rounded-lg hover:bg-stone-50 transition-colors">
                  <MailOpen className="w-3.5 h-3.5" />Mark unread
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Filters row */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        {/* Read state filter — tri-state pill group */}
        <div className="flex items-center bg-stone-100 dark:bg-stone-800 rounded-full p-0.5 gap-0.5">
          {READ_FILTERS.map(rf => (
            <button key={rf.id} onClick={() => handleReadFilterChange(rf.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                readFilter === rf.id
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
              }`}>
              {rf.label}
            </button>
          ))}
        </div>

        {/* Sort order toggle */}
        <div className="flex items-center bg-stone-100 dark:bg-stone-800 rounded-full p-0.5 gap-0.5 ml-auto">
          <button onClick={() => handleSortChange('newest')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              sortOrder === 'newest'
                ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
            }`}>↓ Newest</button>
          <button onClick={() => handleSortChange('oldest')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              sortOrder === 'oldest'
                ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
            }`}>↑ Oldest</button>
        </div>

        {/* Category filters */}
        {categories.length > 1 && categories.map(cat => (
          <button key={cat} onClick={() => handleCategoryChange(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeCategory === cat
                ? 'bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
            }`}>
            {cat}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-xl text-sm flex items-start justify-between gap-2">
          <span>{error}</span>
          <button onClick={() => setError('')}><X className="w-4 h-4 flex-shrink-0" /></button>
        </div>
      )}

      {/* Skeletons */}
      {loading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-xl p-5 animate-pulse">
              <div className="flex gap-2 mb-3">
                <div className="h-5 w-16 bg-stone-100 dark:bg-stone-800 rounded-full" />
                <div className="h-5 w-24 bg-stone-100 dark:bg-stone-800 rounded-full" />
              </div>
              <div className="h-4 bg-stone-100 dark:bg-stone-800 rounded w-3/4 mb-2" />
              <div className="h-3 bg-stone-50 dark:bg-stone-800/50 rounded w-full" />
            </div>
          ))}
        </div>
      )}

      {!loading && articles.length === 0 && (
        <div className="text-center py-24">
          <div className="w-16 h-16 bg-stone-50 dark:bg-stone-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Inbox className="w-7 h-7 text-stone-300 dark:text-stone-600" />
          </div>
          <h3 className="font-semibold text-stone-700 dark:text-stone-300 mb-2">{emptyTitle}</h3>
          <p className="text-sm text-stone-400 dark:text-stone-500 max-w-xs mx-auto">{emptyBody}</p>
          {readFilter !== 'all' && (
            <button onClick={() => handleReadFilterChange('all')}
              className="mt-4 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors">
              Show all articles
            </button>
          )}
        </div>
      )}

      {!loading && articles.length > 0 && (
        <div className="space-y-3">
          {articles.map(article => (
            <ArticleCard
              key={article.id}
              article={article}
              onUpdate={handleArticleUpdate}
              onUpgrade={(feature) => setPaywallFeature?.(feature)}
              selectionMode={selectionMode}
              selected={selectedIds.has(article.id)}
              onSelect={handleSelect}
            />
          ))}
          <div ref={sentinelRef} className="h-4" />
          {loadingMore && (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-xl p-5 animate-pulse">
                  <div className="h-4 bg-stone-100 dark:bg-stone-800 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-stone-50 dark:bg-stone-800/50 rounded w-full" />
                </div>
              ))}
            </div>
          )}
          {!hasMore && articles.length > 0 && (
            <p className="text-center text-xs text-stone-400 dark:text-stone-600 py-4">
              All {total} articles loaded
            </p>
          )}
        </div>
      )}
    </div>
  )
}
