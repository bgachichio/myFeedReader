import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

export const FONTS = [
  { id: 'inter',        label: 'Inter',       stack: "'Inter', sans-serif",                 googleParam: 'Inter:wght@300;400;500;600;700' },
  { id: 'system',       label: 'System UI',   stack: "system-ui, -apple-system, sans-serif",googleParam: null },
  { id: 'georgia',      label: 'Georgia',     stack: "Georgia, 'Times New Roman', serif",   googleParam: null },
  { id: 'lato',         label: 'Lato',        stack: "'Lato', sans-serif",                  googleParam: 'Lato:wght@300;400;700' },
  { id: 'merriweather', label: 'Merriweather',stack: "'Merriweather', serif",               googleParam: 'Merriweather:wght@300;400;700' },
]

export const DATE_FORMATS = [
  { id: 'relative', label: 'Relative',     example: '2 hours ago' },
  { id: 'dmy',      label: 'DD/MM/YYYY',   example: '26/02/2026' },
  { id: 'mdy',      label: 'MM/DD/YYYY',   example: '02/26/2026' },
  { id: 'ymd',      label: 'YYYY/MM/DD',   example: '2026/02/26' },
  { id: 'medium',   label: 'Feb 26, 2026', example: 'Feb 26, 2026' },
]

export const TIME_FORMATS = [
  { id: '12h', label: '12-hour', example: '2:30 PM' },
  { id: '24h', label: '24-hour', example: '14:30' },
]

export const TIMEZONES = Intl.supportedValuesOf
  ? Intl.supportedValuesOf('timeZone')
  : ['Africa/Nairobi','Africa/Lagos','Africa/Johannesburg','Africa/Cairo',
     'America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
     'America/Sao_Paulo','Europe/London','Europe/Paris','Europe/Berlin',
     'Asia/Dubai','Asia/Singapore','Asia/Tokyo','Asia/Kolkata',
     'Australia/Sydney','Pacific/Auckland','UTC']

const DEFAULT_SETTINGS = {
  displayName: '',
  fontId: 'inter',
  dateFormat: 'relative',
  timeFormat: '12h',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Nairobi',
  compactMode: false,
  showReadingTime: true,
  showAuthor: true,
  articlesPerPage: 20,
  emailNotifications: false,
}

// ── localStorage helpers ──────────────────────────────────────────
function loadCached() {
  try {
    // Migrate from old key if present
    const legacy = localStorage.getItem('myfeed-settings')
    const raw = localStorage.getItem('myfeedreader-settings') || legacy
    if (legacy && !localStorage.getItem('myfeedreader-settings')) {
      localStorage.setItem('myfeedreader-settings', legacy)
      localStorage.removeItem('myfeed-settings')
    }
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch { return DEFAULT_SETTINGS }
}

function saveCache(s) {
  try { localStorage.setItem('myfeedreader-settings', JSON.stringify(s)) } catch {}
}

// ── Row mapper: DB columns → app object ──────────────────────────
function dbToSettings(data) {
  return {
    ...DEFAULT_SETTINGS,
    displayName:        data.display_name        || '',
    fontId:             data.font_id             || 'inter',
    dateFormat:         data.date_format         || 'relative',
    timeFormat:         data.time_format         || '12h',
    timezone:           data.timezone            || DEFAULT_SETTINGS.timezone,
    compactMode:        data.compact_mode        ?? false,
    showReadingTime:    data.show_reading_time   ?? true,
    showAuthor:         data.show_author         ?? true,
    articlesPerPage:    data.articles_per_page   || 20,
    emailNotifications: data.email_notifications ?? false,
  }
}

// ── Row mapper: app object → DB columns ──────────────────────────
function settingsToDb(s, userId) {
  return {
    id:                  userId,
    display_name:        s.displayName,
    font_id:             s.fontId,
    date_format:         s.dateFormat,
    time_format:         s.timeFormat,
    timezone:            s.timezone,
    compact_mode:        s.compactMode,
    show_reading_time:   s.showReadingTime,
    show_author:         s.showAuthor,
    articles_per_page:   s.articlesPerPage,
    email_notifications: s.emailNotifications,
    updated_at:          new Date().toISOString(),
  }
}

// ── Write to Supabase: explicit SELECT → INSERT or UPDATE ─────────
// More reliable than upsert: splits the operation so each RLS policy
// (INSERT vs UPDATE) is exercised unambiguously.
// In Supabase JS v2, omitting .select() after insert/update means no
// rows are returned — equivalent to "returning minimal". No options needed.
async function persistToDb(settings, userId) {
  // 1. Lightweight existence check — HEAD request, no row data returned
  const { count, error: countErr } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('id', userId)

  if (countErr) throw new Error(`DB read check failed: ${countErr.message}`)

  const row = settingsToDb(settings, userId)

  if (count === 0) {
    // No row yet — INSERT (v2: no second arg, no .select() = no return data)
    const { error } = await supabase
      .from('profiles')
      .insert(row)
    if (error) throw new Error(`Insert failed: ${error.message}`)
  } else {
    // Row exists — UPDATE (v2: no second arg, no .select() = no return data)
    const { error } = await supabase
      .from('profiles')
      .update(row)
      .eq('id', userId)
    if (error) throw new Error(`Update failed: ${error.message}`)
  }
}

// ── Context ───────────────────────────────────────────────────────
const SettingsContext = createContext({})

export function SettingsProvider({ children }) {
  const { user } = useAuth()
  const [settings, setSettings] = useState(loadCached)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const settingsRef = useRef(settings)
  useEffect(() => { settingsRef.current = settings }, [settings])

  // ── Load from Supabase on login ───────────────────────────────
  useEffect(() => {
    if (!user) { setLoadingSettings(false); return }
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()  // returns null (not error) when no row exists

        if (error) throw error
        if (data) {
          const loaded = dbToSettings(data)
          setSettings(loaded)
          saveCache(loaded)
        }
        // if data is null: no profile row yet — keep defaults, first save will INSERT
      } catch (err) {
        console.warn('Settings load failed:', err.message)
      } finally {
        setLoadingSettings(false)
      }
    })()
  }, [user?.id])

  // ── Apply font ────────────────────────────────────────────────
  useEffect(() => {
    const font = FONTS.find(f => f.id === settings.fontId) || FONTS[0]
    if (font.googleParam && !document.getElementById(`gf-${font.id}`)) {
      const link = document.createElement('link')
      link.id   = `gf-${font.id}`
      link.rel  = 'stylesheet'
      link.href = `https://fonts.googleapis.com/css2?family=${font.googleParam}&display=swap`
      document.head.appendChild(link)
    }
    document.body.style.fontFamily = font.stack
  }, [settings.fontId])

  // ── Save ──────────────────────────────────────────────────────
  const updateSettings = useCallback(async (updates) => {
    const next = { ...settingsRef.current, ...updates }
    setSettings(next)
    saveCache(next)          // always write to localStorage first
    if (!user) return        // not logged in — localStorage only
    await persistToDb(next, user.id)  // throws on failure — callers must catch
  }, [user])

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loadingSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)
