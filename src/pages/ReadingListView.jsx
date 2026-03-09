import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookMarked, ExternalLink, Check, Trash2, Clock, RefreshCw, Wifi, WifiOff, Upload } from 'lucide-react'
import ImportLinksModal from '../components/ImportLinksModal'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { toggleReadLater, prefetchReadingListContent, readingListSignal } from '../lib/feedsService'


// ── Simple in-memory cache ─────────────────────────────────────────
const cache = { data: null, ts: 0, uid: null }
const CACHE_TTL = 60_000 // 1 minute

// ── Article card used for both types ──────────────────────────────
function ReadingCard({ item, onRemove, onMarkRead }) {
  const navigate = useNavigate()
  const hasText = !!(item.full_text && item.full_text.length > 100)
  const isSaved = item._type === 'saved'

  const domain = (() => {
    try { return new URL(item.url).hostname.replace('www.', '') }
    catch { return '' }
  })()

  const handleOpen = () => {
    if (isSaved) navigate(`/saved/read/${item.id}`)
    else navigate(`/read/${item.id}`, { state: { article: item._raw } })
  }

  return (
    <div className={`bg-white dark:bg-stone-900 border rounded-xl overflow-hidden transition-colors ${
      item.is_read
        ? 'border-stone-100 dark:border-stone-800'
        : 'border-brand-200 dark:border-brand-900/60'
    }`}>
      <div className="p-4" onClick={handleOpen} style={{ cursor: 'pointer' }}>
        <div className="flex items-start gap-3">
          {/* Unread dot */}
          <div className="mt-2 flex-shrink-0">
            <div className={`w-2 h-2 rounded-full transition-colors ${item.is_read ? 'bg-transparent' : 'bg-brand-500'}`} />
          </div>

          <div className="flex-1 min-w-0">
            {/* Source badge row */}
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {item.source_label && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
                  {item.source_label}
                </span>
              )}
              {item.category && item.category !== 'General' && (
                <span className="text-xs text-stone-400 dark:text-stone-500">{item.category}</span>
              )}
              {item.reading_time && (
                <span className="text-xs text-stone-400 dark:text-stone-500 flex items-center gap-1 ml-auto">
                  <Clock className="w-3 h-3" />{item.reading_time}
                </span>
              )}
              <span className={`text-xs flex items-center ${item.reading_time ? '' : 'ml-auto'} ${
                hasText ? 'text-brand-500 dark:text-brand-400' : 'text-stone-300 dark:text-stone-600'
              }`} title={hasText ? 'Full text saved' : 'Link only'}>
                {hasText ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              </span>
            </div>

            {/* Title */}
            <p className={`text-[15px] font-semibold leading-snug mb-1.5 ${
              item.is_read ? 'text-stone-500 dark:text-stone-400' : 'text-stone-900 dark:text-stone-100'
            }`}>
              {item.title || item.url}
            </p>

            {/* Excerpt */}
            {item.excerpt && (
              <p className="text-sm text-stone-400 dark:text-stone-500 leading-relaxed line-clamp-2">
                {item.excerpt}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="px-4 py-2 flex items-center gap-1 border-t border-stone-50 dark:border-stone-800/50">
        <button
          onClick={(e) => { e.stopPropagation(); onMarkRead(item) }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg transition-colors text-stone-500 dark:text-stone-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20"
        >
          <Check className="w-3.5 h-3.5" />
          {item.is_read ? 'Mark unread' : 'Mark read'}
        </button>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg transition-colors text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800"
        >
          <ExternalLink className="w-3.5 h-3.5" />Original
        </a>
        <div className="flex-1" />
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(item) }}
          className="p-1.5 text-stone-300 dark:text-stone-600 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          title="Remove from Reading List"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {showImport && (
        <ImportLinksModal
          onClose={() => setShowImport(false)}
          onImportComplete={() => {
            cache.ts = 0
            load(true)
          }}
        />
      )}
    </div>
  )
}

// ── Normalise DB rows into a common shape ─────────────────────────
function normaliseArticle(a) {
  const readingMin = a.full_content
    ? Math.ceil(a.full_content.split(' ').length / 200)
    : null
  return {
    _type: 'feed',
    _raw: a,
    id: a.id,
    url: a.link,
    title: a.title,
    excerpt: a.description,
    full_text: a.full_content,
    is_read: a.is_read,
    category: a.category,
    source_label: a.feeds?.title || 'Feed',
    reading_time: readingMin ? `${readingMin} min` : null,
    saved_at: a.updated_at || a.pub_date,
  }
}

