import { useState, useEffect } from 'react'
import { BarChart2, TrendingUp, BookOpen, Bookmark, Clock, Layers } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { usePlan } from '../contexts/PlanContext'
import PaywallModal from '../components/PaywallModal'
import { getStats, getFeeds } from '../lib/feedsService'
import { format, subDays, isAfter, parseISO } from 'date-fns'

const CAT_BAR = { Finance:'bg-emerald-500', Strategy:'bg-brand-500', Technology:'bg-blue-500', Politics:'bg-red-500', Economics:'bg-amber-500', Culture:'bg-purple-500', Health:'bg-teal-500', Science:'bg-cyan-500', General:'bg-stone-400' }

function StatCard({ icon: Icon, label, value, sub, color='text-brand-600', bg='bg-brand-50 dark:bg-brand-900/30' }) {
  return (
    <div className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-xl p-5">
      <div className={`w-10 h-10 ${bg} ${color} rounded-xl flex items-center justify-center mb-3`}><Icon className="w-5 h-5" /></div>
      <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">{value}</p>
      <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">{sub}</p>}
    </div>
  )
}

function Bar({ label, value, max, colorClass }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-stone-500 dark:text-stone-400 w-24 truncate flex-shrink-0">{label}</span>
      <div className="flex-1 bg-stone-100 dark:bg-stone-800 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-stone-600 dark:text-stone-400 w-6 text-right flex-shrink-0">{value}</span>
    </div>
  )
}

export default function StatsView() {
  const { user } = useAuth()
  const { isPro } = usePlan()
  const [showPaywall, setShowPaywall] = useState(false)
  const [stats, setStats] = useState(null)
  const [feeds, setFeeds] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [articles, feedList] = await Promise.all([getStats(user.id), getFeeds(user.id)])
        setStats(articles); setFeeds(feedList)
      } finally { setLoading(false) }
    }
    load()
  }, [user.id])

  if (!isPro) return (
    <>
      <div className="text-center py-24">
        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <BarChart2 className="w-7 h-7 text-blue-500" />
        </div>
        <h3 className="font-semibold text-stone-700 dark:text-stone-300 mb-2">Reading stats are a Pro feature</h3>
        <p className="text-sm text-stone-400 dark:text-stone-500 max-w-xs mx-auto mb-5">
          See your reading habits, streaks, top sources and more.
        </p>
        <button onClick={() => setShowPaywall(true)}
          className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors">
          Upgrade to Pro
        </button>
      </div>
      {showPaywall && <PaywallModal feature="stats" onClose={() => setShowPaywall(false)} />}
    </>
  )
  if (loading) return (
    <div>
      <h1 className="font-display font-bold text-2xl text-stone-900 dark:text-stone-100 mb-6">Stats</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[...Array(4)].map((_, i) => <div key={i} className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-xl p-5 animate-pulse h-28" />)}
      </div>
    </div>
  )
  if (!stats) return null

  const total = stats.length
  const read = stats.filter(a => a.is_read).length
  const unread = total - read
  const bookmarked = stats.filter(a => a.is_bookmarked).length
  const readLater = stats.filter(a => a.is_read_later).length
  const readPct = total > 0 ? Math.round((read / total) * 100) : 0

  const byCategory = {}
  stats.forEach(a => { const cat = a.category || 'General'; byCategory[cat] = (byCategory[cat] || 0) + 1 })
  const sortedCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
  const maxCat = sortedCats[0]?.[1] || 1

  const last7 = []
  for (let i = 6; i >= 0; i--) {
    const day = subDays(new Date(), i)
    const label = format(day, 'EEE')
    const count = stats.filter(a => {
      if (!a.pub_date) return false
      try { return format(parseISO(a.pub_date), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd') } catch { return false }
    }).length
    last7.push({ label, count })
  }
  const maxDay = Math.max(...last7.map(d => d.count), 1)
  const readRecently = stats.filter(a => { if (!a.is_read || !a.pub_date) return false; try { return isAfter(parseISO(a.pub_date), subDays(new Date(), 7)) } catch { return false } }).length

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl text-stone-900 dark:text-stone-100">Stats</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">Your reading habits at a glance</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard icon={Layers} label="Total articles" value={total} sub={`${feeds.length} sources`} color="text-stone-600 dark:text-stone-400" bg="bg-stone-50 dark:bg-stone-800" />
        <StatCard icon={BookOpen} label="Read" value={read} sub={`${readPct}% read rate`} />
        <StatCard icon={TrendingUp} label="Unread" value={unread} sub="waiting for you" color="text-amber-600" bg="bg-amber-50 dark:bg-amber-900/30" />
        <StatCard icon={Bookmark} label="Saved" value={bookmarked + readLater} sub={`${bookmarked} bookmarked · ${readLater} read later`} color="text-purple-600" bg="bg-purple-50 dark:bg-purple-900/30" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <BarChart2 className="w-4 h-4 text-stone-400" />
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Articles per day</h3>
            <span className="text-xs text-stone-400 ml-auto">Last 7 days</span>
          </div>
          <div className="flex items-end gap-2 h-24">
            {last7.map(({ label, count }) => (
              <div key={label} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end justify-center" style={{ height: '72px' }}>
                  <div className="w-full bg-brand-500 rounded-t-sm transition-all duration-500 min-h-[2px]"
                    style={{ height: `${Math.max(2, (count / maxDay) * 72)}px` }} />
                </div>
                <span className="text-xs text-stone-400 dark:text-stone-500">{label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-3">{readRecently} articles read in the last 7 days</p>
        </div>

        <div className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <Clock className="w-4 h-4 text-stone-400" />
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">By category</h3>
          </div>
          {sortedCats.length === 0 ? <p className="text-sm text-stone-400 dark:text-stone-500">No data yet</p> : (
            <div className="space-y-3">
              {sortedCats.slice(0, 8).map(([cat, count]) => (
                <Bar key={cat} label={cat} value={count} max={maxCat} colorClass={CAT_BAR[cat] || 'bg-stone-400'} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Reading progress</h3>
          <span className="text-sm font-bold text-brand-600">{readPct}%</span>
        </div>
        <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-3">
          <div className="bg-brand-500 h-3 rounded-full transition-all duration-700" style={{ width: `${readPct}%` }} />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-stone-400 dark:text-stone-500">{read} read</span>
          <span className="text-xs text-stone-400 dark:text-stone-500">{unread} remaining</span>
        </div>
      </div>
    </div>
  )
}
