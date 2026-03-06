import { useState, useRef } from 'react'
import { X, Upload, AlertCircle, CheckCircle2, Loader2, FileText } from 'lucide-react'
import { parseOPML } from '../lib/opml'
import { addFeedsBulk, upsertArticles, getFeeds } from '../lib/feedsService'
import { fetchRSSFeed } from '../lib/rssParser'
import { useAuth } from '../contexts/AuthContext'

const DEFAULT_CATEGORIES = ['Finance', 'Strategy', 'Technology', 'Politics', 'Economics', 'Culture', 'Health', 'Science', 'General']
const CONCURRENCY = 8

async function runWithConcurrency(tasks, limit, onProgress) {
  let index = 0
  let completed = 0
  const results = new Array(tasks.length)

  async function runNext() {
    if (index >= tasks.length) return
    const i = index++
    results[i] = await tasks[i]()
    completed++
    onProgress(completed)
    await runNext()
  }

  await Promise.all(Array(Math.min(limit, tasks.length)).fill(null).map(runNext))
  return results
}

export default function ImportOPMLModal({ onClose, onImported }) {
  const { user } = useAuth()
  const fileInputRef = useRef(null)
  const [step, setStep] = useState('upload')
  const [parsedFeeds, setParsedFeeds] = useState([])
  const [feedCategories, setFeedCategories] = useState({})
  const [allCategories, setAllCategories] = useState(DEFAULT_CATEGORIES)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [results, setResults] = useState({ succeeded: 0, failed: 0 })
  const [existingUrls, setExistingUrls] = useState(new Set())

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setError('')
    try {
      const text = await file.text()
      const feeds = parseOPML(text)
      const existing = await getFeeds(user.id)
      const existingSet = new Set(existing.map(f => f.url))
      setExistingUrls(existingSet)
      const existingCats = existing.map(f => f.category).filter(Boolean)
      setAllCategories([...new Set([...DEFAULT_CATEGORIES, ...existingCats])])
      const cats = {}
      feeds.forEach(f => { cats[f.url] = DEFAULT_CATEGORIES.includes(f.category) ? f.category : 'General' })
      setParsedFeeds(feeds)
      setFeedCategories(cats)
      setStep('preview')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleCategoryChange = (url, cat) => setFeedCategories(prev => ({ ...prev, [url]: cat }))
  const handleBulkCategory = (cat) => {
    const updated = {}
    parsedFeeds.forEach(f => { updated[f.url] = cat })
    setFeedCategories(updated)
  }

  const newFeeds = parsedFeeds.filter(f => !existingUrls.has(f.url))
  const duplicates = parsedFeeds.filter(f => existingUrls.has(f.url))

  const handleImport = async () => {
    setStep('importing')
    setProgress({ done: 0, total: newFeeds.length })

    // ── Step 1: Bulk-insert ALL feeds in one DB call ──────────────
    const feedRows = newFeeds.map(f => ({
      user_id: user.id,
      url: f.url,
      title: f.title,
      category: feedCategories[f.url] || 'General',
      feed_type: 'rss',
    }))

    let savedFeeds = []
    try {
      savedFeeds = await addFeedsBulk(feedRows)
    } catch (err) {
      setError('Failed to save feeds: ' + err.message)
      setStep('preview')
      return
    }

    // Build a map from url → saved feed ID
    const feedIdByUrl = {}
    savedFeeds.forEach(f => { feedIdByUrl[f.url] = f.id })

    // ── Step 2: Fetch all RSS feeds in parallel (CONCURRENCY at a time) ──
    let succeeded = 0
    let failed = 0
    const allArticleRows = []

    const tasks = newFeeds.map(feed => async () => {
      const category = feedCategories[feed.url] || 'General'
      const feedId = feedIdByUrl[feed.url]
      if (!feedId) { failed++; return }

      try {
        const { items } = await fetchRSSFeed(feed.url)
        items.slice(0, 10).forEach(item => {
          allArticleRows.push({
            user_id: user.id,
            feed_id: feedId,
            guid: item.guid,
            title: item.title,
            link: item.link,
            description: item.description,
            author: item.author,
            pub_date: item.pubDate ? new Date(item.pubDate).toISOString() : null,
            category,
          })
        })
        succeeded++
      } catch {
        // Non-fatal — feed is saved, articles just won't pre-populate
        succeeded++ // still counts as a successful import
      }
    })

    await runWithConcurrency(tasks, CONCURRENCY, (done) => {
      setProgress({ done, total: newFeeds.length })
    })

    // ── Step 3: Upsert ALL articles in one batch ──────────────────
    if (allArticleRows.length) {
      try {
        await upsertArticles(allArticleRows)
      } catch {
        // Non-fatal
      }
    }

    setResults({ succeeded: savedFeeds.length, failed })
    setStep('done')
    onImported()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={step === 'importing' ? undefined : onClose} />
      <div className="relative bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-2xl shadow-2xl w-full max-w-lg">

        <div className="flex items-center justify-between px-8 pt-8 pb-4 border-b border-stone-50 dark:border-stone-800">
          <div>
            <h2 className="font-display font-bold text-2xl text-stone-900 dark:text-stone-100">Import OPML</h2>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
              {step === 'upload' && 'Upload an OPML file to bulk-import your feeds.'}
              {step === 'preview' && `${parsedFeeds.length} feeds found — review before importing.`}
              {step === 'importing' && `Fetching articles... ${progress.done} of ${progress.total}`}
              {step === 'done' && 'Import complete.'}
            </p>
          </div>
          {step !== 'importing' && (
            <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="px-8 pb-8">

          {/* Upload */}
          {step === 'upload' && (
            <div className="pt-6">
              <div onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-xl p-10 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 dark:hover:bg-brand-900/10 transition-all group">
                <div className="w-12 h-12 bg-stone-50 dark:bg-stone-800 group-hover:bg-brand-50 dark:group-hover:bg-brand-900/30 rounded-xl flex items-center justify-center mx-auto mb-3 transition-colors">
                  <Upload className="w-5 h-5 text-stone-400 group-hover:text-brand-600 transition-colors" />
                </div>
                <p className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Click to upload OPML file</p>
                <p className="text-xs text-stone-400 dark:text-stone-500">.opml or .xml files supported</p>
              </div>
              <input ref={fileInputRef} type="file" accept=".opml,.xml" onChange={handleFileChange} className="hidden" />
              {error && (
                <div className="flex items-start gap-2 mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}
                </div>
              )}
            </div>
          )}

          {/* Preview */}
          {step === 'preview' && (
            <div className="pt-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 p-3 bg-brand-50 dark:bg-brand-900/30 rounded-lg text-center">
                  <p className="text-lg font-bold text-brand-700 dark:text-brand-400">{newFeeds.length}</p>
                  <p className="text-xs text-brand-600 dark:text-brand-400">new feeds</p>
                </div>
                {duplicates.length > 0 && (
                  <div className="flex-1 p-3 bg-stone-50 dark:bg-stone-800 rounded-lg text-center">
                    <p className="text-lg font-bold text-stone-500 dark:text-stone-400">{duplicates.length}</p>
                    <p className="text-xs text-stone-400 dark:text-stone-500">already added</p>
                  </div>
                )}
              </div>

              {newFeeds.length === 0 ? (
                <div className="text-center py-8 text-stone-500 dark:text-stone-400 text-sm">
                  All feeds in this file are already in your sources.
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="text-xs text-stone-500 dark:text-stone-400">Set all to:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {allCategories.map(cat => (
                        <button key={cat} type="button" onClick={() => handleBulkCategory(cat)}
                          className="px-2.5 py-1 rounded-full text-xs border border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:border-brand-400 hover:text-brand-600 transition-colors">
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 mb-4">
                    {newFeeds.map(feed => (
                      <div key={feed.url} className="flex items-center gap-3 p-2.5 bg-stone-50 dark:bg-stone-800 rounded-lg">
                        <FileText className="w-4 h-4 text-stone-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-stone-700 dark:text-stone-300 truncate">{feed.title}</p>
                          <p className="text-xs text-stone-400 dark:text-stone-500 truncate">{feed.url}</p>
                        </div>
                        <select value={feedCategories[feed.url] || 'General'} onChange={e => handleCategoryChange(feed.url, e.target.value)}
                          className="text-xs border border-stone-200 dark:border-stone-700 rounded-md px-2 py-1 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 focus:outline-none focus:ring-1 focus:ring-brand-500 flex-shrink-0">
                          {allCategories.map(c => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                  <button onClick={handleImport}
                    className="w-full py-2.5 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition-colors text-sm">
                    Import {newFeeds.length} feed{newFeeds.length !== 1 ? 's' : ''}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Importing */}
          {step === 'importing' && (
            <div className="py-8 text-center">
              <div className="relative w-14 h-14 mx-auto mb-5">
                <Loader2 className="w-14 h-14 animate-spin text-brand-200 dark:text-brand-900/60" />
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-brand-600 dark:text-brand-400">
                  {progress.done}/{progress.total}
                </span>
              </div>
              <p className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Fetching articles...</p>
              <p className="text-xs text-stone-400 dark:text-stone-500 mb-4">Feeds already saved — getting latest articles now</p>
              <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-2 mb-2">
                <div className="bg-brand-600 h-2 rounded-full transition-all duration-200"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
              </div>
              <p className="text-xs text-stone-400 dark:text-stone-500">{progress.total - progress.done} remaining</p>
            </div>
          )}

          {/* Done */}
          {step === 'done' && (
            <div className="py-6 text-center">
              <div className="w-14 h-14 bg-brand-50 dark:bg-brand-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-brand-600" />
              </div>
              <p className="font-semibold text-stone-900 dark:text-stone-100 mb-1">Import complete!</p>
              <p className="text-sm text-stone-500 dark:text-stone-400 mb-1">
                {results.succeeded} feed{results.succeeded !== 1 ? 's' : ''} imported successfully.
              </p>
              {results.failed > 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-400">{results.failed} had issues fetching articles.</p>
              )}
              <button onClick={onClose}
                className="mt-6 px-6 py-2.5 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition-colors text-sm">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