function normaliseSaved(s) {
  const domain = (() => {
    try { return new URL(s.url).hostname.replace('www.', '') } catch { return '' }
  })()
  return {
    _type: 'saved',
    _raw: s,
    id: s.id,
    url: s.url,
    title: s.title,
    excerpt: s.excerpt,
    full_text: s.full_text,
    is_read: s.is_read,
    category: null,
    source_label: domain || 'Saved',
    reading_time: s.reading_time_min ? `${s.reading_time_min} min` : null,
    saved_at: s.created_at,
  }
}

const SORT_OPTIONS = [
  { id: 'newest', label: '↓ Newest' },
  { id: 'oldest', label: '↑ Oldest' },
]

const FILTER_OPTIONS = [
  { id: 'unread', label: 'Unread' },
  { id: 'all',    label: 'All' },
  { id: 'read',   label: 'Read' },
]

// ── Main view ─────────────────────────────────────────────────────
export default function ReadingListView() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('unread')
  const [sortOrder, setSortOrder] = useState('newest')
  const [showImport, setShowImport] = useState(false)
  const loadingRef = useRef(false)

  const load = useCallback(async (force = false) => {
    if (loadingRef.current) return
    const now = Date.now()
    // Use cache if fresh, same user, and not forced
    if (!force && cache.uid === user.id && cache.data && (now - cache.ts) < CACHE_TTL) {
      setItems(filterAndSort(cache.data, filter, sortOrder))
      setLoading(false)
      return
    }
    loadingRef.current = true
    setLoading(true)

    // Parallel fetch both tables
    const [feedRes, savedRes] = await Promise.all([
      supabase
        .from('articles')
        .select('*, feeds(title, category, url)')
        .eq('user_id', user.id)
        .eq('is_read_later', true)
        .order('pub_date', { ascending: false })
        .limit(200),
      supabase
        .from('saved_articles')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .limit(200),
    ])

    const feedItems = (feedRes.data || []).map(normaliseArticle)
    const savedItems = (savedRes.data || []).map(normaliseSaved)
    const all = [...feedItems, ...savedItems]

    // Update cache
    cache.data = all
    cache.ts = Date.now()
    cache.uid = user.id

    setItems(filterAndSort(all, filter, sortOrder))
    setLoading(false)
    loadingRef.current = false
  }, [user.id, filter, sortOrder])

  useEffect(() => { load() }, [load])

  // Reload when reading list membership changes (e.g. saved from FeedView)
  const lastSignal = useRef(readingListSignal.version)
  useEffect(() => {
    const interval = setInterval(() => {
      if (readingListSignal.version !== lastSignal.current) {
        lastSignal.current = readingListSignal.version
        cache.ts = 0  // bust cache
        load(true)    // force fresh fetch
      }
    }, 500)  // poll every 500ms — lightweight, just comparing two integers
    return () => clearInterval(interval)
  }, [load])


  function filterAndSort(all, f, sort) {
    let out = all
    if (f === 'unread') out = all.filter(i => !i.is_read)
    if (f === 'read')   out = all.filter(i => i.is_read)
    out = [...out].sort((a, b) => {
      const ta = new Date(a.saved_at || 0).getTime()
      const tb = new Date(b.saved_at || 0).getTime()
      return sort === 'oldest' ? ta - tb : tb - ta
    })
    return out
  }

  // Re-filter in-memory when filter/sort changes (no re-fetch)
  useEffect(() => {
    if (cache.data && cache.uid === user.id) {
      setItems(filterAndSort(cache.data, filter, sortOrder))
    }
  }, [filter, sortOrder])

  const handleMarkRead = async (item) => {
    const next = !item.is_read
    // Optimistic update
    const update = (prev) => prev.map(i => i.id === item.id && i._type === item._type
      ? { ...i, is_read: next } : i)
    setItems(update)
    if (cache.data) cache.data = cache.data.map(i =>
      i.id === item.id && i._type === item._type ? { ...i, is_read: next } : i)

    if (item._type === 'saved') {
      await supabase.from('saved_articles').update({ is_read: next }).eq('id', item.id)
    } else {
      const { markArticleRead, markArticleUnread } = await import('../lib/feedsService')
      if (next) await markArticleRead(item.id)
      else await markArticleUnread(item.id)
    }
    // After filter change some items should disappear
    if (filter === 'unread' || filter === 'read') {
      setItems(prev => filterAndSort(
        cache.data || prev.map(i => i.id === item.id && i._type === item._type ? { ...i, is_read: next } : i),
        filter, sortOrder
      ))
    }
  }

  const handleRemove = async (item) => {
    // Optimistic remove
    setItems(prev => prev.filter(i => !(i.id === item.id && i._type === item._type)))
    if (cache.data) cache.data = cache.data.filter(
      i => !(i.id === item.id && i._type === item._type))

    if (item._type === 'saved') {
      await supabase.from('saved_articles').update({ is_archived: true }).eq('id', item.id)
    } else {
      await toggleReadLater(item.id, true)
    }
  }

  const handleRefresh = () => {
    cache.ts = 0  // invalidate cache
    load(true)
    // Trigger background full-text fetch for items missing content
    prefetchReadingListContent(user.id).catch(() => {})
  }

  const unreadCount = (cache.data || []).filter(i => !i.is_read).length

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-2xl text-stone-900 dark:text-stone-100">Reading List</h1>
          <p className="text-base text-stone-500 dark:text-stone-400 mt-0.5">
            {loading ? 'Loading…' : `${items.length} item${items.length !== 1 ? 's' : ''}`}
            {!loading && unreadCount > 0 && filter !== 'read' && (
              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-400 text-xs rounded-full font-medium">
                {unreadCount} unread
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleRefresh}
            className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 rounded-lg transition-colors"
            title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg transition-colors"
            title="Import links">
            <Upload className="w-3.5 h-3.5" />Import
          </button>
          {/* Sort */}
          <div className="flex items-center bg-stone-100 dark:bg-stone-800 rounded-full p-0.5 gap-0.5">
            {SORT_OPTIONS.map(({ id, label }) => (
              <button key={id} onClick={() => setSortOrder(id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  sortOrder === id
                    ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm'
                    : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
                }`}>{label}</button>
            ))}
          </div>
          {/* Filter */}
          <div className="flex items-center bg-stone-100 dark:bg-stone-800 rounded-lg p-0.5">
            {FILTER_OPTIONS.map(({ id, label }) => (
              <button key={id} onClick={() => setFilter(id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  filter === id
                    ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm'
                    : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
                }`}>{label}</button>
            ))}
          </div>
        </div>
      </div>



      {/* Mobile save tip */}
      <div className="mb-5 p-4 bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800/40 rounded-xl">
        <p className="text-xs font-semibold text-brand-700 dark:text-brand-400 mb-1">Save from anywhere on mobile</p>
        <p className="text-xs text-stone-600 dark:text-stone-400">
          Tap <strong>Share</strong> in any app → select <strong>myFeedReader</strong> to save any article, tweet, or post directly to your Reading List — with full text fetched for offline reading.
          Articles you flag <BookMarked className="w-3 h-3 inline align-text-bottom mx-0.5" /> in your feed are saved here automatically.
        </p>
      </div>
      {/* Skeletons */}
      {loading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-xl p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-stone-200 dark:bg-stone-700 mt-2 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-stone-100 dark:bg-stone-800 rounded w-1/4" />
                  <div className="h-4 bg-stone-100 dark:bg-stone-800 rounded w-4/5" />
                  <div className="h-3 bg-stone-50 dark:bg-stone-800/50 rounded w-full" />
                  <div className="h-3 bg-stone-50 dark:bg-stone-800/50 rounded w-3/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="text-center py-24">
          <div className="w-16 h-16 bg-stone-50 dark:bg-stone-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookMarked className="w-7 h-7 text-stone-300 dark:text-stone-600" />
          </div>
          <h3 className="font-semibold text-stone-700 dark:text-stone-300 mb-2">
            {filter === 'read' ? 'Nothing read yet' : 'Your reading list is empty'}
          </h3>
          <p className="text-sm text-stone-400 dark:text-stone-500 max-w-xs mx-auto">
            {filter === 'unread'
              ? 'Tap the bookmark icon on any article, or use the share sheet on mobile.'
              : 'Save articles from your feed or any app to read here.'}
          </p>
          {filter === 'unread' && (
            <button onClick={() => setFilter('all')}
              className="mt-4 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors">
              Show all
            </button>
          )}
        </div>
      )}

      {/* List */}
      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {items.map(item => (
            <ReadingCard
              key={`${item._type}-${item.id}`}
              item={item}
              onMarkRead={handleMarkRead}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}
      {showImport && (
        <ImportLinksModal
          onClose={() => setShowImport(false)}
          onImportComplete={() => {
            cache.ts = 0
            load(true)
          }}
        />
      )}
    </div>
  )
}
