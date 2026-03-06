import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Inbox, ExternalLink, Check, Trash2, Clock, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const FILTERS = [
  { id: 'unread',   label: 'Unread' },
  { id: 'all',      label: 'All' },
  { id: 'archived', label: 'Archived' },
]

function ArticleCard({ article, onMarkRead, onArchive, onDelete }) {
  const navigate = useNavigate()
  const hasFullText = !!(article.full_text && article.full_text.length > 100)

  const domain = (() => {
    try { return new URL(article.url).hostname.replace('www.', '') }
    catch { return '' }
  })()

  return (
    <div className={`bg-white dark:bg-stone-900 border rounded-xl overflow-hidden transition-colors ${
      article.is_read
        ? 'border-stone-100 dark:border-stone-800'
        : 'border-brand-200 dark:border-brand-900/60'
    }`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Unread dot */}
          <div className="mt-1.5 flex-shrink-0">
            <div className={`w-2 h-2 rounded-full ${article.is_read ? 'bg-transparent' : 'bg-brand-500'}`} />
          </div>

          <div className="flex-1 min-w-0">
            {/* Title — navigates to reader */}
            <button
              onClick={() => navigate(`/saved/read/${article.id}`)}
              className="text-left w-full"
            >
              <p className={`text-[15px] font-semibold leading-snug mb-1.5 ${
                article.is_read
                  ? 'text-stone-500 dark:text-stone-400'
                  : 'text-stone-900 dark:text-stone-100'
              }`}>
                {article.title || article.url}
              </p>
            </button>

            {/* Meta row */}
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              {domain && <span className="text-xs text-stone-400 dark:text-stone-500">{domain}</span>}
              {article.author && (
                <><span className="text-stone-200 dark:text-stone-700 text-xs">·</span>
                <span className="text-xs text-stone-400 dark:text-stone-500">{article.author}</span></>
              )}
              {article.reading_time_min && (
                <><span className="text-stone-200 dark:text-stone-700 text-xs">·</span>
                <span className="text-xs text-stone-400 dark:text-stone-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />{article.reading_time_min} min
                </span></>
              )}
              <span className={`text-xs flex items-center gap-1 ml-auto ${
                hasFullText ? 'text-brand-600 dark:text-brand-400' : 'text-stone-300 dark:text-stone-600'
              }`} title={hasFullText ? 'Full text saved — readable offline' : 'Link only'}>
                {hasFullText ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              </span>
            </div>

            {/* Excerpt */}
            {article.excerpt && (
              <p className="text-sm text-stone-400 dark:text-stone-500 leading-relaxed line-clamp-2">
                {article.excerpt}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="px-4 pb-3 flex items-center gap-1 border-t border-stone-50 dark:border-stone-800/50">
        <button
          onClick={() => onMarkRead(article.id, article.is_read)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg transition-colors text-stone-500 dark:text-stone-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20"
        >
          <Check className="w-3.5 h-3.5" />
          {article.is_read ? 'Mark unread' : 'Mark read'}
        </button>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg transition-colors text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800"
        >
          <ExternalLink className="w-3.5 h-3.5" />Original
        </a>
        <div className="flex-1" />
        {!article.is_archived && (
          <button
            onClick={() => onArchive(article.id)}
            className="px-2.5 py-1.5 text-xs rounded-lg transition-colors text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800"
          >
            Archive
          </button>
        )}
        <button
          onClick={() => onDelete(article.id)}
          className="p-1.5 text-stone-300 dark:text-stone-600 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

export default function SavedView() {
  const { user } = useAuth()
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('unread')
  const [sortOrder, setSortOrder] = useState('newest')

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('saved_articles')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: sortOrder === 'oldest' })

    if (filter === 'unread')   q = q.eq('is_read', false).eq('is_archived', false)
    if (filter === 'all')      q = q.eq('is_archived', false)
    if (filter === 'archived') q = q.eq('is_archived', true)

    const { data } = await q
    setArticles(data || [])
    setLoading(false)
  }, [user.id, filter, sortOrder])

  useEffect(() => { load() }, [load])

  const handleMarkRead = async (id, isRead) => {
    await supabase.from('saved_articles').update({ is_read: !isRead }).eq('id', id)
    setArticles(prev => {
      const updated = prev.map(a => a.id === id ? { ...a, is_read: !isRead } : a)
      if (filter === 'unread' && !isRead) return updated.filter(a => a.id !== id)
      return updated
    })
  }

  const handleArchive = async (id) => {
    await supabase.from('saved_articles').update({ is_archived: true, is_read: true }).eq('id', id)
    setArticles(prev => prev.filter(a => a.id !== id))
  }

  const handleDelete = async (id) => {
    await supabase.from('saved_articles').delete().eq('id', id)
    setArticles(prev => prev.filter(a => a.id !== id))
  }
  const unreadCount = articles.filter(a => !a.is_read && !a.is_archived).length

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-2xl text-stone-900 dark:text-stone-100">Saved</h1>
          <p className="text-base text-stone-500 dark:text-stone-400 mt-0.5">
            {loading ? '…' : `${articles.length} article${articles.length !== 1 ? 's' : ''}`}
            {filter === 'unread' && unreadCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-400 text-xs rounded-full font-medium">
                {unreadCount} unread
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={load}
            className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {/* Sort toggle */}
          <div className="flex items-center bg-stone-100 dark:bg-stone-800 rounded-full p-0.5 gap-0.5">
            <button onClick={() => setSortOrder('newest')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${sortOrder === 'newest' ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm' : 'text-stone-500 dark:text-stone-400'}`}>
              ↓ Newest
            </button>
            <button onClick={() => setSortOrder('oldest')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${sortOrder === 'oldest' ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm' : 'text-stone-500 dark:text-stone-400'}`}>
              ↑ Oldest
            </button>
          </div>
          {/* Read filter */}
          <div className="flex items-center bg-stone-100 dark:bg-stone-800 rounded-lg p-0.5">
            {FILTERS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  filter === id
                    ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm'
                    : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-stone-100 dark:bg-stone-800 rounded w-2/3 mb-2" />
              <div className="h-3 bg-stone-50 dark:bg-stone-800/50 rounded w-full mb-1" />
              <div className="h-3 bg-stone-50 dark:bg-stone-800/50 rounded w-4/5" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && articles.length === 0 && (
        <div className="text-center py-24">
          <div className="w-16 h-16 bg-stone-50 dark:bg-stone-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Inbox className="w-7 h-7 text-stone-300 dark:text-stone-600" />
          </div>
          <h3 className="font-semibold text-stone-700 dark:text-stone-300 mb-2">
            {filter === 'archived' ? 'No archived articles' : filter === 'unread' ? 'All caught up!' : 'Nothing saved yet'}
          </h3>
          <p className="text-sm text-stone-400 dark:text-stone-500 max-w-xs mx-auto">
            {filter === 'unread'
              ? 'Use the share sheet on mobile to save articles from anywhere.'
              : 'Save articles from any app using the share sheet on mobile.'}
          </p>
          {filter === 'unread' && (
            <button
              onClick={() => setFilter('all')}
              className="mt-4 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
            >
              Show all saved
            </button>
          )}
        </div>
      )}

      {/* Article list */}
      {!loading && articles.length > 0 && (
        <div className="space-y-3">
          {articles.map(article => (
            <ArticleCard
              key={article.id}
              article={article}
              onMarkRead={handleMarkRead}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
