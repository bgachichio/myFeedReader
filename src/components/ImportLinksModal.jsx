import { useState, useRef, useCallback } from 'react'
import { X, Upload, Link, FileText, CheckCircle2, AlertCircle, Loader2, Download } from 'lucide-react'
import { supabase } from '../lib/supabase'

// ── Helpers ───────────────────────────────────────────────────────

function extractUrls(text) {
  // Match http/https URLs, strip trailing punctuation
  const re = /https?:\/\/[^\s"'<>)\]]+/g
  return [...new Set(
    (text.match(re) || []).map(u => u.replace(/[.,;:!?)]+$/, '').trim())
  )].filter(u => {
    try { new URL(u); return true } catch { return false }
  })
}

function parseCSV(text) {
  // Handles: single column of URLs, or multi-column with url/title headers
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (!lines.length) return []

  const first = lines[0].toLowerCase()
  const hasHeader = first.includes('url') || first.includes('link') || first.includes('http') === false

  const dataLines = hasHeader ? lines.slice(1) : lines
  const results = []

  // Try to detect url + title columns from header
  let urlCol = 0, titleCol = -1
  if (hasHeader) {
    const headers = lines[0].split(',').map(h => h.replace(/["']/g, '').trim().toLowerCase())
    urlCol   = headers.findIndex(h => h === 'url' || h === 'link' || h === 'href')
    titleCol = headers.findIndex(h => h === 'title' || h === 'name' || h === 'description')
    if (urlCol === -1) urlCol = 0
  }

  for (const line of dataLines) {
    // Simple CSV split — handles quoted fields
    const cols = line.split(',').map(c => c.replace(/^["']|["']$/g, '').trim())
    const url = cols[urlCol]?.trim()
    const title = titleCol >= 0 ? cols[titleCol]?.trim() : ''
    if (!url) continue
    // If no column structure, try extracting URL from raw line
    const finalUrl = url.startsWith('http') ? url : extractUrls(url)[0]
    if (!finalUrl) continue
    try { new URL(finalUrl) } catch { continue }
    results.push({ url: finalUrl, title: title || '' })
  }
  return results
}

// ── Save a single URL via the edge function ───────────────────────
async function saveOneUrl(url, title, token, anonKey, supabaseUrl) {
  const res = await fetch(`${supabaseUrl}/functions/v1/save-article`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url, title: title || undefined, source: 'import' }),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Status pill ───────────────────────────────────────────────────
function StatusPill({ status }) {
  if (status === 'pending')  return <span className="text-xs text-stone-400">Queued</span>
  if (status === 'saving')   return <Loader2 className="w-3.5 h-3.5 text-brand-500 animate-spin" />
  if (status === 'done')     return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
  if (status === 'error')    return <AlertCircle  className="w-3.5 h-3.5 text-red-400" />
  return null
}

// ── Sample CSV download ───────────────────────────────────────────
function downloadSampleCSV() {
  const csv = `url,title\nhttps://example.com/article-1,My first article\nhttps://example.com/article-2,Another great read\nhttps://substack.com/some-post,Interesting newsletter\n`
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'import-links-sample.csv'
  a.click()
}

// ── Main Modal ────────────────────────────────────────────────────
export default function ImportLinksModal({ onClose, onImportComplete }) {
  const [tab, setTab]           = useState('text')   // 'text' | 'csv'
  const [textInput, setTextInput] = useState('')
  const [csvFile, setCsvFile]   = useState(null)
  const [csvPreview, setCsvPreview] = useState([])   // parsed [{url, title}]
  const [queue, setQueue]       = useState([])       // [{url, title, status, error}]
  const [running, setRunning]   = useState(false)
  const [done, setDone]         = useState(false)
  const fileInputRef            = useRef(null)

  // ── Parse text input preview ─────────────────────────────────
  const textUrls = extractUrls(textInput)

  // ── Handle CSV file ───────────────────────────────────────────
  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target.result)
      setCsvPreview(parsed)
    }
    reader.readAsText(file)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file || !file.name.endsWith('.csv')) return
    fileInputRef.current.files = e.dataTransfer.files
    handleFileChange({ target: { files: [file] } })
  }, [handleFileChange])

  // ── Build queue from current tab ─────────────────────────────
  const buildQueue = () => {
    if (tab === 'text') {
      return textUrls.map(url => ({ url, title: '', status: 'pending', error: null }))
    } else {
      return csvPreview.map(({ url, title }) => ({ url, title, status: 'pending', error: null }))
    }
  }

  const canStart = tab === 'text'
    ? textUrls.length > 0
    : csvPreview.length > 0

  // ── Run import ────────────────────────────────────────────────
  const handleImport = async () => {
    const initial = buildQueue()
    if (!initial.length) return

    setQueue(initial)
    setRunning(true)
    setDone(false)

    const { data: { session } } = await supabase.auth.getSession()
    const token    = session?.access_token
    const anonKey  = import.meta.env.VITE_SUPABASE_ANON_KEY
    const sbUrl    = import.meta.env.VITE_SUPABASE_URL

    if (!token) {
      setQueue(q => q.map(item => ({ ...item, status: 'error', error: 'Not authenticated' })))
      setRunning(false)
      return
    }

    // Process in batches of 3 — respect edge function concurrency
    const BATCH = 3
    for (let i = 0; i < initial.length; i += BATCH) {
      const batch = initial.slice(i, i + BATCH)

      // Mark batch as saving
      setQueue(q => q.map((item, idx) =>
        idx >= i && idx < i + BATCH ? { ...item, status: 'saving' } : item
      ))

      await Promise.all(batch.map(async (item, batchIdx) => {
        const idx = i + batchIdx
        try {
          await saveOneUrl(item.url, item.title, token, anonKey, sbUrl)
          setQueue(q => q.map((x, j) => j === idx ? { ...x, status: 'done' } : x))
        } catch (err) {
          setQueue(q => q.map((x, j) => j === idx
            ? { ...x, status: 'error', error: err.message } : x))
        }
      }))
    }

    setRunning(false)
    setDone(true)
    onImportComplete?.()
  }

  const successCount = queue.filter(i => i.status === 'done').length
  const errorCount   = queue.filter(i => i.status === 'error').length

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-lg bg-white dark:bg-stone-900 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 dark:border-stone-800 flex-shrink-0">
          <div>
            <h2 className="font-semibold text-stone-900 dark:text-stone-100 text-base">Import links</h2>
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">Add URLs to your Reading List in bulk</p>
          </div>
          <button onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        {!queue.length && (
          <div className="flex gap-1 px-5 pt-4 flex-shrink-0">
            {[
              { id: 'text', label: 'Paste links', icon: Link },
              { id: 'csv',  label: 'Upload CSV',  icon: FileText },
            ].map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  tab === id
                    ? 'bg-brand-600 text-white'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
                }`}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">

          {/* ── PROGRESS VIEW ───────────────────────────────── */}
          {queue.length > 0 && (
            <div className="space-y-3">

              {/* Summary bar */}
              {done && (
                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium ${
                  errorCount === 0
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                }`}>
                  {errorCount === 0
                    ? <><CheckCircle2 className="w-4 h-4" /> {successCount} link{successCount !== 1 ? 's' : ''} saved to your Reading List</>
                    : <><AlertCircle className="w-4 h-4" /> {successCount} saved · {errorCount} failed</>
                  }
                </div>
              )}

              {/* Progress bar */}
              {running && (
                <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-brand-500 rounded-full transition-all duration-300"
                    style={{ width: `${(queue.filter(i => i.status === 'done' || i.status === 'error').length / queue.length) * 100}%` }}
                  />
                </div>
              )}

              {/* Per-item list */}
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {queue.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 py-2 px-3 rounded-lg bg-stone-50 dark:bg-stone-800/50">
                    <div className="mt-0.5 flex-shrink-0">
                      <StatusPill status={item.status} />
                    </div>
                    <div className="flex-1 min-w-0">
                      {item.title && (
                        <p className="text-xs font-medium text-stone-700 dark:text-stone-300 truncate">{item.title}</p>
                      )}
                      <p className="text-xs text-stone-400 dark:text-stone-500 truncate">{item.url}</p>
                      {item.error && (
                        <p className="text-xs text-red-400 mt-0.5">{item.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TEXT INPUT TAB ───────────────────────────────── */}
          {!queue.length && tab === 'text' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                  Paste one or more URLs
                </label>
                <textarea
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  rows={6}
                  placeholder={`https://example.com/article\nhttps://substack.com/post\nhttps://x.com/user/status/123\n\nOne per line, or mixed with other text — we'll extract all valid URLs automatically.`}
                  className="w-full px-3 py-2.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-stone-300 dark:placeholder-stone-600 leading-relaxed resize-none"
                />
              </div>

              {textUrls.length > 0 && (
                <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800/40 rounded-xl px-3 py-2.5">
                  <p className="text-xs font-semibold text-brand-700 dark:text-brand-400">
                    {textUrls.length} URL{textUrls.length !== 1 ? 's' : ''} found
                  </p>
                  <div className="mt-1.5 space-y-0.5 max-h-28 overflow-y-auto">
                    {textUrls.map((url, i) => (
                      <p key={i} className="text-xs text-stone-500 dark:text-stone-400 truncate">{url}</p>
                    ))}
                  </div>
                </div>
              )}

              {textInput.length > 0 && textUrls.length === 0 && (
                <p className="text-xs text-amber-500 dark:text-amber-400">No valid URLs found. Make sure links start with http:// or https://</p>
              )}
            </div>
          )}

          {/* ── CSV TAB ──────────────────────────────────────── */}
          {!queue.length && tab === 'csv' && (
            <div className="space-y-3">
              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  csvFile
                    ? 'border-brand-300 dark:border-brand-700 bg-brand-50 dark:bg-brand-900/20'
                    : 'border-stone-200 dark:border-stone-700 hover:border-brand-300 dark:hover:border-brand-700 hover:bg-stone-50 dark:hover:bg-stone-800/50'
                }`}>
                <Upload className={`w-8 h-8 mx-auto mb-2 ${csvFile ? 'text-brand-500' : 'text-stone-300 dark:text-stone-600'}`} />
                {csvFile ? (
                  <>
                    <p className="text-sm font-medium text-stone-700 dark:text-stone-300">{csvFile.name}</p>
                    <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">Click to replace</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-stone-600 dark:text-stone-400">Drop your CSV here</p>
                    <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">or click to browse</p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* CSV format hint + sample download */}
              <div className="flex items-start justify-between gap-3 px-3 py-2.5 bg-stone-50 dark:bg-stone-800/50 rounded-xl">
                <div>
                  <p className="text-xs font-medium text-stone-600 dark:text-stone-400">Expected format</p>
                  <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5 font-mono">url,title (header optional)</p>
                  <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">Title column is optional — URL-only CSVs work fine.</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); downloadSampleCSV() }}
                  className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 font-medium whitespace-nowrap flex-shrink-0 hover:text-brand-700 transition-colors">
                  <Download className="w-3.5 h-3.5" />Sample CSV
                </button>
              </div>

              {/* Preview */}
              {csvPreview.length > 0 && (
                <div className="border border-stone-100 dark:border-stone-800 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-stone-50 dark:bg-stone-800/50 border-b border-stone-100 dark:border-stone-800">
                    <p className="text-xs font-semibold text-stone-600 dark:text-stone-400">
                      {csvPreview.length} link{csvPreview.length !== 1 ? 's' : ''} ready to import
                    </p>
                  </div>
                  <div className="divide-y divide-stone-50 dark:divide-stone-800 max-h-52 overflow-y-auto">
                    {csvPreview.map((item, i) => (
                      <div key={i} className="px-3 py-2">
                        {item.title && <p className="text-xs font-medium text-stone-700 dark:text-stone-300 truncate">{item.title}</p>}
                        <p className="text-xs text-stone-400 dark:text-stone-500 truncate">{item.url}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-3 flex-shrink-0">
          {done ? (
            <>
              <p className="text-xs text-stone-400 dark:text-stone-500">
                {errorCount > 0 ? `${errorCount} failed — check URLs and try again` : 'All done! Check your Reading List.'}
              </p>
              <button onClick={onClose}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors">
                Done
              </button>
            </>
          ) : running ? (
            <>
              <p className="text-xs text-stone-400 dark:text-stone-500">
                Saving {queue.filter(i => i.status === 'done' || i.status === 'error').length} of {queue.length}…
              </p>
              <div className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Importing…
              </div>
            </>
          ) : (
            <>
              <button onClick={onClose}
                className="px-4 py-2 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!canStart}
                className="flex items-center gap-2 px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors">
                <Upload className="w-4 h-4" />
                Import {canStart ? (tab === 'text' ? textUrls.length : csvPreview.length) : ''} link{(tab === 'text' ? textUrls.length : csvPreview.length) !== 1 ? 's' : ''}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
