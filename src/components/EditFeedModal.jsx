import { useState } from 'react'
import { X, Check, Plus, Folder } from 'lucide-react'
import { updateFeed } from '../lib/feedsService'

const DEFAULT_CATEGORIES = ['Finance', 'Strategy', 'Technology', 'Politics', 'Economics', 'Culture', 'Health', 'Science', 'General']

export default function EditFeedModal({ feed, existingCategories = [], folders = [], onClose, onUpdated }) {
  const [title, setTitle] = useState(feed.title)
  const [category, setCategory] = useState(feed.category || 'General')
  const [folderId, setFolderId] = useState(feed.folder_id || '')
  const [allCategories, setAllCategories] = useState([...new Set([...DEFAULT_CATEGORIES, ...existingCategories])])
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customCategory, setCustomCategory] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAddCustom = () => {
    const formatted = customCategory.trim().charAt(0).toUpperCase() + customCategory.trim().slice(1)
    if (!formatted) return
    if (!allCategories.includes(formatted)) setAllCategories(prev => [...prev.filter(c => c !== 'General'), formatted, 'General'])
    setCategory(formatted); setCustomCategory(''); setShowCustomInput(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); if (!title.trim()) return
    setLoading(true); setError('')
    try {
      onUpdated(await updateFeed(feed.id, {
        title: title.trim(),
        category,
        folder_id: folderId || null,
      }))
      onClose()
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-2xl shadow-2xl w-full max-w-md p-8">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"><X className="w-4 h-4" /></button>
        <div className="mb-6">
          <h2 className="font-display font-bold text-2xl text-stone-900 dark:text-stone-100 mb-1">Edit source</h2>
          <p className="text-xs text-stone-400 dark:text-stone-500 truncate">{feed.url}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">Display name</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
              className="w-full px-4 py-2.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>

          {/* Folder */}
          {folders.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5 flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5" />Folder
              </label>
              <select value={folderId} onChange={e => setFolderId(e.target.value)}
                className="w-full px-4 py-2.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="">No folder (unfiled)</option>
                {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          )}

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">Category</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {allCategories.map(cat => (
                <button key={cat} type="button" onClick={() => setCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${category === cat ? 'bg-brand-600 text-white border-brand-600' : 'bg-white dark:bg-stone-800 text-stone-500 dark:text-stone-400 border-stone-200 dark:border-stone-700 hover:border-brand-400 hover:text-brand-600'}`}>
                  {cat}
                </button>
              ))}
              {!showCustomInput && (
                <button type="button" onClick={() => setShowCustomInput(true)}
                  className="px-3 py-1 rounded-full text-xs font-medium border border-dashed border-stone-300 dark:border-stone-600 text-stone-400 dark:text-stone-500 hover:border-brand-400 hover:text-brand-600 transition-colors flex items-center gap-1">
                  <Plus className="w-3 h-3" />New
                </button>
              )}
            </div>
            {showCustomInput && (
              <div className="flex gap-2">
                <input autoFocus type="text" value={customCategory} onChange={e => setCustomCategory(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustom() } if (e.key === 'Escape') { setShowCustomInput(false); setCustomCategory('') } }}
                  placeholder="New category name..." maxLength={30}
                  className="flex-1 px-3 py-2 border border-brand-300 dark:border-brand-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                <button type="button" onClick={handleAddCustom} disabled={!customCategory.trim()} className="p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-40 transition-colors"><Check className="w-4 h-4" /></button>
                <button type="button" onClick={() => { setShowCustomInput(false); setCustomCategory('') }} className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"><X className="w-4 h-4" /></button>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 font-medium rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors text-sm">Cancel</button>
            <button type="submit" disabled={loading || !title.trim()} className="flex-1 py-2.5 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 text-sm">{loading ? 'Saving...' : 'Save changes'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
