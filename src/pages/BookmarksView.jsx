import { useState, useEffect, useCallback } from 'react'
import { Bookmark } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import ArticleCard from '../components/ArticleCard'
import PaywallModal from '../components/PaywallModal'

const bkmCache = { data: null, ts: 0, uid: null }
const BKM_TTL = 60_000

export default function BookmarksView() {
  const { user } = useAuth()
  const [paywallFeature, setPaywallFeature] = useState(null)
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortOrder, setSortOrder] = useState('newest')

  const load = useCallback(async (force = false) => {
    const now = Date.now()
    if (!force && bkmCache.uid === user.id && bkmCache.data && (now - bkmCache.ts) < BKM_TTL && bkmCache.sort === sortOrder) {
      setArticles(bkmCache.data); setLoading(false); return
    }
    setLoading(true)
    const { data } = await supabase
      .from('articles').select('*, feeds(title, category, url)')
      .eq('user_id', user.id).eq('is_bookmarked', true)
      .order('pub_date', { ascending: sortOrder === 'oldest' })
    bkmCache.data = data || []; bkmCache.ts = Date.now(); bkmCache.uid = user.id; bkmCache.sort = sortOrder
    setArticles(data || [])
    setLoading(false)
  }, [user.id, sortOrder])

  useEffect(() => { load() }, [load])

  const handleUpdate = (updated) => {
    if (!updated.is_bookmarked) setArticles(prev => prev.filter(a => a.id !== updated.id))
    else setArticles(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a))
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-2xl text-stone-900 dark:text-stone-100">Bookmarks</h1>
          <p className="text-base text-stone-500 dark:text-stone-400 mt-0.5">Articles you\'ve saved to keep forever. Use {articles.length} saved article{articles.length !== 1 ? 's' : ''}Reading List</p>
        </div>
        <div className="flex items-center bg-stone-100 dark:bg-stone-800 rounded-full p-0.5 gap-0.5">
          <button onClick={() => setSortOrder('newest')} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${sortOrder === 'newest' ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm' : 'text-stone-500 dark:text-stone-400'}`}>↓ Newest</button>
          <button onClick={() => setSortOrder('oldest')} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${sortOrder === 'oldest' ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm' : 'text-stone-500 dark:text-stone-400'}`}>↑ Oldest</button>
        </div>
      </div>

      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-stone-100 dark:bg-stone-800 rounded w-2/3 mb-2" />
              <div className="h-3 bg-stone-50 dark:bg-stone-800/50 rounded w-full" />
            </div>
          ))}
        </div>
      )}

      {!loading && articles.length === 0 && (
        <div className="text-center py-24">
          <div className="w-16 h-16 bg-stone-50 dark:bg-stone-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Bookmark className="w-7 h-7 text-stone-300 dark:text-stone-600" />
          </div>
          <h3 className="font-semibold text-stone-700 dark:text-stone-300 mb-2">No bookmarks yet</h3>
          <p className="text-sm text-stone-400 dark:text-stone-500 max-w-xs mx-auto">Click the bookmark icon on any article to save it here.</p>
        </div>
      )}

      {!loading && articles.length > 0 && (
        <div className="space-y-3">
          {articles.map(article => (
            <ArticleCard
              key={article.id}
              article={article}
              onUpdate={handleUpdate}
              onUpgrade={(f) => setPaywallFeature(f)}
            />
          ))}
        </div>
      )}

      {paywallFeature && <PaywallModal feature={paywallFeature} onClose={() => setPaywallFeature(null)} />}
    </div>
  )
}
