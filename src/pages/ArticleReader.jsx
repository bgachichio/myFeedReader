import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Bookmark, BookmarkCheck, BookMarked, Share2, Clock, Timer, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { markArticleRead, markArticleUnread, toggleBookmark, toggleReadLater } from '../lib/feedsService'
import { fetchFullText } from '../lib/fullText'
import { usePlan, GATED_FEATURES } from '../contexts/PlanContext'
import { useSettings } from '../contexts/SettingsContext'
import { formatArticleDate } from '../lib/dateFormat'
import { estimateReadingTime, formatReadingTime } from '../lib/readingTime'
import PaywallModal from '../components/PaywallModal'

const CATEGORY_COLORS = {
  Finance:'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  Strategy:'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400',
  Technology:'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Politics:'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Economics:'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Culture:'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Health:'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  Science:'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  General:'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400',
}

export default function ArticleReader() {
  const { articleId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { settings } = useSettings()
  const { canUseFeature } = usePlan()

  const [article, setArticle] = useState(location.state?.article || null)
  const [fullText, setFullText] = useState(null)
  const [loading, setLoading] = useState(!location.state?.article)
  const [fetchingText, setFetchingText] = useState(false)
  const [fetchFailed, setFetchFailed] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)
  const [readLater, setReadLater] = useState(false)
  const [read, setRead] = useState(false)
  const [readingProgress, setReadingProgress] = useState(0)
  const [showPaywall, setShowPaywall] = useState(false)

  const contentRef = useRef(null)
  const markedReadRef = useRef(false)
  const progressKey = articleId ? `reading-progress-${articleId}` : null

  // Load article from DB if not passed via state
  useEffect(() => {
    if (article) {
      setBookmarked(article.is_bookmarked || false)
      setReadLater(article.is_read_later || false)
      setRead(article.is_read || false)
      return
    }
    if (!articleId || !user) return
    const load = async () => {
      const { data } = await supabase
        .from('articles')
        .select('*, feeds(title, category, url)')
        .eq('id', articleId)
        .eq('user_id', user.id)
        .single()
      if (data) {
        setArticle(data)
        setBookmarked(data.is_bookmarked || false)
        setReadLater(data.is_read_later || false)
        setRead(data.is_read || false)
      }
      setLoading(false)
    }
    load()
  }, [articleId, user])

  // Fetch full text once article is loaded
  useEffect(() => {
    if (!article) return
    if (!canUseFeature(GATED_FEATURES.FULL_TEXT)) { setShowPaywall(true); return }

    setFetchingText(true)
    fetchFullText(article.link, article.full_content || null)
      .then(result => {
        if (result?.content) setFullText(result.content)
        else setFetchFailed(true)
      })
      .catch(() => setFetchFailed(true))
      .finally(() => setFetchingText(false))
  }, [article?.id])

  // Restore reading progress
  useEffect(() => {
    if (!progressKey || !contentRef.current || !fullText) return
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
  }, [fullText])

  // Track scroll — mark read at 85%
  const handleScroll = useCallback(() => {
    if (!contentRef.current || !progressKey) return
    const el = contentRef.current
    const scrollable = el.scrollHeight - el.clientHeight
    if (scrollable <= 0) return
    const pct = Math.round((el.scrollTop / scrollable) * 100)
    setReadingProgress(pct)
    localStorage.setItem(progressKey, String(pct))
    if (pct >= 85 && !markedReadRef.current && article) {
      markedReadRef.current = true
      setRead(true)
      markArticleRead(article.id)
    }
  }, [article?.id, progressKey])

  const handleBookmark = async () => {
    const next = !bookmarked; setBookmarked(next)
    await toggleBookmark(article.id, bookmarked)
  }
  const handleReadLater = async () => {
    const next = !readLater; setReadLater(next)
    await toggleReadLater(article.id, readLater)
  }
  const handleToggleRead = async () => {
    const next = !read; setRead(next)
    if (next) await markArticleRead(article.id)
    else await markArticleUnread(article.id)
  }

  const category = article?.category || 'General'
  const colorClass = CATEGORY_COLORS[category] || CATEGORY_COLORS.General
  const displayText = fullText || article?.description
  const readingTime = displayText ? formatReadingTime(estimateReadingTime(`${article?.title || ''} ${displayText}`)) : null

  if (loading) return (
    <div className="min-h-screen bg-[#fafaf9] dark:bg-stone-950 flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
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
        {/* Reading progress bar */}
        <div className="h-0.5 bg-stone-100 dark:bg-stone-800">
          <div
            className="h-full bg-brand-500 transition-all duration-300"
            style={{ width: `${readingProgress}%` }}
          />
        </div>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <p className="text-sm text-stone-500 dark:text-stone-400 truncate flex-1 min-w-0">
            {article.feeds?.title || 'Article'}
          </p>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={handleBookmark} title={bookmarked ? 'Remove bookmark' : 'Bookmark'}
              className={`p-2 rounded-lg transition-colors ${bookmarked ? 'text-brand-600 bg-brand-50 dark:bg-brand-900/30' : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'}`}>
              {bookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            </button>
            <button onClick={handleReadLater} title={readLater ? 'Remove from Read Later' : 'Save for later'}
              className={`p-2 rounded-lg transition-colors ${readLater ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/30' : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'}`}>
              <BookMarked className="w-4 h-4" />
            </button>
            <a href={article.link} target="_blank" rel="noopener noreferrer"
              className="p-2 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Article content */}
      <div
        ref={contentRef}
        onScroll={handleScroll}
        className="max-w-2xl mx-auto px-5 py-8 pb-24"
      >
        {/* Category + source */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colorClass}`}>{category}</span>
          {article.feeds?.title && (
            <span className="text-sm text-stone-500 dark:text-stone-400 font-medium">{article.feeds.title}</span>
          )}
        </div>

        {/* Title */}
        <h1 className="font-display font-bold text-2xl md:text-3xl text-stone-900 dark:text-stone-100 leading-tight mb-4">
          {article.title}
        </h1>

        {/* Meta */}
        <div className="flex items-center gap-3 flex-wrap mb-6 pb-6 border-b border-stone-100 dark:border-stone-800">
          {article.author && (
            <span className="text-sm text-stone-600 dark:text-stone-400">By {article.author}</span>
          )}
          {article.pub_date && (
            <span className="text-sm text-stone-400 dark:text-stone-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatArticleDate(article.pub_date, settings)}
            </span>
          )}
          {readingTime && (
            <span className="text-sm text-stone-400 dark:text-stone-500 flex items-center gap-1">
              <Timer className="w-3.5 h-3.5" />{readingTime}
            </span>
          )}
          {read && (
            <span className="text-xs text-brand-600 dark:text-brand-400 font-medium ml-auto">✓ Read</span>
          )}
        </div>

        {/* Body */}
        {fetchingText && (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={`h-4 bg-stone-100 dark:bg-stone-800 rounded animate-pulse ${i % 3 === 2 ? 'w-4/5' : 'w-full'}`} />
            ))}
          </div>
        )}

        {!fetchingText && fullText && (
          <div className="prose-reader">
            <p className="text-base text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-line">
              {fullText}
            </p>
          </div>
        )}

        {!fetchingText && !fullText && article.description && (
          <div>
            <p className="text-base text-stone-700 dark:text-stone-300 leading-relaxed">
              {article.description}
            </p>
            {fetchFailed && (
              <div className="mt-6 p-4 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-100 dark:border-stone-800">
                <p className="text-sm text-stone-500 dark:text-stone-400 mb-3">
                  Full article text couldn't be fetched. Read it on the original site:
                </p>
                <a
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-brand-600 dark:text-brand-400 font-medium hover:text-brand-700 transition-colors"
                >
                  Open original article <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        )}

        {/* Bottom action bar */}
        <div className="mt-12 pt-6 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-4 flex-wrap">
          <button
            onClick={handleToggleRead}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              read
                ? 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                : 'bg-brand-600 text-white hover:bg-brand-700'
            }`}
          >
            {read ? '✓ Marked as read' : 'Mark as read'}
          </button>
          <a
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
          >
            Open original <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {showPaywall && <PaywallModal feature={GATED_FEATURES.FULL_TEXT} onClose={() => { setShowPaywall(false); navigate(-1) }} />}
    </div>
  )
}
