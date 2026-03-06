import Logo from '../components/Logo'
import { Rss, Globe, Twitter, BookOpen, Newspaper, ArrowRight, Zap, Filter, Bell, LayoutGrid } from 'lucide-react'

const sources = [
  { icon: <Globe className="w-4 h-4" />, label: 'Blogs & Websites', color: 'bg-blue-50 text-blue-600' },
  { icon: <Twitter className="w-4 h-4" />, label: 'X / Twitter feeds', color: 'bg-sky-50 text-sky-600' },
  { icon: <BookOpen className="w-4 h-4" />, label: 'Substack newsletters', color: 'bg-orange-50 text-orange-600' },
  { icon: <Newspaper className="w-4 h-4" />, label: 'RSS feeds', color: 'bg-brand-50 text-brand-600' },
]

const features = [
  {
    icon: <Zap className="w-5 h-5" />,
    title: 'Real-time aggregation',
    description: 'All your sources update automatically. No more tab-switching to stay current.',
    color: 'bg-amber-50 text-amber-600',
  },
  {
    icon: <Filter className="w-5 h-5" />,
    title: 'Smart filtering',
    description: 'Tag and categorize feeds. Filter by topic, source, or recency — your feed, your rules.',
    color: 'bg-purple-50 text-purple-600',
  },
  {
    icon: <Bell className="w-5 h-5" />,
    title: 'Digest mode',
    description: 'Get a daily or weekly summary of what matters from all your feeds in one view.',
    color: 'bg-brand-50 text-brand-600',
  },
  {
    icon: <LayoutGrid className="w-5 h-5" />,
    title: 'Custom layout',
    description: 'Card view, list view, magazine layout — choose how you like to read.',
    color: 'bg-rose-50 text-rose-600',
  },
]

const steps = [
  { n: '01', title: 'Add your sources', desc: 'Paste any RSS feed URL, blog, newsletter, or X handle.' },
  { n: '02', title: 'Organise & tag', desc: 'Group by topic: Finance, Tech, Strategy, Culture — whatever you need.' },
  { n: '03', title: 'Read, not search', desc: 'Open myFeedReader and everything important is already there, in order.' },
]

const sampleItems = [
  { source: 'FT', category: 'Finance', title: 'African fintech sees record inflows as regional payments consolidate', time: '2h ago', color: 'bg-pink-50 text-pink-600' },
  { source: 'SB', category: 'Strategy', title: 'Why most corporate strategy is theatre — and what real strategy looks like', time: '4h ago', color: 'bg-brand-50 text-brand-600' },
  { source: 'X', category: 'Macro', title: 'Thread: The structural case for African fixed income in 2026', time: '6h ago', color: 'bg-sky-50 text-sky-600' },
]

export default function LandingPage({ onOpenAuth }) {
  return (
    <main>
      {/* Hero */}
      <section className="pt-32 pb-24 px-5 max-w-6xl mx-auto">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-50 text-brand-700 rounded-full text-xs font-medium mb-6">
            <Rss className="w-3 h-3" />
            Your personal intelligence feed
          </div>

          <h1 className="font-display font-bold text-5xl md:text-6xl lg:text-7xl text-stone-900 leading-tight mb-6">
            Everything you
            <br />
            <span className="text-brand-600 italic">need to know,</span>
            <br />
            in one place.
          </h1>

          <p className="text-lg text-stone-500 max-w-xl mb-10 leading-relaxed">
            myFeedReader aggregates newsletters, blogs, X feeds, and RSS sources into a single, 
            beautifully organised feed. Less noise. More signal.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => onOpenAuth('signup')}
              className="px-6 py-3 bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-700 transition-all flex items-center justify-center gap-2 group shadow-lg shadow-brand-600/20"
            >
              Start for free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={() => onOpenAuth('signin')}
              className="px-6 py-3 bg-white text-stone-700 font-medium rounded-xl border border-stone-200 hover:border-stone-300 hover:bg-stone-50 transition-all flex items-center justify-center gap-2"
            >
              Sign in
            </button>
          </div>

          {/* Source chips */}
          <div className="flex flex-wrap gap-2 mt-10">
            {sources.map(s => (
              <div key={s.label} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${s.color}`}>
                {s.icon}
                {s.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Preview card section */}
      <section className="py-16 bg-stone-50 border-y border-stone-100">
        <div className="max-w-6xl mx-auto px-5">
          <p className="text-xs font-medium text-stone-400 uppercase tracking-widest mb-6">What your feed looks like</p>
          <div className="grid gap-3 max-w-2xl">
            {sampleItems.map((item, i) => (
              <div key={i} className="bg-white rounded-xl border border-stone-100 p-4 flex items-start gap-4 hover:shadow-sm transition-shadow">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${item.color}`}>
                  {item.source}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-stone-400 font-medium">{item.category}</span>
                    <span className="text-xs text-stone-300">·</span>
                    <span className="text-xs text-stone-400">{item.time}</span>
                  </div>
                  <p className="text-sm font-medium text-stone-800 leading-snug">{item.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="mb-14">
            <h2 className="font-display font-bold text-3xl md:text-4xl text-stone-900 mb-3">
              Built for serious readers.
            </h2>
            <p className="text-stone-500 max-w-lg">
              For analysts, investors, founders and strategists who need a structured flow of intelligence every day.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f, i) => (
              <div key={i} className="bg-white border border-stone-100 rounded-xl p-5 hover:shadow-sm transition-shadow">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                  {f.icon}
                </div>
                <h3 className="font-semibold text-stone-900 mb-2 text-sm">{f.title}</h3>
                <p className="text-xs text-stone-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 px-5 bg-stone-50 border-t border-stone-100">
        <div className="max-w-6xl mx-auto">
          <div className="mb-14">
            <h2 className="font-display font-bold text-3xl md:text-4xl text-stone-900 mb-3">
              Three steps to clarity.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <div key={i} className="relative">
                <div className="font-display text-6xl font-bold text-brand-100 mb-3 leading-none">{s.n}</div>
                <h3 className="font-semibold text-stone-900 mb-2">{s.title}</h3>
                <p className="text-sm text-stone-500 leading-relaxed">{s.desc}</p>
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 right-0 translate-x-1/2 text-stone-200">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-5">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display font-bold text-3xl md:text-4xl text-stone-900 mb-4">
            Ready to cut the noise?
          </h2>
          <p className="text-stone-500 mb-8">
            Free to start. Bring all your sources together in minutes.
          </p>
          <button
            onClick={() => onOpenAuth('signup')}
            className="px-8 py-3.5 bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-700 transition-all inline-flex items-center gap-2 group shadow-lg shadow-brand-600/20"
          >
            Create your free feed
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-100 py-8 px-5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo size="sm" />
          <p className="text-xs text-stone-400">© 2026 myFeedReader. All rights reserved.</p>
        </div>
      </footer>
    </main>
  )
}
