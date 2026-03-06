import { useState, useEffect } from 'react'
import { Rss, Trash2, Plus, Globe, AlertCircle, Upload, Download, ChevronDown, Pencil, CheckCircle2, XCircle, Clock, GripVertical, RefreshCw } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import { usePlan } from '../contexts/PlanContext'
import PaywallModal from '../components/PaywallModal'
import { getFeeds, deleteFeed, getFolders } from '../lib/feedsService'
import AddFeedModal from '../components/AddFeedModal'
import ImportOPMLModal from '../components/ImportOPMLModal'
import EditFeedModal from '../components/EditFeedModal'
import { generateOPML, generateCSV, downloadFile } from '../lib/opml'

const CATEGORY_COLORS = {
  Finance:'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  Strategy:'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400',
  Technology:'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Politics:'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Economics:'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Culture:'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Health:'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  Science:'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  General:'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400',
}

function HealthBadge({ feed }) {
  if (!feed.last_fetched_at) {
    return (
      <span className="flex items-center gap-1 text-xs text-stone-400 dark:text-stone-500">
        <Clock className="w-3 h-3" />Never fetched
      </span>
    )
  }

  const lastFetched = formatDistanceToNow(parseISO(feed.last_fetched_at), { addSuffix: true })

  if (feed.last_error) {
    return (
      <span className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400" title={feed.last_error}>
        <XCircle className="w-3 h-3 flex-shrink-0" />
        <span className="truncate max-w-[140px]">Error · {lastFetched}</span>
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400">
      <CheckCircle2 className="w-3 h-3" />
      {feed.article_count > 0 ? `${feed.article_count} articles · ` : ''}{lastFetched}
    </span>
  )
}

export default function SourcesView() {
  const { user } = useAuth()
  const { canAddSource, canUseFeature } = usePlan()
  const [showPaywall, setShowPaywall] = useState(false)
  const [paywallFeature, setPaywallFeature] = useState('sources')
  const [feeds, setFeeds] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [editingFeed, setEditingFeed] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [folders, setFolders] = useState([])
  const [groupByFolder, setGroupByFolder] = useState(false)

  useEffect(() => {
    loadAll()
    const handler = () => setShowExportMenu(false)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [feedData, folderData] = await Promise.all([getFeeds(user.id), getFolders(user.id).catch(() => [])])
      setFeeds(feedData)
      setFolders(folderData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAdded = (feed) => setFeeds(prev => [feed, ...prev])
  const handleImported = () => loadAll()
  const handleUpdated = (updated) => setFeeds(prev => prev.map(f => f.id === updated.id ? updated : f))

  const handleDelete = async (id) => {
    if (!confirm('Remove this source? Its cached articles will also be deleted.')) return
    setDeletingId(id)
    try {
      await deleteFeed(id)
      setFeeds(prev => prev.filter(f => f.id !== id))
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  const allCategories = [...new Set(feeds.map(f => f.category).filter(Boolean))]
  const errorFeeds = feeds.filter(f => f.last_error)
  const healthyFeeds = feeds.filter(f => !f.last_error && f.last_fetched_at)
  const neverFetched = feeds.filter(f => !f.last_fetched_at)

  // Group by folder for display
  const feedsByFolder = {}
  feedsByFolder['unfiled'] = { folder: { name: 'Unfiled' }, feeds: [] }
  feeds.forEach(feed => {
    if (feed.folder_id && feedsByFolder[feed.folder_id]) feedsByFolder[feed.folder_id].feeds.push(feed)
    else feedsByFolder['unfiled'].feeds.push(feed)
  })

  const FeedRow = ({ feed }) => (
    <div
      key={feed.id}
      draggable
      onDragStart={e => e.dataTransfer.setData('feedId', feed.id)}
      className={`bg-white dark:bg-stone-900 border rounded-xl p-4 flex items-center gap-3 hover:border-stone-200 dark:hover:border-stone-700 transition-colors group cursor-grab active:cursor-grabbing ${
        feed.last_error ? 'border-red-100 dark:border-red-900/40' : 'border-stone-100 dark:border-stone-800'
      }`}
    >
      <GripVertical className="w-4 h-4 text-stone-300 dark:text-stone-700 flex-shrink-0" />
      <div className="w-9 h-9 bg-stone-50 dark:bg-stone-800 rounded-lg flex items-center justify-center flex-shrink-0">
        {feed.last_error
          ? <XCircle className="w-4 h-4 text-red-400" />
          : <Globe className="w-4 h-4 text-stone-400" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">{feed.title}</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${CATEGORY_COLORS[feed.category] || CATEGORY_COLORS.General}`}>
            {feed.category}
          </span>
          {feed.folder_id && folders.find(f => f.id === feed.folder_id) && (
            <span className="text-xs text-amber-600 dark:text-amber-400 flex-shrink-0">
              📁 {folders.find(f => f.id === feed.folder_id).name}
            </span>
          )}
        </div>
        <p className="text-xs text-stone-400 dark:text-stone-500 truncate mb-1">{feed.url}</p>
        <HealthBadge feed={feed} />
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setEditingFeed(feed)}
          className="p-2 text-stone-300 dark:text-stone-600 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors">
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={() => handleDelete(feed.id)} disabled={deletingId === feed.id}
          className="p-2 text-stone-300 dark:text-stone-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-stone-900 dark:text-stone-100">Sources</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
            {feeds.length} feed{feeds.length !== 1 ? 's' : ''}
            {errorFeeds.length > 0 && (
              <span className="ml-2 text-red-500 dark:text-red-400">· {errorFeeds.length} error{errorFeeds.length !== 1 ? 's' : ''}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {feeds.length > 0 && (
            <button onClick={() => setGroupByFolder(v => !v)}
              className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 text-sm font-medium rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors">
              {groupByFolder ? 'List view' : 'Folder view'}
            </button>
          )}
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 text-sm font-medium rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors">
            <Upload className="w-4 h-4" />Import
          </button>
          {feeds.length > 0 && (
            <div className="relative">
              <button onClick={e => { e.stopPropagation(); setShowExportMenu(v => !v) }}
                className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 text-sm font-medium rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors">
                <Download className="w-4 h-4" />Export<ChevronDown className="w-3.5 h-3.5" />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-xl shadow-lg z-10 overflow-hidden">
                  <button onClick={e => { e.stopPropagation(); !canUseFeature('export') ? (setPaywallFeature('export'), setShowPaywall(true), setShowExportMenu(false)) : (downloadFile(generateOPML(feeds), 'myfeedreader-export.opml', 'text/xml'), setShowExportMenu(false)) }}
                    className="w-full px-4 py-2.5 text-left text-sm text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 flex items-center gap-2">
                    <Rss className="w-4 h-4 text-stone-400" />Export as OPML
                  </button>
                  <button onClick={e => { e.stopPropagation(); !canUseFeature('export') ? (setPaywallFeature('export'), setShowPaywall(true), setShowExportMenu(false)) : (downloadFile(generateCSV(feeds), 'myfeedreader-export.csv', 'text/csv'), setShowExportMenu(false)) }}
                    className="w-full px-4 py-2.5 text-left text-sm text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 flex items-center gap-2 border-t border-stone-50 dark:border-stone-700">
                    <Globe className="w-4 h-4 text-stone-400" />Export as CSV
                  </button>
                </div>
              )}
            </div>
          )}
          <button onClick={() => {
          if (!canAddSource(feeds.length)) { setPaywallFeature('sources'); setShowPaywall(true) }
          else setShowAdd(true)
        }}
            className="flex items-center gap-2 px-3 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors">
            <Plus className="w-4 h-4" />Add source
          </button>
        </div>
      </div>

      {/* Health summary */}
      {feeds.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-brand-600">{healthyFeeds.length}</p>
            <p className="text-xs text-stone-500 dark:text-stone-400">Healthy</p>
          </div>
          <div className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-xl p-3 text-center">
            <p className={`text-lg font-bold ${errorFeeds.length > 0 ? 'text-red-500' : 'text-stone-400 dark:text-stone-600'}`}>{errorFeeds.length}</p>
            <p className="text-xs text-stone-500 dark:text-stone-400">Errors</p>
          </div>
          <div className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-stone-400 dark:text-stone-500">{neverFetched.length}</p>
            <p className="text-xs text-stone-500 dark:text-stone-400">Never fetched</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-xl p-4 animate-pulse flex items-center gap-4">
              <div className="w-9 h-9 bg-stone-100 dark:bg-stone-800 rounded-lg" />
              <div className="flex-1">
                <div className="h-4 bg-stone-100 dark:bg-stone-800 rounded w-1/3 mb-2" />
                <div className="h-3 bg-stone-50 dark:bg-stone-800/50 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && feeds.length === 0 && (
        <div className="text-center py-24">
          <div className="w-16 h-16 bg-stone-50 dark:bg-stone-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Rss className="w-7 h-7 text-stone-300 dark:text-stone-600" />
          </div>
          <h3 className="font-semibold text-stone-700 dark:text-stone-300 mb-2">No sources yet</h3>
          <p className="text-sm text-stone-400 dark:text-stone-500 mb-6 max-w-xs mx-auto">Add your first RSS feed, or import an OPML file to bulk-add sources.</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => setShowImport(true)} className="px-4 py-2.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 text-sm font-medium rounded-lg hover:bg-stone-50 flex items-center gap-2 transition-colors">
              Import OPML
            </button>
            <button onClick={() => {
          if (!canAddSource(feeds.length)) { setPaywallFeature('sources'); setShowPaywall(true) }
          else setShowAdd(true)
        }} className="px-4 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors">
              Add first source
            </button>
          </div>
        </div>
      )}

      {/* Feed list */}
      {!loading && feeds.length > 0 && !groupByFolder && (
        <div className="space-y-2">
          {/* Errors first */}
          {errorFeeds.length > 0 && (
            <div>
              <p className="text-xs font-medium text-red-500 dark:text-red-400 mb-2 flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5" />{errorFeeds.length} feed{errorFeeds.length !== 1 ? 's' : ''} with errors
              </p>
              {errorFeeds.map(feed => <FeedRow key={feed.id} feed={feed} />)}
              {(healthyFeeds.length > 0 || neverFetched.length > 0) && <div className="my-3 border-t border-stone-100 dark:border-stone-800" />}
            </div>
          )}
          {[...healthyFeeds, ...neverFetched].map(feed => <FeedRow key={feed.id} feed={feed} />)}
        </div>
      )}

      {/* Folder grouped view */}
      {!loading && feeds.length > 0 && groupByFolder && (
        <div className="space-y-4">
          {Object.values(feedsByFolder).filter(g => g.feeds.length > 0).map(({ folder, feeds: groupFeeds }) => (
            <div key={folder.id || 'unfiled'}>
              <h3 className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                {folder.id ? '📁' : '·'} {folder.name} ({groupFeeds.length})
              </h3>
              <div className="space-y-2">
                {groupFeeds.map(feed => <FeedRow key={feed.id} feed={feed} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {showPaywall && <PaywallModal feature={paywallFeature} onClose={() => setShowPaywall(false)} />}
      {showAdd && <AddFeedModal onClose={() => setShowAdd(false)} onAdded={handleAdded} />}
      {showImport && <ImportOPMLModal onClose={() => setShowImport(false)} onImported={handleImported} />}
      {editingFeed && (
        <EditFeedModal
          feed={editingFeed}
          existingCategories={allCategories}
          onClose={() => setEditingFeed(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  )
}
