import { useState, useEffect } from 'react'
import { X, Link, Loader2, CheckCircle2, AlertCircle, Plus, Check } from 'lucide-react'
import { fetchRSSFeed } from '../lib/rssParser'
import { addFeed, upsertArticles, getFeeds } from '../lib/feedsService'
import { useAuth } from '../contexts/AuthContext'

const DEFAULT_CATEGORIES = ['Finance', 'Strategy', 'Technology', 'Politics', 'Economics', 'Culture', 'Health', 'Science', 'General']

export default function AddFeedModal({ onClose, onAdded }) {
  const { user } = useAuth()
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('General')
  const [allCategories, setAllCategories] = useState(DEFAULT_CATEGORIES)
  const [validating, setValidating] = useState(false)
  const [validated, setValidated] = useState(false)
  const [feedData, setFeedData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customCategory, setCustomCategory] = useState('')

  useEffect(() => {
    getFeeds(user.id).then(feeds => {
      const existing = feeds.map(f => f.category).filter(Boolean)
      setAllCategories([...new Set([...DEFAULT_CATEGORIES, ...existing])])
    }).catch(() => {})
  }, [user.id])

  const handleUrlChange = (e) => {
    const val = e.target.value; setUrl(val); setValidated(false); setFeedData(null)
    if (!title || title === url) setTitle(val)
  }

  const handleValidate = async () => {
    if (!url.trim()) return
    setValidating(true); setError(''); setValidated(false); setFeedData(null)
    try {
      const result = await fetchRSSFeed(url.trim())
      setValidated(true); setFeedData(result)
      if (!title || title === url.trim()) setTitle(result.feedTitle || url.trim())
    } catch { setError('Could not read this feed. Check the URL and try again.') }
    finally { setValidating(false) }
  }

  const handleAddCustomCategory = () => {
    const formatted = customCategory.trim().charAt(0).toUpperCase() + customCategory.trim().slice(1)
    if (!formatted) return
    if (!allCategories.includes(formatted)) setAllCategories(prev => [...prev.filter(c => c !== 'General'), formatted, 'General'])
    setCategory(formatted); setCustomCategory(''); setShowCustomInput(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); if (!url) return
    setLoading(true); setError('')
    try {
      let articles = feedData
      if (!articles) { try { articles = await fetchRSSFeed(url.trim()) } catch { articles = { items: [] } } }
      const feed = await addFeed({ userId: user.id, url: url.trim(), title: title.trim() || url.trim(), category })
      const items = (articles.items || []).slice(0, 10)
      if (items.length > 0) {
        await upsertArticles(items.map(item => ({ user_id: user.id, feed_id: feed.id, guid: item.guid, title: item.title, link: item.link, description: item.description, author: item.author, pub_date: item.pubDate ? new Date(item.pubDate).toISOString() : null, category })))
      }
      onAdded(feed); onClose()
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-2xl shadow-2xl w-full max-w-md p-8">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"><X className="w-4 h-4" /></button>
        <div className="mb-6">
          <h2 className="font-display font-bold text-2xl text-stone-900 dark:text-stone-100 mb-1">Add a source</h2>
          <p className="text-sm text-stone-500 dark:text-stone-400">Paste an RSS feed URL, blog, or newsletter link.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">Feed URL</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input type="url" value={url} onChange={handleUrlChange} placeholder="https://example.com/rss" required
                  className="w-full pl-10 pr-4 py-2.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder-stone-400 dark:placeholder-stone-500" />
              </div>
              <button type="button" onClick={handleValidate} disabled={validating || !url}
                className="px-3 py-2.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-sm rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap">
                {validating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {validating ? 'Checking...' : 'Validate'}
              </button>
            </div>
            {validated && <div className="flex items-center gap-1.5 mt-1.5 text-xs text-brand-600 dark:text-brand-400"><CheckCircle2 className="w-3.5 h-3.5" />Feed found — {feedData?.items?.length || 0} articles ready to import</div>}
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">Display name <span className="text-stone-400 dark:text-stone-500 font-normal">(optional)</span></label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Financial Times, Not Boring..."
              className="w-full px-4 py-2.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-stone-400 dark:placeholder-stone-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">Category</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {allCategories.map(cat => (
                <button key={cat} type="button" onClick={() => setCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${category === cat ? 'bg-brand-600 text-white border-brand-600' : 'bg-white dark:bg-stone-800 text-stone-500 dark:text-stone-400 border-stone-200 dark:border-stone-700 hover:border-brand-400 hover:text-brand-600'}`}>
                  {cat}
                </button>
              ))}
              {!showCustomInput && (
                <button type="button" onClick={() => setShowCustomInput(true)}
                  className="px-3 py-1 rounded-full text-xs font-medium border border-dashed border-stone-300 dark:border-stone-600 text-stone-400 dark:text-stone-500 hover:border-brand-400 hover:text-brand-600 transition-colors flex items-center gap-1">
                  <Plus className="w-3 h-3" />New
                </button>
              )}
            </div>
            {showCustomInput && (
              <div className="flex gap-2 mt-2">
                <input autoFocus type="text" value={customCategory} onChange={e => setCustomCategory(e.target.value)} maxLength={30}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomCategory() } if (e.key === 'Escape') { setShowCustomInput(false); setCustomCategory('') } }}
                  placeholder="e.g. Africa, Crypto, Climate..." className="flex-1 px-3 py-2 border border-brand-300 dark:border-brand-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                <button type="button" onClick={handleAddCustomCategory} disabled={!customCategory.trim()} className="p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-40 transition-colors"><Check className="w-4 h-4" /></button>
                <button type="button" onClick={() => { setShowCustomInput(false); setCustomCategory('') }} className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"><X className="w-4 h-4" /></button>
              </div>
            )}
          </div>

          {error && <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}</div>}

          <button type="submit" disabled={loading || !url}
            className="w-full py-2.5 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 text-sm flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Adding & fetching articles...' : 'Add source'}
          </button>
        </form>
      </div>
    </div>
  )
}
