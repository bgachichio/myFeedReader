import { useState, useEffect, useCallback } from 'react'
import { User, Lock, Type, Calendar, Clock, Layout, Trash2, Check, Eye, EyeOff, AlertTriangle, Activity, CreditCard, Zap, ExternalLink } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useSettings, FONTS, FONT_SIZES, DATE_FORMATS, TIME_FORMATS, TIMEZONES } from '../contexts/SettingsContext'
import { supabase } from '../lib/supabase'
import { usePlan } from '../contexts/PlanContext'
import PaywallModal from '../components/PaywallModal'

// ── Section wrapper ───────────────────────────────────────────────
function Section({ icon: Icon, title, description, children }) {
  return (
    <div className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-2xl overflow-hidden">
      <div className="px-6 py-5 border-b border-stone-50 dark:border-stone-800 flex items-start gap-3">
        <div className="w-8 h-8 bg-brand-50 dark:bg-brand-900/30 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-brand-600 dark:text-brand-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">{title}</h2>
          {description && <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">{hint}</p>}
    </div>
  )
}

function SaveButton({ loading, saved, onClick, label = 'Save changes' }) {
  return (
    <button onClick={onClick} disabled={loading}
      className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50">
      {loading
        ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        : saved ? <Check className="w-3.5 h-3.5" /> : null}
      {loading ? 'Saving...' : saved ? 'Saved!' : label}
    </button>
  )
}

function StatusMsg({ msg }) {
  if (!msg) return null
  const isError = msg.type === 'error'
  return (
    <p className={`text-xs ${isError ? 'text-red-500 dark:text-red-400' : 'text-brand-600 dark:text-brand-400'}`}>
      {msg.text}
    </p>
  )
}

// ── Live diagnostic panel ─────────────────────────────────────────
function DiagnosticPanel() {
  const { user } = useAuth()
  const [status, setStatus] = useState('idle')   // idle | checking | ok | error
  const [detail, setDetail] = useState('')
  const [rowData, setRowData] = useState(null)

  const runCheck = useCallback(async () => {
    if (!user) { setStatus('error'); setDetail('Not logged in — no user session.'); return }
    setStatus('checking'); setDetail(''); setRowData(null)

    try {
      // Step 1: verify auth session is valid
      const { data: { session }, error: sessErr } = await supabase.auth.getSession()
      if (sessErr || !session) throw new Error('Auth session invalid or missing. Try signing out and back in.')

      // Step 2: try to read profile row
      const { data, error: readErr } = await supabase
        .from('profiles')
        .select('id, display_name, font_id, font_size, date_format, time_format, timezone, compact_mode, show_reading_time, show_author, articles_per_page, email_notifications, updated_at')
        .eq('id', user.id)
        .maybeSingle()
      if (readErr) throw new Error(`SELECT failed: ${readErr.message} (code: ${readErr.code})`)

      if (!data) {
        // Step 3a: no row — try to insert one
        const { error: insertErr } = await supabase
          .from('profiles')
          .insert({ id: user.id })
        if (insertErr) throw new Error(`Profile row missing AND INSERT failed: ${insertErr.message} — RLS INSERT policy likely missing. Run migration v6 in Supabase SQL Editor.`)
        setDetail('Profile row created successfully. Settings will now persist.')
        setStatus('ok')
        return
      }

      // Step 3b: row exists — try a test UPDATE
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', user.id)
      if (updateErr) throw new Error(`SELECT works but UPDATE failed: ${updateErr.message} (code: ${updateErr.code}) — RLS UPDATE policy likely missing. Run migration v6 in Supabase SQL Editor.`)

      setRowData(data)
      setDetail(`DB connection OK. Profile row exists. Last saved: ${data.updated_at ? new Date(data.updated_at).toLocaleString() : 'never'}.`)
      setStatus('ok')

    } catch (err) {
      setStatus('error')
      setDetail(err.message)
    }
  }, [user])

  useEffect(() => { runCheck() }, [runCheck])

  const colour = status === 'ok' ? 'text-brand-600 dark:text-brand-400'
    : status === 'error' ? 'text-red-600 dark:text-red-400'
    : 'text-stone-400 dark:text-stone-500'
  const dot = status === 'ok' ? 'bg-brand-500'
    : status === 'error' ? 'bg-red-500'
    : 'bg-stone-300 dark:bg-stone-600'

  return (
    <div className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-2xl overflow-hidden">
      <div className="px-6 py-5 border-b border-stone-50 dark:border-stone-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-stone-50 dark:bg-stone-800 rounded-lg flex items-center justify-center flex-shrink-0">
            <Activity className="w-4 h-4 text-stone-500 dark:text-stone-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Settings Diagnostics</h2>
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">Live check of your database connection and permissions</p>
          </div>
        </div>
        <button onClick={runCheck}
          className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 border border-stone-200 dark:border-stone-700 px-2.5 py-1 rounded-lg transition-colors">
          Re-check
        </button>
      </div>
      <div className="px-6 py-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot} ${status === 'checking' ? 'animate-pulse' : ''}`} />
          <span className={`text-xs font-medium ${colour}`}>
            {status === 'idle' ? 'Not checked' :
             status === 'checking' ? 'Checking...' :
             status === 'ok' ? 'All systems go' : 'Problem detected'}
          </span>
        </div>
        {detail && (
          <p className={`text-xs leading-relaxed ${status === 'error' ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-lg' : 'text-stone-500 dark:text-stone-400'}`}>
            {detail}
          </p>
        )}
        {status === 'error' && detail.includes('migration') && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
            <p className="font-semibold">To fix: run Migration v6</p>
            <p>1. Open your Supabase dashboard</p>
            <p>2. Go to SQL Editor → New query</p>
            <p>3. Paste the contents of <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">supabase_migration_v6.sql</code></p>
            <p>4. Click Run, then come back and click Re-check above</p>
          </div>
        )}
        {rowData && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              ['User ID',            rowData.id?.slice(0, 12) + '...'],
              ['Display name',       rowData.display_name       || '(none)'],
              ['Font',               rowData.font_id            || 'inter'],
              ['Date format',        rowData.date_format        || 'relative'],
              ['Time format',        rowData.time_format        || '12h'],
              ['Timezone',           rowData.timezone           || '(none)'],
              ['Compact mode',       String(rowData.compact_mode        ?? false)],
              ['Reading time',       String(rowData.show_reading_time   ?? true)],
              ['Show author',        String(rowData.show_author         ?? true)],
              ['Articles per page',  String(rowData.articles_per_page   || 20)],
              ['Email notifs',       String(rowData.email_notifications ?? false)],
              ['Font size',          rowData.font_size || 'md'],
              ['Last saved',         rowData.updated_at ? new Date(rowData.updated_at).toLocaleString() : 'never'],
            ].map(([k, v]) => (
              <div key={k} className="bg-stone-50 dark:bg-stone-800 rounded-lg p-2">
                <p className="text-stone-400 dark:text-stone-500">{k}</p>
                <p className="font-medium text-stone-700 dark:text-stone-300 truncate">{v}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Profile section ───────────────────────────────────────────────
function ProfileSection() {
  const { user } = useAuth()
  const { settings, updateSettings } = useSettings()
  const [name, setName] = useState(settings.displayName)
  useEffect(() => { setName(settings.displayName) }, [settings.displayName])
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [msg, setMsg] = useState(null)

  const handleSave = async () => {
    setLoading(true); setMsg(null)
    try {
      await updateSettings({ displayName: name.trim() })
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setMsg({ type: 'error', text: `Save failed: ${err.message}` })
    } finally { setLoading(false) }
  }

  return (
    <Section icon={User} title="Profile" description="Your display name shown in the app.">
      <Field label="Display name" hint="Only visible to you.">
        <input type="text" value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder="e.g. Brian"
          className="w-full px-3 py-2.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-stone-400" />
      </Field>
      <Field label="Email">
        <input type="email" value={user?.email || ''} disabled
          className="w-full px-3 py-2.5 border border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/50 text-stone-400 dark:text-stone-600 rounded-lg text-sm cursor-not-allowed" />
        <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">Email cannot be changed here.</p>
      </Field>
      <div className="flex items-center gap-3 pt-1">
        <SaveButton loading={loading} saved={saved} onClick={handleSave} />
        <StatusMsg msg={msg} />
      </div>
    </Section>
  )
}

// ── Password section ──────────────────────────────────────────────
function PasswordSection() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [msg, setMsg] = useState(null)

  const handleSave = async () => {
    setMsg(null)
    if (next.length < 6) return setMsg({ type: 'error', text: 'New password must be at least 6 characters.' })
    if (next !== confirm) return setMsg({ type: 'error', text: 'Passwords do not match.' })
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: current })
      if (signInError) throw new Error('Current password is incorrect.')
      const { error } = await supabase.auth.updateUser({ password: next })
      if (error) throw error
      setSaved(true); setCurrent(''); setNext(''); setConfirm('')
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally { setLoading(false) }
  }

  const inputClass = "w-full px-3 py-2.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
  const strength = next.length === 0 ? null : next.length < 8 ? 'weak' : next.length < 12 ? 'good' : 'strong'

  return (
    <Section icon={Lock} title="Password" description="Change your account password.">
      <Field label="Current password">
        <div className="relative">
          <input type={showCurrent ? 'text' : 'password'} value={current} onChange={e => setCurrent(e.target.value)} className={inputClass} placeholder="••••••••" />
          <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
            {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </Field>
      <Field label="New password">
        <div className="relative">
          <input type={showNext ? 'text' : 'password'} value={next} onChange={e => setNext(e.target.value)} className={inputClass} placeholder="Min. 6 characters" />
          <button type="button" onClick={() => setShowNext(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
            {showNext ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {strength && (
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex gap-1">
              {['weak','good','strong'].map((s, i) => (
                <div key={s} className={`h-1 w-8 rounded-full transition-colors ${
                  i <= ['weak','good','strong'].indexOf(strength)
                    ? strength === 'weak' ? 'bg-red-400' : strength === 'good' ? 'bg-amber-400' : 'bg-brand-500'
                    : 'bg-stone-100 dark:bg-stone-800'
                }`} />
              ))}
            </div>
            <span className={`text-xs capitalize ${strength === 'weak' ? 'text-red-400' : strength === 'good' ? 'text-amber-500' : 'text-brand-600'}`}>{strength}</span>
          </div>
        )}
      </Field>
      <Field label="Confirm new password">
        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className={inputClass} placeholder="••••••••" />
        {confirm && next !== confirm && <p className="text-xs text-red-400 mt-1">Passwords don't match</p>}
      </Field>
      <div className="flex items-center gap-3 pt-1">
        <SaveButton loading={loading} saved={saved} onClick={handleSave} label="Update password" />
        <StatusMsg msg={msg} />
      </div>
    </Section>
  )
}

// ── Appearance section ────────────────────────────────────────────
function AppearanceSection() {
  const { settings, updateSettings } = useSettings()
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [local, setLocal] = useState({
    fontId: settings.fontId,
    fontSize: settings.fontSize,
    compactMode: settings.compactMode,
    showReadingTime: settings.showReadingTime,
    showAuthor: settings.showAuthor,
  })
  useEffect(() => {
    setLocal({ fontId: settings.fontId, fontSize: settings.fontSize, compactMode: settings.compactMode, showReadingTime: settings.showReadingTime, showAuthor: settings.showAuthor })
  }, [settings.fontId, settings.fontSize, settings.compactMode, settings.showReadingTime, settings.showAuthor])

  const handleSave = async () => {
    setLoading(true); setMsg(null)
    try {
      await updateSettings(local)
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setMsg({ type: 'error', text: `Save failed: ${err.message}` })
    } finally { setLoading(false) }
  }

  return (
    <Section icon={Type} title="Appearance" description="Font and reading display preferences.">
      <Field label="Font">
        <div className="grid grid-cols-1 gap-2">
          {FONTS.map(font => (
            <button key={font.id} onClick={() => setLocal(p => ({ ...p, fontId: font.id }))}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-colors ${
                local.fontId === font.id
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
                  : 'border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600'
              }`}>
              <div>
                <span className="text-sm font-medium text-stone-900 dark:text-stone-100" style={{ fontFamily: font.stack }}>{font.label}</span>
                <span className="ml-3 text-xs text-stone-400 dark:text-stone-500" style={{ fontFamily: font.stack }}>The quick brown fox</span>
              </div>
              {local.fontId === font.id && <Check className="w-4 h-4 text-brand-600 dark:text-brand-400 flex-shrink-0" />}
            </button>
          ))}
        </div>
      </Field>

      <div className="border-t border-stone-50 dark:border-stone-800 pt-4">
        <Field label="Font size" hint="Applies to article content and feed cards.">
          <div className="grid grid-cols-4 gap-2">
            {FONT_SIZES.map(size => (
              <button key={size.id} onClick={() => setLocal(p => ({ ...p, fontSize: size.id }))}
                className={`flex flex-col items-center justify-center gap-1.5 px-2 py-3 rounded-xl border transition-colors ${
                  local.fontSize === size.id
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
                    : 'border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600'
                }`}>
                <span style={{ fontSize: size.cssSize, lineHeight: 1 }} className="font-medium text-stone-800 dark:text-stone-200">Aa</span>
                <span className="text-xs text-stone-500 dark:text-stone-400">{size.label}</span>
                {local.fontSize === size.id && <Check className="w-3 h-3 text-brand-600 dark:text-brand-400" />}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <div className="border-t border-stone-50 dark:border-stone-800 pt-4 space-y-3">
        <p className="text-xs font-medium text-stone-600 dark:text-stone-400">Article display</p>
        {[
          { key: 'compactMode',     label: 'Compact mode',       hint: 'Reduce padding between articles' },
          { key: 'showReadingTime', label: 'Show reading time',  hint: 'Estimate on each article card' },
          { key: 'showAuthor',      label: 'Show author',        hint: 'Display author name on articles' },
        ].map(({ key, label, hint }) => (
          <label key={key} className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm text-stone-700 dark:text-stone-300">{label}</p>
              <p className="text-xs text-stone-400 dark:text-stone-500">{hint}</p>
            </div>
            <div onClick={() => setLocal(p => ({ ...p, [key]: !p[key] }))}
              className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${local[key] ? 'bg-brand-600' : 'bg-stone-200 dark:bg-stone-700'}`}>
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${local[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
          </label>
        ))}
      </div>

      <div className="pt-1 flex items-center gap-3">
        <SaveButton loading={loading} saved={saved} onClick={handleSave} />
        <StatusMsg msg={msg} />
      </div>
    </Section>
  )
}

// ── Date & Time section ───────────────────────────────────────────
function DateTimeSection() {
  const { settings, updateSettings } = useSettings()
  const [local, setLocal] = useState({
    dateFormat: settings.dateFormat,
    timeFormat: settings.timeFormat,
    timezone: settings.timezone,
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [msg, setMsg] = useState(null)
  const [tzSearch, setTzSearch] = useState('')
  useEffect(() => {
    setLocal({ dateFormat: settings.dateFormat, timeFormat: settings.timeFormat, timezone: settings.timezone })
  }, [settings.dateFormat, settings.timeFormat, settings.timezone])

  const filteredTz = tzSearch
    ? TIMEZONES.filter(tz => tz.toLowerCase().includes(tzSearch.toLowerCase())).slice(0, 50)
    : TIMEZONES

  const handleSave = async () => {
    setLoading(true); setMsg(null)
    try {
      await updateSettings(local)
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setMsg({ type: 'error', text: `Save failed: ${err.message}` })
    } finally { setLoading(false) }
  }

  return (
    <Section icon={Calendar} title="Date & Time" description="How dates and times appear throughout the app.">
      <Field label="Date format">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {DATE_FORMATS.map(df => (
            <button key={df.id} onClick={() => setLocal(p => ({ ...p, dateFormat: df.id }))}
              className={`px-3 py-2 rounded-lg border text-left transition-colors ${
                local.dateFormat === df.id
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
                  : 'border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600'
              }`}>
              <p className="text-xs font-medium text-stone-700 dark:text-stone-300">{df.label}</p>
              <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">{df.example}</p>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Time format">
        <div className="flex gap-2">
          {TIME_FORMATS.map(tf => (
            <button key={tf.id} onClick={() => setLocal(p => ({ ...p, timeFormat: tf.id }))}
              className={`flex-1 px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                local.timeFormat === tf.id
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 font-medium'
                  : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-600'
              }`}>
              {tf.label} <span className="text-xs opacity-60">({tf.example})</span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Timezone">
        <div className="relative">
          <input type="text" value={tzSearch || local.timezone} onChange={e => setTzSearch(e.target.value)}
            onFocus={e => { setTzSearch(''); e.target.select() }}
            placeholder="Search timezone..."
            className="w-full px-3 py-2.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          {tzSearch && (
            <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredTz.length === 0
                ? <p className="px-3 py-2 text-xs text-stone-400">No results</p>
                : filteredTz.map(tz => (
                  <button key={tz} onClick={() => { setLocal(p => ({ ...p, timezone: tz })); setTzSearch('') }}
                    className="w-full text-left px-3 py-2 text-xs text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors">
                    {tz}
                  </button>
                ))
              }
            </div>
          )}
        </div>
      </Field>

      <div className="px-3 py-2.5 bg-stone-50 dark:bg-stone-800/50 rounded-lg">
        <p className="text-xs text-stone-400 dark:text-stone-500 mb-0.5">Preview</p>
        <p className="text-sm text-stone-700 dark:text-stone-300 font-medium">
          {new Date().toLocaleDateString(undefined, {
            timeZone: local.timezone,
            ...(local.dateFormat === 'dmy' && { day: '2-digit', month: '2-digit', year: 'numeric' }),
            ...(local.dateFormat === 'mdy' && { month: '2-digit', day: '2-digit', year: 'numeric' }),
            ...(local.dateFormat === 'ymd' && { year: 'numeric', month: '2-digit', day: '2-digit' }),
            ...(local.dateFormat === 'medium' && { month: 'short', day: 'numeric', year: 'numeric' }),
            ...(local.dateFormat === 'relative' && { month: 'short', day: 'numeric', year: 'numeric' }),
          })}
          {' · '}
          {new Date().toLocaleTimeString(undefined, {
            timeZone: local.timezone,
            hour: '2-digit', minute: '2-digit',
            hour12: local.timeFormat === '12h',
          })}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <SaveButton loading={loading} saved={saved} onClick={handleSave} />
        <StatusMsg msg={msg} />
      </div>
    </Section>
  )
}

// ── Reading preferences section ───────────────────────────────────
function ReadingSection() {
  const { settings, updateSettings } = useSettings()
  const [local, setLocal] = useState({ articlesPerPage: settings.articlesPerPage })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [msg, setMsg] = useState(null)
  useEffect(() => { setLocal({ articlesPerPage: settings.articlesPerPage }) }, [settings.articlesPerPage])

  const handleSave = async () => {
    setLoading(true); setMsg(null)
    try {
      await updateSettings(local)
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setMsg({ type: 'error', text: `Save failed: ${err.message}` })
    } finally { setLoading(false) }
  }

  return (
    <Section icon={Layout} title="Reading" description="Feed and article preferences.">
      <Field label="Articles per page" hint="How many articles load at a time in your feed.">
        <div className="flex gap-2">
          {[10, 20, 30, 50].map(n => (
            <button key={n} onClick={() => setLocal({ articlesPerPage: n })}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                local.articlesPerPage === n
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400'
                  : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-600'
              }`}>{n}</button>
          ))}
        </div>
      </Field>
      <div className="flex items-center gap-3">
        <SaveButton loading={loading} saved={saved} onClick={handleSave} />
        <StatusMsg msg={msg} />
      </div>
    </Section>
  )
}

// ── Danger zone ───────────────────────────────────────────────────
function DangerSection() {
  const { signOut, user } = useAuth()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)

  const handleDeleteAccount = async () => {
    if (deleteInput !== 'DELETE') return
    setLoading(true)
    try {
      await supabase.from('articles').delete().eq('user_id', user.id)
      await supabase.from('feeds').delete().eq('user_id', user.id)
      await supabase.from('profiles').delete().eq('id', user.id)
      await signOut()
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to delete account. Please contact support.' })
      setLoading(false)
    }
  }

  return (
    <Section icon={Trash2} title="Danger zone" description="Irreversible account actions.">
      {!confirmDelete ? (
        <button onClick={() => setConfirmDelete(true)}
          className="flex items-center gap-2 px-4 py-2 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-sm font-medium rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
          <Trash2 className="w-4 h-4" />Delete my account
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 dark:text-red-400">
              This will permanently delete all your feeds, articles, bookmarks and settings. This cannot be undone.
            </p>
          </div>
          <Field label="Type DELETE to confirm">
            <input type="text" value={deleteInput} onChange={e => setDeleteInput(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3 py-2.5 border border-red-200 dark:border-red-800 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </Field>
          <div className="flex gap-2">
            <button onClick={() => { setConfirmDelete(false); setDeleteInput('') }}
              className="flex-1 py-2 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 text-sm font-medium rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">
              Cancel
            </button>
            <button onClick={handleDeleteAccount}
              disabled={deleteInput !== 'DELETE' || loading}
              className="flex-1 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-40">
              {loading ? 'Deleting...' : 'Delete account'}
            </button>
          </div>
          {msg && <p className="text-xs text-red-500">{msg.text}</p>}
        </div>
      )}
    </Section>
  )
}


// ── Billing Section ───────────────────────────────────────────────
function BillingSection() {
  const { isPro, plan, planSource, planExpiresAt, refresh } = usePlan()
  const [showPaywall, setShowPaywall] = useState(false)
  const [manageLoading, setManageLoading] = useState(false)
  const [manageError, setManageError] = useState('')
  const { user, session } = useAuth()

  const formatExpiry = (date) => {
    if (!date) return null
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  }

  const handleManageSubscription = async () => {
    setManageLoading(true)
    setManageError('')
    try {
      // Get a fresh session token in case it expired
      const { data: { session: freshSession } } = await supabase.auth.getSession()
      const token = freshSession?.access_token || session?.access_token
      if (!token) {
        setManageError('Session expired — please sign out and sign back in.')
        return
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const res = await fetch(`${supabaseUrl}/functions/v1/get-manage-link`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      const data = await res.json()
      if (data?.link) {
        window.open(data.link, '_blank', 'noopener,noreferrer')
      } else if (data?.error === 'subscription_not_found') {
        setManageError(data.message ?? 'No subscription found. Check your inbox for a Paystack email.')
      } else if (data?.message) {
        setManageError(data.message)
      } else {
        setManageError('Could not generate link. Please try again or contact support.')
      }
    } catch (err) {
      console.error('Manage subscription error:', err)
      setManageError('Could not connect. Please try again.')
    } finally {
      setManageLoading(false)
    }
  }

  return (
    <Section icon={CreditCard} title="Plan & Billing" description="Manage your myFeedReader subscription.">
      {/* Current plan */}
      <div className={`flex items-center justify-between p-4 rounded-xl border ${
        isPro
          ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800'
          : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            isPro ? 'bg-brand-600' : 'bg-stone-200 dark:bg-stone-700'
          }`}>
            <Zap className={`w-4 h-4 ${isPro ? 'text-white' : 'text-stone-500 dark:text-stone-400'}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              {isPro ? 'Pro' : 'Free'}
            </p>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {isPro
                ? planExpiresAt ? `Renews ${formatExpiry(planExpiresAt)}` : 'Active'
                : '10 sources · 7-day history'}
            </p>
          </div>
        </div>
        {isPro && (
          <span className="px-2.5 py-1 bg-brand-600 text-white text-xs font-semibold rounded-full">
            Pro
          </span>
        )}
      </div>

      {/* What Pro includes */}
      {!isPro && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
            Upgrade to Pro for
          </p>
          {[
            'Unlimited sources',
            'Full-text article reading',
            'Daily Digest',
            'Newsletter integration',
            'Export (OPML & CSV)',
            'Reading stats',
          ].map(f => (
            <div key={f} className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 flex-shrink-0" />
              <span className="text-xs text-stone-600 dark:text-stone-300">{f}</span>
            </div>
          ))}
          <button
            onClick={() => setShowPaywall(true)}
            className="w-full mt-3 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors">
            Upgrade to Pro
          </button>
        </div>
      )}

      {/* Manage subscription */}
      {isPro && planSource === 'paystack' && (
        <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
          <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">
            Update your payment method or cancel your subscription through Paystack.
          </p>
          <button
            onClick={handleManageSubscription}
            disabled={manageLoading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 text-sm font-medium rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors disabled:opacity-60"
          >
            {manageLoading
              ? <><span className="w-3.5 h-3.5 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />Generating link...</>
              : <><ExternalLink className="w-3.5 h-3.5" />Manage on Paystack</>
            }
          </button>
          {manageError && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 max-w-xs">{manageError}</p>
          )}
        </div>
      )}

      {showPaywall && <PaywallModal feature="sources" onClose={() => setShowPaywall(false)} />}
    </Section>
  )
}

// ── Main Settings page ────────────────────────────────────────────
export default function SettingsView() {
  const [activeTab, setActiveTab] = useState('diagnostics')

  const tabs = [
    { id: 'billing',      label: 'Billing',      icon: CreditCard },
    { id: 'diagnostics', label: 'Diagnostics', icon: Activity },
    { id: 'profile',     label: 'Profile',     icon: User },
    { id: 'appearance',  label: 'Appearance',  icon: Type },
    { id: 'datetime',    label: 'Date & Time', icon: Clock },
    { id: 'reading',     label: 'Reading',     icon: Layout },
    { id: 'security',    label: 'Security',    icon: Lock },
    { id: 'danger',      label: 'Danger zone', icon: Trash2 },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl text-stone-900 dark:text-stone-100">Settings</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">Manage your account and preferences.</p>
      </div>

      <div className="flex gap-1 mb-6 flex-wrap">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === id
                ? 'bg-brand-600 text-white'
                : id === 'danger'
                  ? 'bg-white dark:bg-stone-900 border border-red-100 dark:border-red-900/50 text-red-500 dark:text-red-400 hover:text-red-700'
                  : 'bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300'
            }`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      <div className="max-w-xl">
        {activeTab === 'billing'      && <BillingSection />}
        {activeTab === 'diagnostics' && <DiagnosticPanel />}
        {activeTab === 'profile'     && <ProfileSection />}
        {activeTab === 'appearance'  && <AppearanceSection />}
        {activeTab === 'datetime'    && <DateTimeSection />}
        {activeTab === 'reading'     && <ReadingSection />}
        {activeTab === 'security'    && <PasswordSection />}
        {activeTab === 'danger'      && <DangerSection />}
      </div>
    </div>
  )
}
