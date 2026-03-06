import { useState } from 'react'
import { ExternalLink, Bookmark, BookmarkCheck, Clock, Timer, Share2, Twitter, Link2, Check, BookMarked, Loader2, MailOpen, Mail, CheckSquare } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { toggleBookmark, markArticleRead, markArticleUnread, toggleReadLater } from '../lib/feedsService'
import { estimateReadingTime, formatReadingTime } from '../lib/readingTime'
import { fetchFullText } from '../lib/fullText'
import { useSettings } from '../contexts/SettingsContext'
import { formatArticleDate } from '../lib/dateFormat'

const CATEGORY_COLORS = {
  Finance:   'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  Strategy:  'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400',
  Technology:'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Politics:  'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Economics: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Culture:   'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Health:    'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  Science:   'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  General:   'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400',
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  try { return formatDistanceToNow(parseISO(dateStr), { addSuffix: true }) }
  catch { try { return formatDistanceToNow(new Date(dateStr), { addSuffix: true }) } catch { return '' } }
}

function ShareMenu({ article, onClose }) {
  const [copied, setCopied] = useState(false)
  const copyLink = async (e) => {
    e.stopPropagation()
    try { await navigator.clipboard.writeText(article.link); setCopied(true); setTimeout(() => { setCopied(false); onClose() }, 1500) } catch {}
  }
  const shareToX = (e) => {
    e.stopPropagation()
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${article.title} ${article.link}`)}`, '_blank', 'noopener')
    onClose()
  }
  const shareToWhatsApp = (e) => {
    e.stopPropagation()
    window.open(`https://wa.me/?text=${encodeURIComponent(`${article.title}\n${article.link}`)}`, '_blank', 'noopener')
    onClose()
  }
  return (
    <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-xl shadow-lg z-20 overflow-hidden" onClick={e => e.stopPropagation()}>
      <button onClick={copyLink} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors">
        {copied ? <Check className="w-3.5 h-3.5 text-brand-600" /> : <Link2 className="w-3.5 h-3.5 text-stone-400" />}
        {copied ? 'Copied!' : 'Copy link'}
      </button>
      <button onClick={shareToX} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors border-t border-stone-50 dark:border-stone-700">
        <Twitter className="w-3.5 h-3.5 text-stone-400" />Share to X
      </button>
      <button onClick={shareToWhatsApp} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors border-t border-stone-50 dark:border-stone-700">
        <Share2 className="w-3.5 h-3.5 text-stone-400" />Share to WhatsApp
      </button>
    </div>
  )
}

