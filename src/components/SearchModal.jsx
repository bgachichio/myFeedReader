import { useState, useEffect, useRef } from 'react'
import { Search, X, ExternalLink, Clock } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const CAT_COLORS = { Finance:'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', Strategy:'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400', Technology:'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', Politics:'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400', Economics:'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', Culture:'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', Health:'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400', Science:'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400', General:'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400' }

function formatDate(d) { if (!d) return ''; try { return formatDistanceToNow(parseISO(d), { addSuffix: true }) } catch { try { return formatDistanceToNow(new Date(d), { addSuffix: true }) } catch { return '' } } }

export default function SearchModal({ onClose }) {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    setSelectedIdx(0)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim() || query.length < 2) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const { data } = await supabase.from('articles').select('*, feeds(title, category)')
          .eq('user_id', user.id)
          .or(`title.ilike.%${query}%,description.ilike.%${query}%,author.ilike.%${query}%`)
          .order('pub_date', { ascending: false }).limit(20)
        setResults(data || [])
      } finally { setLoading(false) }
    }, 300)
  }, [query, user.id])

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && results[selectedIdx]) { window.open(results[selectedIdx].link, '_blank', 'noopener'); onClose() }
  }

  const highlight = (text, q) => {
    if (!q || !text) return text
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    return text.split(regex).map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 rounded px-0.5">{part}</mark> : part
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-stone-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-stone-100 dark:border-stone-800">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-100 dark:border-stone-800">
          <Search className="w-5 h-5 text-stone-400 flex-shrink-0" />
          <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Search articles, titles, authors..."
            className="flex-1 text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 bg-transparent focus:outline-none" />
          {query && <button onClick={() => setQuery('')} className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 rounded transition-colors"><X className="w-4 h-4" /></button>}
          <button onClick={onClose} className="text-xs text-stone-400 border border-stone-200 dark:border-stone-700 rounded px-2 py-1 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">Esc</button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {loading && <div className="px-5 py-4 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="animate-pulse"><div className="h-4 bg-stone-100 dark:bg-stone-800 rounded w-3/4 mb-1.5" /><div className="h-3 bg-stone-50 dark:bg-stone-800/50 rounded w-full" /></div>)}</div>}
          {!loading && query.length >= 2 && results.length === 0 && <div className="px-5 py-10 text-center text-sm text-stone-400 dark:text-stone-500">No articles found for <strong>"{query}"</strong></div>}
          {!loading && query.length < 2 && <div className="px-5 py-10 text-center text-sm text-stone-400 dark:text-stone-500">Type at least 2 characters to search</div>}
          {!loading && results.length > 0 && (
            <div className="divide-y divide-stone-50 dark:divide-stone-800">
              {results.map((article, idx) => {
                const category = article.category || 'General'
                return (
                  <button key={article.id} onClick={() => { window.open(article.link, '_blank', 'noopener'); onClose() }}
                    className={`w-full text-left px-5 py-4 transition-colors flex items-start gap-3 group ${idx === selectedIdx ? 'bg-stone-50 dark:bg-stone-800' : 'hover:bg-stone-50 dark:hover:bg-stone-800'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CAT_COLORS[category] || CAT_COLORS.General}`}>{category}</span>
                        <span className="text-xs text-stone-400 dark:text-stone-500">{article.feeds?.title}</span>
                        {article.pub_date && <span className="text-xs text-stone-400 dark:text-stone-500 flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(article.pub_date)}</span>}
                      </div>
                      <p className="text-sm font-medium text-stone-900 dark:text-stone-100 leading-snug group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors">{highlight(article.title, query)}</p>
                      {article.description && <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 line-clamp-1">{highlight(article.description, query)}</p>}
                    </div>
                    <ExternalLink className="w-4 h-4 text-stone-300 dark:text-stone-600 group-hover:text-stone-500 dark:group-hover:text-stone-400 transition-colors flex-shrink-0 mt-0.5" />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-2.5 border-t border-stone-50 dark:border-stone-800 flex items-center gap-4 text-xs text-stone-400 dark:text-stone-500">
          <span><kbd className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-800 rounded text-stone-500 dark:text-stone-400 font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-800 rounded text-stone-500 dark:text-stone-400 font-mono">↵</kbd> open</span>
          <span><kbd className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-800 rounded text-stone-500 dark:text-stone-400 font-mono">Esc</kbd> close</span>
          <span className="ml-auto">Press <kbd className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-800 rounded text-stone-500 dark:text-stone-400 font-mono">/</kbd> anywhere to search</span>
        </div>
      </div>
    </div>
  )
}
