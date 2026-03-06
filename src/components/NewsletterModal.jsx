import { useState } from 'react'
import { X, Mail, Rss, Copy, Check, ExternalLink, ChevronRight, Loader2, Sparkles } from 'lucide-react'
import { addFeed } from '../lib/feedsService'
import { useAuth } from '../contexts/AuthContext'

// Popular newsletters with their RSS/Atom feeds where available
const POPULAR_NEWSLETTERS = [
  // Substack — all have /feed
  { name: 'Stratechery',        author: 'Ben Thompson',     type: 'substack', url: 'https://stratechery.com/feed/',                        description: 'Tech strategy' },
  { name: 'The Diff',           author: 'Byrne Hobart',     type: 'substack', url: 'https://diff.substack.com/feed',                       description: 'Finance & tech' },
  { name: 'Not Boring',         author: 'Packy McCormick',  type: 'substack', url: 'https://www.notboring.co/feed',                        description: 'Business strategy' },
  { name: 'Axios Markets',      author: 'Axios',            type: 'rss',      url: 'https://api.axios.com/feed/markets',                   description: 'Markets briefing' },
  { name: 'Morning Brew',       author: 'Morning Brew',     type: 'rss',      url: 'https://feeds.morningbrew.com/morningbrew.rss',         description: 'Daily business news' },
  { name: 'The Hustle',         author: 'HubSpot',          type: 'rss',      url: 'https://thehustle.co/feed/',                           description: 'Business & tech' },
  { name: 'Africa Business',    author: 'African Business', type: 'rss',      url: 'https://african.business/feed',                        description: 'Pan-African business' },
  { name: 'TechCabal Daily',    author: 'TechCabal',        type: 'rss',      url: 'https://techcabal.com/feed/',                          description: 'African tech' },
  { name: 'Quartz Africa',      author: 'Quartz',           type: 'rss',      url: 'https://qz.com/africa/feed',                          description: 'African economy' },
  { name: 'CB Insights',        author: 'CB Insights',      type: 'rss',      url: 'https://www.cbinsights.com/research/feed/',            description: 'VC & startup intel' },
]

// Substack URL → RSS feed URL
function substackToRSS(input) {
  input = input.trim().replace(/\/$/, '')
  // Already a full URL
  if (input.startsWith('http')) {
    const url = new URL(input.includes('//') ? input : `https://${input}`)
    return `${url.origin}/feed`
  }
  // Just "name" or "name.substack.com"
  const slug = input.replace('.substack.com', '')
  return `https://${slug}.substack.com/feed`
}

// Generate a kill-the-newsletter address
function generateKTNAddress() {
  const rand = Math.random().toString(36).slice(2, 10)
  return {
    email: `myfeed-${rand}@kill-the-newsletter.com`,
    feedUrl: `https://kill-the-newsletter.com/feeds/${rand}.xml`,
  }
}

const STEPS = ['method', 'setup', 'done']