export default function ArticleCard({ article, onUpdate, selected = false, onSelect = null, selectionMode = false }) {
  const { settings } = useSettings()
  const [bookmarked, setBookmarked] = useState(article.is_bookmarked)
  const [readLater, setReadLater] = useState(article.is_read_later)
  const [read, setRead] = useState(article.is_read)
  const [showShare, setShowShare] = useState(false)
  const [fullText, setFullText] = useState(null)
  const [fullTextLoading, setFullTextLoading] = useState(false)
  const [fullTextFailed, setFullTextFailed] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const displayText = fullText || article.description
  const readingTime = formatReadingTime(estimateReadingTime(
    `${article.title || ''} ${displayText || ''}`
  ))

  const handleOpen = async (e) => {
    e?.stopPropagation()

    // Mark as read
    if (!read) {
      setRead(true)
      await markArticleRead(article.id)
      onUpdate?.({ ...article, is_read: true })
    }

    // Auto-fetch full text and expand inline — open external link in parallel
    if (!fullText && !fullTextFailed && !fullTextLoading) {
      setExpanded(true)
      setFullTextLoading(true)
      fetchFullText(article.link).then(result => {
        if (result?.content) {
          setFullText(result.content)
        } else {
          setFullTextFailed(true)
        }
      }).catch(() => setFullTextFailed(true))
        .finally(() => setFullTextLoading(false))
    } else {
      // Already fetched — toggle expand
      setExpanded(v => !v)
    }
  }

  const handleExternalOpen = (e) => {
    e.stopPropagation()
    if (!read) { setRead(true); markArticleRead(article.id); onUpdate?.({ ...article, is_read: true }) }
    window.open(article.link, '_blank', 'noopener')
  }

  const handleBookmark = async (e) => {
    e.stopPropagation()
    const next = !bookmarked; setBookmarked(next)
    await toggleBookmark(article.id, bookmarked)
    onUpdate?.({ ...article, is_bookmarked: next })
  }

  const handleReadLater = async (e) => {
    e.stopPropagation()
    const next = !readLater; setReadLater(next)
    await toggleReadLater(article.id, readLater)
    onUpdate?.({ ...article, is_read_later: next })
  }

  const handleToggleRead = async (e) => {
    e.stopPropagation()
    const next = !read; setRead(next)
    if (next) { await markArticleRead(article.id) }
    else { await markArticleUnread(article.id) }
    onUpdate?.({ ...article, is_read: next })
  }

  const category = article.category || 'General'
  const colorClass = CATEGORY_COLORS[category] || CATEGORY_COLORS.General

  return (
    <article
      className={`group relative bg-white dark:bg-stone-900 border rounded-xl overflow-hidden transition-all duration-200 ${
        selected ? 'border-brand-400 dark:border-brand-600 ring-1 ring-brand-400 dark:ring-brand-600' :
        read ? 'border-stone-100 dark:border-stone-800 opacity-60' : 'border-stone-200 dark:border-stone-700'
      }`}
    >
      {/* Selection checkbox — shown in selection mode or on hover */}
      {(selectionMode || selected) && (
        <button
          onClick={(e) => { e.stopPropagation(); onSelect?.(article.id) }}
          className={`absolute top-3 left-3 z-10 w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
            selected
              ? 'bg-brand-600 border-brand-600 text-white'
              : 'bg-white dark:bg-stone-800 border-stone-300 dark:border-stone-600 hover:border-brand-400'
          }`}
        >
          {selected && <CheckSquare className="w-3 h-3" />}
        </button>
      )}
      {/* Main card body — clickable to expand */}
      <div className={`p-5 cursor-pointer ${selectionMode ? "pl-10" : ""}`} onClick={selectionMode ? (e) => { e.stopPropagation(); onSelect?.(article.id) } : handleOpen}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Meta row */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colorClass}`}>{category}</span>
              <span className="text-xs text-stone-400 dark:text-stone-500 font-medium">{article.feeds?.title || 'Unknown source'}</span>
              {article.pub_date && (
                <><span className="text-stone-200 dark:text-stone-700 text-xs">·</span>
                <span className="text-xs text-stone-400 dark:text-stone-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />{formatArticleDate(article.pub_date, settings)}
                </span></>
              )}
              {settings.showReadingTime && readingTime && (
                <><span className="text-stone-200 dark:text-stone-700 text-xs">·</span>
                <span className="text-xs text-stone-400 dark:text-stone-500 flex items-center gap-1">
                  <Timer className="w-3 h-3" />{readingTime}
                </span></>
              )}
              {fullTextLoading && (
                <span className="text-xs text-stone-400 dark:text-stone-500 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />fetching...
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className={`text-sm font-semibold leading-snug mb-1.5 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors ${
              read ? 'text-stone-500 dark:text-stone-500' : 'text-stone-900 dark:text-stone-100'
            }`}>
              {article.title}
            </h3>

            {/* Preview (always shown) */}
            {!expanded && article.description && (
              <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                {article.description}{article.description.length >= 278 ? '...' : ''}
              </p>
            )}

            {/* Full text (shown when expanded) */}
            {expanded && (
              <div className="mt-1">
                {fullTextLoading && (
                  <div className="space-y-2 mt-2">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className={`h-3 bg-stone-100 dark:bg-stone-800 rounded animate-pulse ${i === 3 ? 'w-2/3' : 'w-full'}`} />
                    ))}
                  </div>
                )}
                {!fullTextLoading && fullText && (
                  <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed whitespace-pre-line">
                    {fullText}
                  </p>
                )}
                {!fullTextLoading && fullTextFailed && article.description && (
                  <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                    {article.description}{article.description.length >= 278 ? '...' : ''}
                    <span className="block mt-1 text-stone-400 dark:text-stone-600 italic">Full text unavailable — open article to read more.</span>
                  </p>
                )}
              </div>
            )}

            {settings.showAuthor && article.author && <p className="text-xs text-stone-400 dark:text-stone-500 mt-1.5">By {article.author}</p>}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <button onClick={handleBookmark} title="Bookmark"
              className={`p-1.5 rounded-lg transition-colors ${
                bookmarked
                  ? 'text-brand-600 bg-brand-50 dark:bg-brand-900/30'
                  : 'text-stone-300 dark:text-stone-600 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
              }`}>
              {bookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            </button>
            <button onClick={handleReadLater} title="Read later"
              className={`p-1.5 rounded-lg transition-colors ${
                readLater
                  ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/30'
                  : 'text-stone-300 dark:text-stone-600 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
              }`}>
              <BookMarked className="w-4 h-4" />
            </button>
            <div className="relative">
              <button onClick={e => { e.stopPropagation(); setShowShare(v => !v) }} title="Share"
                className="p-1.5 rounded-lg text-stone-300 dark:text-stone-600 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">
                <Share2 className="w-4 h-4" />
              </button>
              {showShare && <ShareMenu article={article} onClose={() => setShowShare(false)} />}
            </div>
            <button onClick={handleToggleRead} title={read ? "Mark unread" : "Mark read"}
              className="p-1.5 rounded-lg text-stone-300 dark:text-stone-600 hover:text-stone-500 dark:hover:text-stone-400 transition-colors">
              {read ? <Mail className="w-3.5 h-3.5" /> : <MailOpen className="w-3.5 h-3.5" />}
            </button>
            <button onClick={handleExternalOpen} title="Open in new tab"
              className="p-1.5 rounded-lg text-stone-300 dark:text-stone-600 hover:text-stone-500 dark:hover:text-stone-400 transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded footer hint */}
      {expanded && !fullTextLoading && (
        <div className="px-5 py-2.5 border-t border-stone-50 dark:border-stone-800 flex items-center justify-between">
          <button onClick={handleOpen} className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
            ↑ Collapse
          </button>
          <button onClick={handleExternalOpen} className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium flex items-center gap-1 transition-colors">
            Read full article <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      )}
    </article>
  )
}
