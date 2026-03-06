import { useState, useEffect, useRef } from 'react'
import { Search, X, Rss, Plus, Check, Loader2, ExternalLink, TrendingUp } from 'lucide-react'
import { addFeed } from '../lib/feedsService'
import { useAuth } from '../contexts/AuthContext'

// Curated seed directory — popular feeds by topic
// These are always shown as suggestions before the user types
const SEED_FEEDS = {
  'Business & Strategy': [
    { title: 'Harvard Business Review', url: 'https://hbr.org/feed', description: 'Management thinking and practice' },
    { title: 'McKinsey Insights', url: 'https://www.mckinsey.com/rss/insights.xml', description: 'Strategy and business research' },
    { title: 'Ben Thompson — Stratechery', url: 'https://stratechery.com/feed/', description: 'Technology strategy analysis' },
    { title: 'Farnam Street', url: 'https://fs.blog/feed/', description: 'Mental models, decision making' },
  ],
  'Finance & Economics': [
    { title: 'FT Markets', url: 'https://www.ft.com/rss/home/uk', description: 'Financial Times markets coverage' },
    { title: 'The Economist', url: 'https://www.economist.com/finance-and-economics/rss.xml', description: 'Finance and economics' },
    { title: 'Bloomberg Economics', url: 'https://feeds.bloomberg.com/markets/news.rss', description: 'Markets and economics news' },
    { title: 'Marginal Revolution', url: 'https://feeds.feedburner.com/marginalrevolution/feed', description: 'Economics and ideas' },
  ],
  'Technology': [
    { title: 'TechCrunch', url: 'https://techcrunch.com/feed/', description: 'Tech startups and venture capital' },
    { title: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', description: 'Technology, science, culture' },
    { title: 'Hacker News', url: 'https://news.ycombinator.com/rss', description: 'Tech and startup discussions' },
    { title: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/', description: 'Emerging technology' },
  ],
  'Africa & Kenya': [
    { title: 'Business Daily Africa', url: 'https://www.businessdailyafrica.com/rss.xml', description: 'East African business news' },
    { title: 'The East African', url: 'https://www.theeastafrican.co.ke/rss', description: 'Regional news and analysis' },
    { title: 'Quartz Africa', url: 'https://qz.com/africa/feed', description: 'African business and economy' },
    { title: 'TechCabal', url: 'https://techcabal.com/feed/', description: 'African tech ecosystem' },
  ],
  'Leadership & Ideas': [
    { title: 'Tim Ferriss Blog', url: 'https://tim.blog/feed/', description: 'Interviews and life experiments' },
    { title: 'Seth Godin', url: 'https://seths.blog/feed.xml', description: 'Marketing, leadership, change' },
    { title: 'Paul Graham Essays', url: 'http://www.paulgraham.com/rss.html', description: 'Startups and technology essays' },
    { title: 'Brain Pickings', url: 'https://www.themarginalian.org/feed/', description: 'Ideas across disciplines' },
  ],
}

// Feedly search API via CORS proxy — finds real RSS feeds by keyword
async function searchFeeds(query) {
  if (!query.trim()) return []
  try {
    const res = await fetch(
      `https://cloud.feedly.com/v3/search/feeds?query=${encodeURIComponent(query)}&count=12`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) throw new Error('search failed')
    const json = await res.json()
    return (json.results || []).map(f => ({
      title: f.title || f.id,
      url: f.feedId?.replace('feed/', '') || f.website,
      description: f.description || f.language || '',
      subscribers: f.subscribers,
    })).filter(f => f.url)
  } catch {
    return []
  }
}

export default function FeedDiscoveryModal({ onClose, onAdded }) {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState({})
  const [added, setAdded] = useState({})
  const [activeCategory, setActiveCategory] = useState(Object.keys(SEED_FEEDS)[0])
  const [error, setError] = useState('')
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const found = await searchFeeds(query)
      setResults(found)
      setSearching(false)
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  const handleAdd = async (feed) => {
    if (added[feed.url]) return
    setAdding(prev => ({ ...prev, [feed.url]: true }))
    setError('')
    try {
      await addFeed({ userId: user.id, url: feed.url, title: feed.title, category: activeCategory })
      setAdded(prev => ({ ...prev, [feed.url]: true }))
      onAdded?.()
    } catch (err) {
      setError(`Could not add "${feed.title}": ${err.message}`)
    } finally {
      setAdding(prev => ({ ...prev, [feed.url]: false }))
    }
  }

  const displayFeeds = query.trim() ? results : SEED_FEEDS[activeCategory] || []
  const showingSearch = query.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white dark:bg-stone-900 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display font-bold text-xl text-stone-900 dark:text-stone-100">Discover Feeds</h2>
              <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">Search by topic or browse curated sources</p>
            </div>
            <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by topic, e.g. 'fintech Africa', 'AI', 'climate'..."
              className="w-full pl-9 pr-4 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
            {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 animate-spin" />}
            {query && !searching && <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>}
          </div>
        </div>

        {/* Category tabs — only shown when not searching */}
        {!showingSearch && (
          <div className="px-5 py-3 border-b border-stone-100 dark:border-stone-800 flex gap-1.5 overflow-x-auto scrollbar-none">
            {Object.keys(SEED_FEEDS).map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                  activeCategory === cat
                    ? 'bg-brand-600 text-white'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                }`}>
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl text-xs">
              {error}
            </div>
          )}

          {showingSearch && !searching && results.length === 0 && (
            <div className="text-center py-12">
              <Search className="w-8 h-8 text-stone-200 dark:text-stone-700 mx-auto mb-3" />
              <p className="text-sm text-stone-500 dark:text-stone-400">No feeds found for "{query}"</p>
              <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">Try a broader search term</p>
            </div>
          )}

          {searching && (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 animate-pulse">
                  <div className="w-8 h-8 bg-stone-200 dark:bg-stone-700 rounded-lg flex-shrink-0" />
                  <div className="flex-1">
                    <div className="h-3.5 bg-stone-200 dark:bg-stone-700 rounded w-1/2 mb-2" />
                    <div className="h-3 bg-stone-100 dark:bg-stone-800 rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!searching && displayFeeds.length > 0 && (
            <div className="space-y-2">
              {!showingSearch && (
                <p className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wide mb-3">
                  Curated — {activeCategory}
                </p>
              )}
              {showingSearch && (
                <p className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wide mb-3">
                  {results.length} feeds found
                </p>
              )}
              {displayFeeds.map((feed) => (
                <div key={feed.url}
                  className="flex items-start gap-3 p-3 rounded-xl border border-stone-100 dark:border-stone-800 hover:border-stone-200 dark:hover:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors group">
                  <div className="w-8 h-8 bg-brand-50 dark:bg-brand-900/30 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Rss className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">{feed.title}</p>
                      {feed.subscribers && (
                        <span className="flex items-center gap-1 text-xs text-stone-400 dark:text-stone-500 flex-shrink-0">
                          <TrendingUp className="w-3 h-3" />
                          {feed.subscribers > 1000 ? `${(feed.subscribers/1000).toFixed(0)}k` : feed.subscribers}
                        </span>
                      )}
                    </div>
                    {feed.description && (
                      <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 line-clamp-2">{feed.description}</p>
                    )}
                    <p className="text-xs text-stone-300 dark:text-stone-600 mt-0.5 truncate">{feed.url}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <a href={feed.url} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="p-1.5 text-stone-300 dark:text-stone-600 hover:text-stone-500 dark:hover:text-stone-400 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button onClick={() => handleAdd(feed)} disabled={adding[feed.url] || added[feed.url]}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        added[feed.url]
                          ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 cursor-default'
                          : 'bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50'
                      }`}>
                      {adding[feed.url] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                       added[feed.url]  ? <Check className="w-3.5 h-3.5" /> :
                                          <Plus className="w-3.5 h-3.5" />}
                      {added[feed.url] ? 'Added' : 'Add'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
