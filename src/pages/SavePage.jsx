import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Logo from '../components/Logo'
import { CheckCircle2, AlertCircle, ArrowRight, LogIn } from 'lucide-react'

// Extract first valid http/https URL from a string
function extractUrl(str) {
  if (!str) return ''
  const m = str.match(/https?:\/\/[^\s"'<>]+/)
  return m ? m[0].replace(/[.)]+$/, '') : ''  // strip trailing punctuation
}

// Get a fresh session token, retrying up to 3x with backoff
// Needed because on Android cold PWA start, localStorage isn't loaded yet
async function getFreshToken(maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) return session.access_token
    if (i < maxRetries - 1) {
      await new Promise(r => setTimeout(r, 600 * (i + 1)))  // 600ms, 1200ms
    }
  }
  return null
}

export default function SavePage() {
  const { user, loading: authLoading } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [phase, setPhase] = useState('idle')
  const [savedTitle, setSavedTitle] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [enriched, setEnriched] = useState(false)
  const didSave = useRef(false)

  // Extract and resolve URL from share params
  // Android Chrome can pass: url param, text param with embedded URL, or both
  const rawUrl   = searchParams.get('url')   || ''
  const rawTitle = searchParams.get('title') || ''
  const rawText  = searchParams.get('text')  || ''

  // Priority: explicit url param → URL found in text → URL found in rawUrl string
  const resolvedUrl = (
    (rawUrl.startsWith('http') ? rawUrl : '') ||
    extractUrl(rawText) ||
    extractUrl(rawUrl)
  ).trim()

  const domain = (() => {
    try { return new URL(resolvedUrl).hostname.replace('www.', '') }
    catch { return '' }
  })()

  const doSave = useCallback(async () => {
    if (didSave.current) return  // prevent double-fire
    didSave.current = true

    if (!resolvedUrl) { setPhase('no-url'); return }

    setPhase('saving')
    setErrorMsg('')

    // KEY FIX: Retry getting session token — on Android cold start it's often not
    // ready immediately when the PWA opens from the share sheet
    const token = await getFreshToken(3)
    if (!token) {
      setPhase('auth-needed')
      return
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

    // 10s timeout — edge function cold start can take 2-3s, enrichment up to 5s
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/save-article`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url:    resolvedUrl,
          title:  rawTitle || undefined,
          text:   rawText  || undefined,
          source: 'share_target',
        }),
        signal: controller.signal,
      })

      clearTimeout(timer)

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(errBody.error || `Server error ${res.status}`)
      }

      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Save failed')

      setSavedTitle(data.title || resolvedUrl)
      setEnriched(data.enriched === true)
      setPhase('done')

      // Auto-navigate to Saved after 2.5s
      setTimeout(() => navigate('/dashboard/saved'), 2500)

    } catch (err) {
      clearTimeout(timer)
      if (err.name === 'AbortError') {
        // Timeout — article *may* have been saved in Phase 1
        setErrorMsg("Took too long, but your article may still be saved. Check the Saved tab.")
      } else if (err.message?.includes('Unauthorized')) {
        setPhase('auth-needed')
        return
      } else {
        setErrorMsg(err.message || 'Something went wrong. Please try again.')
      }
      setPhase('error')
    }
  }, [resolvedUrl, rawTitle, rawText, navigate])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      // Don't assume auth-needed immediately — token might still be loading from storage
      // getFreshToken inside doSave() will handle the retry
      if (!resolvedUrl) { setPhase('no-url'); return }
    }
    doSave()
  }, [authLoading])  // Only run once when auth finishes loading

  return (
    <div className="min-h-screen bg-[#fafaf9] dark:bg-stone-950 flex flex-col items-center justify-center p-6">
      <div className="mb-8">
        <Logo size="md" />
      </div>

      <div className="w-full max-w-sm bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm p-6 text-center">

        {/* SAVING / IDLE */}
        {(phase === 'idle' || phase === 'saving') && (
          <div>
            <div className="w-14 h-14 mx-auto mb-4 relative">
              <div className="w-14 h-14 rounded-full border-4 border-brand-100 dark:border-brand-900/40 border-t-brand-600 animate-spin" />
            </div>
            <p className="font-semibold text-stone-800 dark:text-stone-200 mb-1">
              {phase === 'idle' ? 'Preparing…' : 'Saving article…'}
            </p>
            {domain && (
              <p className="text-sm text-stone-400 dark:text-stone-500 truncate">{domain}</p>
            )}
          </div>
        )}

        {/* DONE */}
        {phase === 'done' && (
          <div>
            <div className="w-14 h-14 bg-brand-50 dark:bg-brand-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-brand-600 dark:text-brand-400" />
            </div>
            <p className="font-semibold text-stone-800 dark:text-stone-200 mb-2">Saved!</p>
            {savedTitle && savedTitle !== resolvedUrl && (
              <p className="text-sm text-stone-500 dark:text-stone-400 mb-2 line-clamp-2 leading-snug px-2">
                {savedTitle}
              </p>
            )}
            <p className="text-xs text-stone-400 dark:text-stone-500 mb-4">
              {enriched
                ? '✓ Full article saved for offline reading'
                : 'Link saved — open article to read'}
            </p>
            <button
              onClick={() => navigate('/dashboard/saved')}
              className="flex items-center gap-1.5 mx-auto text-sm text-brand-600 dark:text-brand-400 font-medium"
            >
              Go to Saved <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ERROR */}
        {phase === 'error' && (
          <div>
            <div className="w-14 h-14 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7 text-amber-500" />
            </div>
            <p className="font-semibold text-stone-800 dark:text-stone-200 mb-2">Problem saving</p>
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-4 leading-snug">
              {errorMsg}
            </p>
            <div className="space-y-2">
              <button
                onClick={() => { didSave.current = false; doSave() }}
                className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Try again
              </button>
              <Link
                to="/dashboard/saved"
                className="block w-full py-2.5 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 text-sm font-medium rounded-xl"
              >
                Check Saved anyway
              </Link>
            </div>
          </div>
        )}

        {/* NO URL */}
        {phase === 'no-url' && (
          <div>
            <div className="w-14 h-14 bg-stone-50 dark:bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7 text-stone-400" />
            </div>
            <p className="font-semibold text-stone-800 dark:text-stone-200 mb-2">No link found</p>
            <p className="text-sm text-stone-400 dark:text-stone-500 mb-4">
              Share a link from your browser or an app to save it here.
            </p>
            <Link
              to="/dashboard"
              className="block w-full py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-xl"
            >
              Go to my Feed
            </Link>
          </div>
        )}

        {/* AUTH NEEDED */}
        {phase === 'auth-needed' && (
          <div>
            <div className="w-14 h-14 bg-stone-50 dark:bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogIn className="w-7 h-7 text-stone-500" />
            </div>
            <p className="font-semibold text-stone-800 dark:text-stone-200 mb-2">Sign in to save</p>
            <p className="text-sm text-stone-400 dark:text-stone-500 mb-4">
              Open myFeedReader, sign in, then try sharing again.
            </p>
            <Link
              to="/"
              className="block w-full py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-xl"
            >
              Sign in
            </Link>
          </div>
        )}
      </div>

      {/* URL shown at bottom for transparency */}
      {resolvedUrl && phase !== 'auth-needed' && phase !== 'no-url' && (
        <p className="mt-4 text-xs text-stone-300 dark:text-stone-700 max-w-sm truncate text-center px-4">
          {resolvedUrl}
        </p>
      )}
    </div>
  )
}
