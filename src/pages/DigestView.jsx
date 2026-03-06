import { useState, useEffect } from 'react'
import { BookOpen, ExternalLink, Clock, Bookmark, BookmarkCheck, ChevronDown, ChevronUp, Calendar } from 'lucide-react'
import { formatDistanceToNow, isToday, isYesterday, parseISO, format } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import { usePlan, GATED_FEATURES } from '../contexts/PlanContext'
import PaywallModal from '../components/PaywallModal'
import { supabase } from '../lib/supabase'
import { toggleBookmark, markArticleRead } from '../lib/feedsService'

const CAT_COLOR = { Finance:'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800', Strategy:'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-900/20 dark:text-brand-400 dark:border-brand-800', Technology:'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800', Politics:'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800', Economics:'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800', Culture:'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800', Health:'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-400 dark:border-teal-800', Science:'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800', General:'bg-stone-50 text-stone-600 border-stone-200 dark:bg-stone-800/40 dark:text-stone-400 dark:border-stone-700' }
const CAT_DOT  = { Finance:'bg-emerald-500', Strategy:'bg-brand-500', Technology:'bg-blue-500', Politics:'bg-red-500', Economics:'bg-amber-500', Culture:'bg-purple-500', Health:'bg-teal-500', Science:'bg-cyan-500', General:'bg-stone-400' }

function formatPubDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = parseISO(dateStr)
    if (isToday(d)) return formatDistanceToNow(d, { addSuffix: true })
    if (isYesterday(d)) return 'Yesterday'
    return format(d, 'MMM d')
  } catch { try { const d = new Date(dateStr); if (isToday(d)) return formatDistanceToNow(d, { addSuffix: true }); return format(d, 'MMM d') } catch { return '' } }
}

