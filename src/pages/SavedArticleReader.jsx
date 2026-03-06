import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Check, Wifi, WifiOff, Clock } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function SavedArticleReader() {
  const { savedId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [readingProgress, setReadingProgress] = useState(0)

  const contentRef = useRef(null)
  const markedReadRef = useRef(false)
  const progressKey = `saved-progress-${savedId}`

  useEffect(() => {
    if (!savedId || !user) return
    supabase.from('saved_articles').select('*').eq('id', savedId).eq('user_id', user.id).single()
      .then(({ data }) => { setArticle(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [savedId, user])

  // Restore scroll progress
  useEffect(() => {
    if (!article || !contentRef.current) return
    const saved = localStorage.getItem(progressKey)
    if (saved) {
      const pct = parseFloat(saved)
      setReadingProgress(pct)
      setTimeout(() => {
        if (contentRef.current) {
          contentRef.current.scrollTop = (pct / 100) * (contentRef.current.scrollHeight - contentRef.current.clientHeight)
        }
      }, 150)
    }
  }, [article])

  const handleScroll = useCallback(() => {
    if (!contentRef.current) return
    const el = contentRef.current
    const scrollable = el.scrollHeight - el.clientHeight
    if (scrollable <= 0) return
    const pct = Math.round((el.scrollTop / scrollable) * 100)
    setReadingProgress(pct)
    localStorage.setItem(progressKey, String(pct))
    if (pct >= 85 && !markedReadRef.current && article) {
      markedReadRef.current = true
      supabase.from('saved_articles').update({ is_read: true }).eq('id', article.id)
    }
  }, [article?.id, progressKey])

  const domain = (() => {
    try { return new URL(article?.url || '').hostname.replace('www.', '') }
    catch { return '' }
  })()
  const hasFullText = !!(article?.full_text && article.full_text.length > 100)

  if (loading) return (
    <div className="min-h-screen bg-[#fafaf9] dark:bg-stone-950 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin" />
    </div>
  )
  if (!article) return (
    <div className="min-h-screen bg-[#fafaf9] dark:bg-stone-950 flex items-center justify-center">
      <div className="text-center">
        <p className="text-stone-500 dark:text-stone-400 mb-4">Article not found</p>
        <button onClick={() => navigate(-1)} className="text-brand-600 dark:text-brand-400 text-sm font-medium">← Go back</button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#fafaf9] dark:bg-stone-950">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-[#fafaf9]/90 dark:bg-stone-950/90 backdrop-blur border-b border-stone-100 dark:border-stone-800">
        <div className="h-0.5 bg-stone-100 dark:bg-stone-800">
          <div className="h-full bg-brand-500 transition-all duration-300" style={{ width: `${readingProgress}%` }} />
        </div>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <p className="text-sm text-stone-500 dark:text-stone-400 truncate flex-1">{domain || 'Saved article'}</p>
          <div className="flex items-center gap-1">
            <span title={hasFullText ? 'Full text saved' : 'Link only'}
              className={hasFullText ? 'text-brand-500' : 'text-stone-300 dark:text-stone-600'}>
              {hasFullText ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            </span>
            <a href={article.url} target="_blank" rel="noopener noreferrer"
              className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors">
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Content */}
      <div ref={contentRef} onScroll={handleScroll} className="max-w-2xl mx-auto px-5 py-8 pb-24">
        <h1 className="font-display font-bold text-2xl md:text-3xl text-stone-900 dark:text-stone-100 leading-tight mb-4">
          {article.title || article.url}
        </h1>

        <div className="flex items-center gap-3 flex-wrap mb-6 pb-6 border-b border-stone-100 dark:border-stone-800">
          {article.author && <span className="text-sm text-stone-600 dark:text-stone-400">By {article.author}</span>}
          {article.reading_time_min && (
            <span className="text-sm text-stone-400 dark:text-stone-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />{article.reading_time_min} min read
            </span>
          )}
          {domain && <span className="text-sm text-stone-400 dark:text-stone-500 ml-auto">{domain}</span>}
        </div>

        {hasFullText ? (
          <p className="text-base text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-line">
            {article.full_text}
          </p>
        ) : (
          <div>
            {article.excerpt && (
              <p className="text-base text-stone-700 dark:text-stone-300 leading-relaxed mb-6">{article.excerpt}</p>
            )}
            <div className="p-4 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-100 dark:border-stone-800">
              <p className="text-sm text-stone-500 dark:text-stone-400 mb-3">
                Full text wasn't captured when this was saved. Read it on the original site:
              </p>
              <a href={article.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-brand-600 dark:text-brand-400 font-medium">
                Open original article <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}

        <div className="mt-12 pt-6 border-t border-stone-100 dark:border-stone-800">
          <a href={article.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
            Open original <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  )
}
