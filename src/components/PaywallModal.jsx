import { useState } from 'react'
import { X, Check, Zap, ArrowRight, Loader2, ExternalLink } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const PAYSTACK_PLANS = {
  monthly: { price: '$6',  period: 'month', label: 'Monthly' },
  annual:  { price: '$50', period: 'year',  label: 'Annual', saving: 'Save $22' },
}

const FEATURE_COPY = {
  full_text:  { title: 'Full article reading is Pro',   body: 'Read complete articles inline without leaving myFeedReader.' },
  digest:     { title: 'Daily Digest is Pro',           body: 'Get a curated daily summary of everything important from your feeds.' },
  newsletter: { title: 'Newsletter integration is Pro', body: 'Bring your email newsletters directly into your feed.' },
  folders:    { title: 'Feed organisation is Pro',      body: 'Create folders to organise your sources by topic or project.' },
  export:     { title: 'Export is Pro',                 body: 'Export your feeds as OPML or CSV for backup or migration.' },
  stats:      { title: 'Reading stats are Pro',         body: 'Track your reading habits and see which sources you engage with most.' },
  sources:    { title: "You've reached the free limit", body: 'Free accounts support up to 10 sources. Upgrade for unlimited sources.' },
}

const PRO_BULLETS = [
  'Unlimited RSS sources',
  'Full-text article reading',
  'Daily Digest',
  'Newsletter integration',
  'Folders & organisation',
  'Export (OPML & CSV)',
  'Reading stats & insights',
  '30-day article history',
]

export default function PaywallModal({ feature = 'sources', onClose }) {
  const { user } = useAuth()
  const [billing, setBilling] = useState('annual')
  const [loading, setLoading] = useState(false)

  const copy = FEATURE_COPY[feature] || FEATURE_COPY.sources
  const plan = PAYSTACK_PLANS[billing]

  // Read keys baked in at build time
  const publicKey  = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY  || ''
  const monthlyCode = import.meta.env.VITE_PAYSTACK_PLAN_MONTHLY || ''
  const annualCode  = import.meta.env.VITE_PAYSTACK_PLAN_ANNUAL  || ''
  const planCode    = billing === 'annual' ? annualCode : monthlyCode

  // Paystack is ready when real keys are present
  const paystackReady = (
    publicKey.startsWith('pk_') &&
    !publicKey.includes('PASTE') &&
    planCode.startsWith('PLN_') &&
    !planCode.includes('PASTE')
  )

  const handleUpgrade = () => {
    if (!user?.email || !paystackReady) return
    setLoading(true)

    const ref = `mfr_${user.id.replace(/-/g,'').slice(0,16)}_${Date.now()}`
    const params = new URLSearchParams({
      email:        user.email,
      plan:         planCode,
      callback_url: `${window.location.origin}/dashboard?payment=success`,
      ref,
      metadata:     JSON.stringify({ user_id: user.id, billing_cycle: billing }),
    })
    const slug = billing === 'annual' ? 'myfeedreaderproannual' : 'myfeedreaderpromonthly'
    window.location.href = `https://paystack.shop/pay/${slug}?${params}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="relative bg-gradient-to-br from-brand-600 to-brand-700 px-6 pt-8 pb-10">
          <button onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-4">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">{copy.title}</h2>
          <p className="text-sm text-white/80 leading-relaxed">{copy.body}</p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 -mt-4">

          {/* Pro bullets */}
          <div className="bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-xl p-4 mb-5 shadow-sm">
            <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-3">
              Everything in Pro
            </p>
            <div className="grid grid-cols-1 gap-2">
              {PRO_BULLETS.map(b => (
                <div key={b} className="flex items-center gap-2.5">
                  <div className="w-4 h-4 bg-brand-50 dark:bg-brand-900/40 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-brand-600 dark:text-brand-400" />
                  </div>
                  <span className="text-xs text-stone-700 dark:text-stone-300">{b}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Billing toggle */}
          <div className="flex items-center bg-stone-100 dark:bg-stone-800 rounded-xl p-1 gap-1 mb-4">
            {Object.entries(PAYSTACK_PLANS).map(([key, p]) => (
              <button key={key} onClick={() => setBilling(key)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  billing === key
                    ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm'
                    : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
                }`}>
                <span>{p.label}</span>
                <span className={`text-xs font-bold ${billing === key ? 'text-brand-600 dark:text-brand-400' : 'text-stone-400'}`}>
                  {p.price}/{p.period === 'month' ? 'mo' : 'yr'}
                </span>
                {p.saving && billing === key && (
                  <span className="text-xs bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-400 px-1.5 py-0.5 rounded-full font-semibold">
                    {p.saving}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* CTA */}
          {paystackReady ? (
            <button onClick={handleUpgrade} disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-brand-600/20">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {loading ? 'Redirecting to Paystack...' : `Upgrade to Pro — ${plan.price}/${plan.period === 'month' ? 'mo' : 'yr'}`}
            </button>
          ) : (
            // Paystack keys not yet configured — show email fallback
            <a href="mailto:brian@gachichio.com?subject=myFeedReader Pro upgrade"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-brand-600/20">
              <ExternalLink className="w-4 h-4" />
              Get in touch to upgrade
            </a>
          )}

          <p className="text-xs text-center text-stone-400 dark:text-stone-500 mt-3">
            {paystackReady
              ? 'Secure payment via Paystack · Cancel anytime · Instant access'
              : 'Payment coming soon · Contact us to get early Pro access'}
          </p>
        </div>
      </div>
    </div>
  )
}