function DigestCategory({ category, articles, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  const [localArticles, setLocalArticles] = useState(articles)
  const colorClass = CAT_COLOR[category] || CAT_COLOR.General
  const dotClass   = CAT_DOT[category]   || CAT_DOT.General
  const unread = localArticles.filter(a => !a.is_read).length

  const handleOpen = async (article) => {
    window.open(article.link, '_blank', 'noopener')
    if (!article.is_read) { await markArticleRead(article.id); setLocalArticles(prev => prev.map(a => a.id === article.id ? { ...a, is_read: true } : a)) }
  }
  const handleBookmark = async (article) => {
    const next = !article.is_bookmarked
    setLocalArticles(prev => prev.map(a => a.id === article.id ? { ...a, is_bookmarked: next } : a))
    await toggleBookmark(article.id, article.is_bookmarked)
  }

  return (
    <div className={`border rounded-2xl overflow-hidden ${colorClass}`}>
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-5 py-4 hover:opacity-80 transition-opacity">
        <div className="flex items-center gap-3">
          <span className={`w-2.5 h-2.5 rounded-full ${dotClass} flex-shrink-0`} />
          <span className="font-semibold text-sm">{category}</span>
          <span className="text-xs opacity-60">{localArticles.length} articles</span>
          {unread > 0 && <span className="text-xs font-medium bg-white/60 dark:bg-black/20 px-2 py-0.5 rounded-full">{unread} unread</span>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 opacity-50" /> : <ChevronDown className="w-4 h-4 opacity-50" />}
      </button>
      {open && (
        <div className="bg-white dark:bg-stone-900 divide-y divide-stone-50 dark:divide-stone-800">
          {localArticles.map(article => (
            <div key={article.id} className={`px-5 py-3.5 flex items-start gap-3 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors ${article.is_read ? 'opacity-60' : ''}`}>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleOpen(article)}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-stone-400 dark:text-stone-500 truncate">{article.feeds?.title || 'Unknown source'}</span>
                  <span className="text-xs text-stone-300 dark:text-stone-600">·</span>
                  <span className="text-xs text-stone-400 dark:text-stone-500 flex-shrink-0 flex items-center gap-1">
                    <Clock className="w-3 h-3" />{formatPubDate(article.pub_date)}
                  </span>
                </div>
                <p className="text-sm font-medium text-stone-800 dark:text-stone-200 leading-snug line-clamp-2">{article.title}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => handleBookmark(article)} className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors">
                  {article.is_bookmarked ? <BookmarkCheck className="w-4 h-4 text-brand-600" /> : <Bookmark className="w-4 h-4" />}
                </button>
                <button onClick={() => handleOpen(article)} className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors">
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DigestView() {
  const { user } = useAuth()
  const { canUseFeature } = usePlan()
  const [showPaywall, setShowPaywall] = useState(false)
  const [grouped, setGrouped] = useState({})
  const [loading, setLoading] = useState(true)
  const [totalArticles, setTotalArticles] = useState(0)
  const [unreadTotal, setUnreadTotal] = useState(0)
  const [dateRange, setDateRange] = useState('today')

  const isPro = canUseFeature(GATED_FEATURES.DIGEST)

  useEffect(() => {
    if (isPro) loadDigest()
    else setLoading(false)
  }, [dateRange, isPro])

  const loadDigest = async () => {
    setLoading(true)
    try {
      const now = new Date()
      const since = new Date(now)
      if (dateRange === 'today') since.setHours(0, 0, 0, 0)
      else since.setDate(since.getDate() - 7)

      const { data, error } = await supabase
        .from('articles').select('*, feeds(title, category, url)')
        .eq('user_id', user.id).gte('pub_date', since.toISOString())
        .order('pub_date', { ascending: false })
      if (error) throw error

      const groups = {}
      ;(data || []).forEach(article => { const cat = article.category || 'General'; if (!groups[cat]) groups[cat] = []; groups[cat].push(article) })
      setGrouped(groups); setTotalArticles(data?.length || 0); setUnreadTotal(data?.filter(a => !a.is_read).length || 0)
    } catch { } finally { setLoading(false) }
  }

  const handleUpgradeClick = () => setShowPaywall(true)

  // ── Free user gate ──────────────────────────────────────────────
  if (!isPro) {
    return (
      <div>
        <div className="text-center py-24">
          <div className="w-16 h-16 bg-brand-50 dark:bg-brand-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-7 h-7 text-brand-500" />
          </div>
          <h3 className="font-semibold text-stone-700 dark:text-stone-300 mb-2">Daily Digest is a Pro feature</h3>
          <p className="text-sm text-stone-400 dark:text-stone-500 max-w-xs mx-auto mb-5">
            Get a curated summary of everything important from your feeds, organised by topic and category.
          </p>
          <button onClick={handleUpgradeClick}
            className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors">
            Upgrade to Pro
          </button>
        </div>
        {showPaywall && <PaywallModal feature={GATED_FEATURES.DIGEST} onClose={() => setShowPaywall(false)} />}
      </div>
    )
  }

  // ── Pro user view ───────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-stone-900 dark:text-stone-100">Daily Digest</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Calendar className="w-3.5 h-3.5 text-stone-400" />
            <p className="text-sm text-stone-500 dark:text-stone-400">{format(new Date(), 'EEEE, MMMM d')}</p>
          </div>
        </div>
        <div className="flex items-center bg-stone-100 dark:bg-stone-800 rounded-lg p-0.5">
          {['today', 'week'].map(range => (
            <button key={range} onClick={() => setDateRange(range)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${dateRange === range ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm' : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300'}`}>
              {range === 'today' ? 'Today' : 'This week'}
            </button>
          ))}
        </div>
      </div>

      {!loading && totalArticles > 0 && (
        <div className="flex items-center gap-3 mb-6 p-4 bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-xl flex-wrap">
          <div className="text-center"><p className="text-xl font-bold text-stone-900 dark:text-stone-100">{totalArticles}</p><p className="text-xs text-stone-400 dark:text-stone-500">articles</p></div>
          <div className="w-px h-8 bg-stone-100 dark:bg-stone-800" />
          <div className="text-center"><p className="text-xl font-bold text-brand-600">{unreadTotal}</p><p className="text-xs text-stone-400 dark:text-stone-500">unread</p></div>
          <div className="w-px h-8 bg-stone-100 dark:bg-stone-800" />
          <div className="text-center"><p className="text-xl font-bold text-stone-900 dark:text-stone-100">{Object.keys(grouped).length}</p><p className="text-xs text-stone-400 dark:text-stone-500">categories</p></div>
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-2xl p-5 animate-pulse">
              <div className="h-5 bg-stone-100 dark:bg-stone-800 rounded w-1/4 mb-4" />
              <div className="space-y-3">{[...Array(3)].map((_, j) => <div key={j} className="h-4 bg-stone-50 dark:bg-stone-800/50 rounded w-3/4" />)}</div>
            </div>
          ))}
        </div>
      )}

      {!loading && totalArticles === 0 && (
        <div className="text-center py-24">
          <div className="w-16 h-16 bg-stone-50 dark:bg-stone-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-7 h-7 text-stone-300 dark:text-stone-600" />
          </div>
          <h3 className="font-semibold text-stone-700 dark:text-stone-300 mb-2">No articles {dateRange === 'today' ? 'today' : 'this week'} yet</h3>
          <p className="text-sm text-stone-400 dark:text-stone-500 max-w-xs mx-auto">Refresh your feeds to pull in the latest content.</p>
        </div>
      )}

      {!loading && totalArticles > 0 && (
        <div className="space-y-4">
          {Object.entries(grouped).sort((a, b) => b[1].length - a[1].length).map(([category, articles], i) => (
            <DigestCategory key={category} category={category} articles={articles} defaultOpen={i < 3} />
          ))}
        </div>
      )}
    </div>
  )
}