export default function NewsletterModal({ onClose, onAdded }) {
  const { user } = useAuth()
  const [step, setStep] = useState('home')  // home | substack | email | popular
  const [substackInput, setSubstackInput] = useState('')
  const [adding, setAdding] = useState({})
  const [added, setAdded] = useState({})
  const [error, setError] = useState('')
  const [ktn] = useState(generateKTNAddress)
  const [ktnStep, setKtnStep] = useState(1)  // 1 = copy email, 2 = subscribe, 3 = add feed
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [copiedFeed, setCopiedFeed] = useState(false)
  const [ktnAdded, setKtnAdded] = useState(false)
  const [ktnAdding, setKtnAdding] = useState(false)
  const [ktnLabel, setKtnLabel] = useState('')

  const handleAddFeed = async (url, title) => {
    if (added[url]) return
    setAdding(prev => ({ ...prev, [url]: true }))
    setError('')
    try {
      await addFeed({ userId: user.id, url, title, category: 'Newsletters' })
      setAdded(prev => ({ ...prev, [url]: true }))
      onAdded?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(prev => ({ ...prev, [url]: false }))
    }
  }

  const handleSubstackAdd = async () => {
    if (!substackInput.trim()) return
    const feedUrl = substackToRSS(substackInput)
    const title = substackInput.replace('https://', '').replace('http://', '').replace('.substack.com', '').replace(/\/$/, '').split('/')[0]
    await handleAddFeed(feedUrl, title.charAt(0).toUpperCase() + title.slice(1))
    if (!error) setSubstackInput('')
  }

  const handleKtnAdd = async () => {
    setKtnAdding(true)
    try {
      const title = ktnLabel.trim() || 'Email Newsletter'
      await addFeed({ userId: user.id, url: ktn.feedUrl, title, category: 'Newsletters' })
      setKtnAdded(true)
      onAdded?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setKtnAdding(false)
    }
  }

  const copy = async (text, setter) => {
    await navigator.clipboard.writeText(text)
    setter(true)
    setTimeout(() => setter(false), 2000)
  }

  // ── Home screen ───────────────────────────────────────────────
  if (step === 'home') return (
    <Modal onClose={onClose} title="Newsletter Integration" subtitle="Bring your email newsletters into myFeedReader">
      <div className="space-y-3 p-5">
        {/* Method cards */}
        {[
          {
            id: 'popular',
            icon: '⭐',
            title: 'Popular newsletters',
            desc: 'Add well-known newsletters with one tap — Morning Brew, Stratechery, TechCabal and more',
            color: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
          },
          {
            id: 'substack',
            icon: '📝',
            title: 'Add a Substack',
            desc: 'Enter any Substack publication name or URL — we find the RSS feed automatically',
            color: 'bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800',
          },
          {
            id: 'email',
            icon: '✉️',
            title: 'Any email newsletter',
            desc: 'Get a unique email address — subscribe with it, and emails appear in your feed',
            color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
          },
        ].map(m => (
          <button key={m.id} onClick={() => setStep(m.id)}
            className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all hover:scale-[1.01] ${m.color}`}>
            <span className="text-2xl">{m.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{m.title}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{m.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-stone-400 flex-shrink-0" />
          </button>
        ))}
      </div>
    </Modal>
  )

  // ── Popular newsletters ───────────────────────────────────────
  if (step === 'popular') return (
    <Modal onClose={onClose} title="Popular Newsletters" subtitle="One tap to add" onBack={() => setStep('home')}>
      <div className="p-5 space-y-2 max-h-[55vh] overflow-y-auto">
        {error && <p className="text-xs text-red-500 dark:text-red-400 mb-2">{error}</p>}
        {POPULAR_NEWSLETTERS.map(nl => (
          <div key={nl.url} className="flex items-center gap-3 p-3 rounded-xl border border-stone-100 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg flex items-center justify-center flex-shrink-0">
              <Mail className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{nl.name}</p>
              <p className="text-xs text-stone-400 dark:text-stone-500">{nl.author} · {nl.description}</p>
            </div>
            <button onClick={() => handleAddFeed(nl.url, nl.name)} disabled={adding[nl.url] || added[nl.url]}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ${
                added[nl.url]
                  ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400'
                  : 'bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50'
              }`}>
              {adding[nl.url] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
               added[nl.url]  ? <Check className="w-3.5 h-3.5" /> :
                                <Rss className="w-3.5 h-3.5" />}
              {added[nl.url] ? 'Added' : 'Add'}
            </button>
          </div>
        ))}
      </div>
    </Modal>
  )

  // ── Substack ─────────────────────────────────────────────────
  if (step === 'substack') return (
    <Modal onClose={onClose} title="Add a Substack" subtitle="Enter the publication name or URL" onBack={() => setStep('home')}>
      <div className="p-5">
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <input
              value={substackInput}
              onChange={e => { setSubstackInput(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleSubstackAdd()}
              placeholder="e.g. stratechery or stratechery.substack.com"
              autoFocus
              className="w-full px-3 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <button onClick={handleSubstackAdd} disabled={!substackInput.trim() || adding[substackToRSS(substackInput)]}
            className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors flex items-center gap-2">
            {adding[substackToRSS(substackInput)] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rss className="w-4 h-4" />}
            Add
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
        {added[substackToRSS(substackInput)] && (
          <div className="flex items-center gap-2 p-3 bg-brand-50 dark:bg-brand-900/20 rounded-xl text-sm text-brand-700 dark:text-brand-400">
            <Check className="w-4 h-4" />Added successfully! Refresh your feed to see articles.
          </div>
        )}
        <div className="mt-4 p-4 bg-stone-50 dark:bg-stone-800/50 rounded-xl">
          <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-2">How it works</p>
          <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
            Every Substack publication has a public RSS feed. We convert your input to the feed URL automatically — no subscription or login required for free publications. Paid content requires a subscription on Substack's side.
          </p>
        </div>
      </div>
    </Modal>
  )

  // ── Email newsletters via Kill-the-Newsletter ─────────────────
  if (step === 'email') return (
    <Modal onClose={onClose} title="Any Email Newsletter" subtitle="Get a unique inbox → RSS bridge" onBack={() => setStep('home')}>
      <div className="p-5">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-5">
          {[1,2,3].map(n => (
            <div key={n} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                ktnStep > n ? 'bg-brand-600 text-white' :
                ktnStep === n ? 'bg-brand-600 text-white' :
                'bg-stone-100 dark:bg-stone-800 text-stone-400'
              }`}>
                {ktnStep > n ? <Check className="w-3 h-3" /> : n}
              </div>
              {n < 3 && <div className={`flex-1 h-0.5 w-8 ${ktnStep > n ? 'bg-brand-600' : 'bg-stone-100 dark:bg-stone-800'}`} />}
            </div>
          ))}
        </div>

        {ktnStep === 1 && (
          <div>
            <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-1">Step 1 — Copy your unique email address</p>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">This is your personal inbox. Any newsletter sent to it will appear in myFeedReader.</p>
            <div className="flex gap-2 mb-4">
              <div className="flex-1 px-3 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs font-mono text-stone-700 dark:text-stone-300 break-all">
                {ktn.email}
              </div>
              <button onClick={() => copy(ktn.email, setCopiedEmail)}
                className="px-3 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl transition-colors flex-shrink-0">
                {copiedEmail ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-400 mb-4">
              💡 Save this email address — you'll need it each time you subscribe to a new newsletter with this bridge.
            </div>
            <button onClick={() => setKtnStep(2)}
              className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors">
              Got it — next step →
            </button>
          </div>
        )}

        {ktnStep === 2 && (
          <div>
            <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-1">Step 2 — Subscribe to your newsletter</p>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">
              Go to the newsletter's website and subscribe using your unique email address above. The newsletter will start delivering to your myFeedReader automatically.
            </p>
            <div className="space-y-2 mb-4">
              {[
                { icon: '1.', text: `Copy the email: ${ktn.email.split('@')[0]}@...` },
                { icon: '2.', text: 'Visit the newsletter website' },
                { icon: '3.', text: 'Subscribe using that email address' },
                { icon: '4.', text: 'Come back here and click Next' },
              ].map(s => (
                <div key={s.text} className="flex gap-3 text-xs text-stone-600 dark:text-stone-300">
                  <span className="font-bold text-brand-600 flex-shrink-0">{s.icon}</span>
                  <span>{s.text}</span>
                </div>
              ))}
            </div>
            <a href="https://kill-the-newsletter.com" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2 mb-3 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 text-xs font-medium rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />View kill-the-newsletter.com
            </a>
            <button onClick={() => setKtnStep(3)}
              className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors">
              I've subscribed — add to myFeedReader →
            </button>
          </div>
        )}

        {ktnStep === 3 && (
          <div>
            <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-1">Step 3 — Name and add your newsletter feed</p>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">Give this inbox a name so you know which newsletter it's for.</p>
            <input
              value={ktnLabel}
              onChange={e => setKtnLabel(e.target.value)}
              placeholder="e.g. Morning Brew, The Hustle..."
              autoFocus
              className="w-full px-3 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 mb-3"
            />
            {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
            {ktnAdded ? (
              <div className="flex items-center gap-2 p-4 bg-brand-50 dark:bg-brand-900/20 rounded-xl">
                <Check className="w-5 h-5 text-brand-600" />
                <div>
                  <p className="text-sm font-semibold text-brand-700 dark:text-brand-400">Newsletter added!</p>
                  <p className="text-xs text-brand-600 dark:text-brand-500 mt-0.5">Emails will appear in your feed within minutes of delivery.</p>
                </div>
              </div>
            ) : (
              <button onClick={handleKtnAdd} disabled={ktnAdding}
                className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {ktnAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rss className="w-4 h-4" />}
                Add to myFeedReader
              </button>
            )}

            <div className="mt-3 p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl">
              <p className="text-xs text-stone-500 dark:text-stone-400 font-medium mb-1">Your feed URL (save this)</p>
              <div className="flex gap-2">
                <p className="text-xs text-stone-400 dark:text-stone-500 font-mono truncate flex-1">{ktn.feedUrl}</p>
                <button onClick={() => copy(ktn.feedUrl, setCopiedFeed)} className="flex-shrink-0 text-stone-400 hover:text-stone-600">
                  {copiedFeed ? <Check className="w-3.5 h-3.5 text-brand-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )

  return null
}

// Shared modal shell
function Modal({ children, onClose, title, subtitle, onBack }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-white dark:bg-stone-900 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button onClick={onBack} className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">
                <ChevronRight className="w-4 h-4 rotate-180" />
              </button>
            )}
            <div>
              <h2 className="font-display font-bold text-lg text-stone-900 dark:text-stone-100">{title}</h2>
              {subtitle && <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
