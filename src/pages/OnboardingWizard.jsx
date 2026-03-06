import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Type, Clock, ArrowRight, Check } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { FONTS, DATE_FORMATS, TIME_FORMATS, TIMEZONES } from '../contexts/SettingsContext'
import { supabase } from '../lib/supabase'

const STEPS = [
  { id: 'welcome',     icon: BookOpen, label: 'Welcome'     },
  { id: 'reading',     icon: Type,     label: 'Reading'     },
  { id: 'datetime',    icon: Clock,    label: 'Date & Time' },
]

// ── Step 1: Name + Display name ───────────────────────────────────
function StepWelcome({ data, onChange }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display font-bold text-2xl text-stone-900 dark:text-stone-100 mb-1">
          Welcome to myFeedReader 👋
        </h2>
        <p className="text-stone-500 dark:text-stone-400 text-sm">
          Let's get your feed set up. This takes about 60 seconds.
        </p>
      </div>

      <div className="space-y-4 pt-2">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
              First name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={data.firstName}
              onChange={e => onChange({ firstName: e.target.value })}
              placeholder="Brian"
              autoFocus
              required
              className="w-full px-3 py-2.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-stone-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
              Last name
            </label>
            <input
              type="text"
              value={data.lastName}
              onChange={e => onChange({ lastName: e.target.value })}
              placeholder="Gachichio"
              className="w-full px-3 py-2.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-stone-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
            Display name
            <span className="ml-1 font-normal text-stone-400">(shown in the app)</span>
          </label>
          <input
            type="text"
            value={data.displayName}
            onChange={e => onChange({ displayName: e.target.value })}
            placeholder="Brian"
            className="w-full px-3 py-2.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-stone-400"
          />
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
            Leave blank to use your first name.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Step 2: Font + reading preferences ───────────────────────────
function StepReading({ data, onChange }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display font-bold text-2xl text-stone-900 dark:text-stone-100 mb-1">
          Reading preferences
        </h2>
        <p className="text-stone-500 dark:text-stone-400 text-sm">
          Choose how articles look. You can change these any time in Settings.
        </p>
      </div>

      {/* Font picker */}
      <div>
        <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-2">Font</label>
        <div className="space-y-2">
          {FONTS.map(font => (
            <button
              key={font.id}
              onClick={() => onChange({ fontId: font.id })}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left ${
                data.fontId === font.id
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
                  : 'border-stone-100 dark:border-stone-700 hover:border-stone-200 dark:hover:border-stone-600 bg-white dark:bg-stone-800'
              }`}
            >
              <div>
                <p className="text-sm font-medium text-stone-900 dark:text-stone-100" style={{ fontFamily: font.stack }}>
                  {font.label}
                </p>
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5" style={{ fontFamily: font.stack }}>
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>
              {data.fontId === font.id && (
                <Check className="w-4 h-4 text-brand-600 dark:text-brand-400 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Compact mode */}
      <div className="flex items-center justify-between p-4 bg-stone-50 dark:bg-stone-800 rounded-xl">
        <div>
          <p className="text-sm font-medium text-stone-900 dark:text-stone-100">Compact mode</p>
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">Show more articles on screen at once</p>
        </div>
        <button
          onClick={() => onChange({ compactMode: !data.compactMode })}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            data.compactMode ? 'bg-brand-600' : 'bg-stone-200 dark:bg-stone-700'
          }`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            data.compactMode ? 'translate-x-5' : 'translate-x-0'
          }`} />
        </button>
      </div>

      {/* Show reading time */}
      <div className="flex items-center justify-between p-4 bg-stone-50 dark:bg-stone-800 rounded-xl">
        <div>
          <p className="text-sm font-medium text-stone-900 dark:text-stone-100">Show reading time</p>
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">Estimated minutes per article</p>
        </div>
        <button
          onClick={() => onChange({ showReadingTime: !data.showReadingTime })}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            data.showReadingTime ? 'bg-brand-600' : 'bg-stone-200 dark:bg-stone-700'
          }`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            data.showReadingTime ? 'translate-x-5' : 'translate-x-0'
          }`} />
        </button>
      </div>
    </div>
  )
}

// ── Step 3: Timezone + date/time format ───────────────────────────
function StepDateTime({ data, onChange }) {
  const [tzSearch, setTzSearch] = useState('')
  const filtered = tzSearch
    ? TIMEZONES.filter(tz => tz.toLowerCase().includes(tzSearch.toLowerCase())).slice(0, 8)
    : []

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display font-bold text-2xl text-stone-900 dark:text-stone-100 mb-1">
          Date & time
        </h2>
        <p className="text-stone-500 dark:text-stone-400 text-sm">
          We've detected your timezone. Adjust if needed.
        </p>
      </div>

      {/* Timezone */}
      <div>
        <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">Timezone</label>
        <div className="p-3 bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800/40 rounded-lg mb-2">
          <p className="text-sm font-medium text-brand-700 dark:text-brand-400">{data.timezone}</p>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">Auto-detected</p>
        </div>
        <input
          type="text"
          value={tzSearch}
          onChange={e => setTzSearch(e.target.value)}
          placeholder="Search timezone (e.g. Nairobi, London)..."
          className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-stone-400"
        />
        {filtered.length > 0 && (
          <div className="mt-1 border border-stone-100 dark:border-stone-700 rounded-lg overflow-hidden">
            {filtered.map(tz => (
              <button key={tz} onClick={() => { onChange({ timezone: tz }); setTzSearch('') }}
                className="w-full text-left px-3 py-2 text-sm text-stone-700 dark:text-stone-300 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors border-b border-stone-50 dark:border-stone-800 last:border-0">
                {tz}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Date format */}
      <div>
        <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-2">Date format</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {DATE_FORMATS.map(f => (
            <button key={f.id} onClick={() => onChange({ dateFormat: f.id })}
              className={`px-3 py-2.5 rounded-lg border-2 text-left transition-all ${
                data.dateFormat === f.id
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
                  : 'border-stone-100 dark:border-stone-700 bg-white dark:bg-stone-800 hover:border-stone-200 dark:hover:border-stone-600'
              }`}>
              <p className="text-xs font-medium text-stone-900 dark:text-stone-100">{f.label}</p>
              <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">{f.example}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Time format */}
      <div>
        <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-2">Time format</label>
        <div className="grid grid-cols-2 gap-2">
          {TIME_FORMATS.map(f => (
            <button key={f.id} onClick={() => onChange({ timeFormat: f.id })}
              className={`px-3 py-2.5 rounded-lg border-2 text-left transition-all ${
                data.timeFormat === f.id
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
                  : 'border-stone-100 dark:border-stone-700 bg-white dark:bg-stone-800 hover:border-stone-200 dark:hover:border-stone-600'
              }`}>
              <p className="text-xs font-medium text-stone-900 dark:text-stone-100">{f.label}</p>
              <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">{f.example}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main Onboarding component ─────────────────────────────────────
export default function OnboardingWizard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  const [data, setData] = useState({
    firstName:    '',
    lastName:     '',
    displayName:  '',
    fontId:       'inter',
    compactMode:  false,
    showReadingTime: true,
    timezone:     Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Nairobi',
    dateFormat:   'relative',
    timeFormat:   '12h',
  })

  const onChange = (updates) => setData(prev => ({ ...prev, ...updates }))

  // Auto-fill display name from first name
  useEffect(() => {
    if (!data.displayName && data.firstName) {
      setData(prev => ({ ...prev, displayName: prev.firstName }))
    }
  }, [data.firstName])

  const canAdvance = () => {
    if (step === 0) return data.firstName.trim().length > 0
    return true
  }

  const handleNext = async () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
      return
    }
    // Final step — save everything
    setSaving(true)
    try {
      const displayName = data.displayName.trim() || data.firstName.trim()
      const fullName    = [data.firstName.trim(), data.lastName.trim()].filter(Boolean).join(' ')

      // Save to profiles table (name + all settings)
      await supabase.from('profiles').upsert({
        id:           user.id,
        display_name: displayName,
        full_name:    fullName,
        font_id:      data.fontId,
        compact_mode: data.compactMode,
        show_reading_time: data.showReadingTime,
        timezone:     data.timezone,
        date_format:  data.dateFormat,
        time_format:  data.timeFormat,
        onboarding_complete: true,
      })

      navigate('/dashboard', { replace: true })
    } catch (err) {
      console.error('Onboarding save failed:', err)
      navigate('/dashboard', { replace: true })  // Don't block on error
    } finally {
      setSaving(false)
    }
  }

  const stepComponents = [
    <StepWelcome   key="welcome"  data={data} onChange={onChange} />,
    <StepReading   key="reading"  data={data} onChange={onChange} />,
    <StepDateTime  key="datetime" data={data} onChange={onChange} />,
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-stone-50 dark:from-stone-950 dark:to-stone-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-6">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-all flex-shrink-0 ${
                i < step  ? 'bg-brand-600 text-white' :
                i === step? 'bg-brand-600 text-white ring-4 ring-brand-100 dark:ring-brand-900/40' :
                            'bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500'
              }`}>
                {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${
                i === step ? 'text-brand-700 dark:text-brand-400' : 'text-stone-400 dark:text-stone-500'
              }`}>{s.label}</span>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-1 ${
                  i < step ? 'bg-brand-400' : 'bg-stone-200 dark:bg-stone-700'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-xl border border-stone-100 dark:border-stone-800 p-7 max-h-[80vh] overflow-y-auto">
          {stepComponents[step]}

          <div className="flex items-center justify-between mt-8 pt-5 border-t border-stone-100 dark:border-stone-800">
            {step > 0 ? (
              <button onClick={() => setStep(s => s - 1)}
                className="px-4 py-2 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors">
                ← Back
              </button>
            ) : (
              <div />
            )}
            <button
              onClick={handleNext}
              disabled={!canAdvance() || saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving…' :
               step === STEPS.length - 1 ? 'Take me to my feed →' :
               <>Next <ArrowRight className="w-4 h-4" /></>}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-stone-400 dark:text-stone-500 mt-4">
          You can change all of these later in Settings.
        </p>
      </div>
    </div>
  )
}
