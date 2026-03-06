import { useEffect } from 'react'
import { X, Keyboard } from 'lucide-react'

const SHORTCUTS = [
  { group: 'Navigation', items: [
    { keys: ['1'], description: 'Go to My Feed' },
    { keys: ['2'], description: 'Go to Daily Digest' },
    { keys: ['3'], description: 'Go to Sources' },
    { keys: ['4'], description: 'Go to Bookmarks' },
    { keys: ['5'], description: 'Go to Read Later' },
    { keys: ['6'], description: 'Go to Stats' },
    { keys: ['7'], description: 'Go to Saved' },
  ]},
  { group: 'Search', items: [
    { keys: ['/'], description: 'Open search' },
    { keys: ['f'], description: 'Open search (alternative)' },
    { keys: ['↑', '↓'], description: 'Navigate results' },
    { keys: ['↵'], description: 'Open selected result' },
    { keys: ['Esc'], description: 'Close search' },
  ]},
  { group: 'General', items: [
    { keys: ['?'], description: 'Show this help' },
    { keys: ['Esc'], description: 'Close any modal' },
  ]},
]

function Kbd({ children }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-md text-xs font-mono font-medium text-stone-600 dark:text-stone-400 shadow-sm">
      {children}
    </kbd>
  )
}

export default function KeyboardShortcutsModal({ onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand-50 dark:bg-brand-900/30 rounded-lg flex items-center justify-center">
              <Keyboard className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            </div>
            <h2 className="font-display font-bold text-lg text-stone-900 dark:text-stone-100">Keyboard shortcuts</h2>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="px-6 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
          {SHORTCUTS.map(({ group, items }) => (
            <div key={group}>
              <p className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-2.5">{group}</p>
              <div className="space-y-2">
                {items.map(({ keys, description }) => (
                  <div key={description} className="flex items-center justify-between">
                    <span className="text-sm text-stone-600 dark:text-stone-400">{description}</span>
                    <div className="flex items-center gap-1">
                      {keys.map((key, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <Kbd>{key}</Kbd>
                          {i < keys.length - 1 && <span className="text-xs text-stone-400 dark:text-stone-500">then</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-stone-50 dark:border-stone-800 text-center">
          <p className="text-xs text-stone-400 dark:text-stone-500">Press <Kbd>?</Kbd> anywhere to show this</p>
        </div>
      </div>
    </div>
  )
}
