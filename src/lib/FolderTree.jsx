import { useState } from 'react'
import { Folder, FolderOpen, ChevronRight, ChevronDown, Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { createFolder, updateFolder, deleteFolder, moveFeedToFolder } from '../lib/feedsService'

export default function FolderTree({ folders, feeds, userId, onRefresh }) {
  const [expandedFolders, setExpandedFolders] = useState({})
  const [editingFolder, setEditingFolder] = useState(null)
  const [editName, setEditName] = useState('')
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [dragOver, setDragOver] = useState(null)

  const toggleFolder = (id) => setExpandedFolders(prev => ({ ...prev, [id]: !prev[id] }))

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    try {
      await createFolder(userId, newFolderName.trim())
      setNewFolderName('')
      setShowNewFolder(false)
      onRefresh()
    } catch {}
  }

  const handleRenameFolder = async (folderId) => {
    if (!editName.trim()) return
    try {
      await updateFolder(folderId, { name: editName.trim() })
      setEditingFolder(null)
      onRefresh()
    } catch {}
  }

  const handleDeleteFolder = async (folderId) => {
    if (!confirm('Delete this folder? Feeds inside will become unfiled.')) return
    try {
      await deleteFolder(folderId)
      onRefresh()
    } catch {}
  }

  // Drag-and-drop: drag a feed card onto a folder
  const handleDragOver = (e, folderId) => {
    e.preventDefault()
    setDragOver(folderId)
  }

  const handleDrop = async (e, folderId) => {
    e.preventDefault()
    setDragOver(null)
    const feedId = e.dataTransfer.getData('feedId')
    if (!feedId) return
    try {
      await moveFeedToFolder(feedId, folderId)
      onRefresh()
    } catch {}
  }

  const feedsInFolder = (folderId) => feeds.filter(f => f.folder_id === folderId)
  const unfiledFeeds = feeds.filter(f => !f.folder_id)

  return (
    <div className="px-3 py-2">
      {/* Folders header */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider px-1">Folders</span>
        <button
          onClick={() => setShowNewFolder(v => !v)}
          className="p-1 text-stone-400 dark:text-stone-500 hover:text-brand-600 dark:hover:text-brand-400 rounded transition-colors"
          title="New folder"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* New folder input */}
      {showNewFolder && (
        <div className="flex gap-1.5 mb-2">
          <input
            autoFocus
            type="text"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreateFolder()
              if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName('') }
            }}
            placeholder="Folder name..."
            className="flex-1 px-2 py-1.5 text-xs border border-brand-300 dark:border-brand-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 placeholder-stone-400"
          />
          <button onClick={handleCreateFolder} disabled={!newFolderName.trim()} className="p-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-40 transition-colors">
            <Check className="w-3 h-3" />
          </button>
          <button onClick={() => { setShowNewFolder(false); setNewFolderName('') }} className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Folder list */}
      <div className="space-y-0.5">
        {folders.map(folder => {
          const folderFeeds = feedsInFolder(folder.id)
          const isExpanded = expandedFolders[folder.id]
          const isEditing = editingFolder === folder.id
          const isDragTarget = dragOver === folder.id

          return (
            <div key={folder.id}>
              {/* Folder row */}
              <div
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg group transition-colors ${
                  isDragTarget
                    ? 'bg-brand-50 dark:bg-brand-900/30 border border-brand-300 dark:border-brand-700'
                    : 'hover:bg-stone-50 dark:hover:bg-stone-800'
                }`}
                onDragOver={e => handleDragOver(e, folder.id)}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => handleDrop(e, folder.id)}
              >
                <button onClick={() => toggleFolder(folder.id)} className="flex-shrink-0 text-stone-400 dark:text-stone-500">
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
                {isExpanded
                  ? <FolderOpen className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  : <Folder className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                }

                {isEditing ? (
                  <input
                    autoFocus
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRenameFolder(folder.id)
                      if (e.key === 'Escape') setEditingFolder(null)
                    }}
                    onBlur={() => handleRenameFolder(folder.id)}
                    className="flex-1 text-xs bg-transparent border-b border-brand-400 dark:border-brand-600 text-stone-900 dark:text-stone-100 focus:outline-none min-w-0"
                  />
                ) : (
                  <span className="flex-1 text-xs text-stone-600 dark:text-stone-400 truncate min-w-0">
                    {folder.name}
                    {folderFeeds.length > 0 && (
                      <span className="ml-1 text-stone-400 dark:text-stone-600">({folderFeeds.length})</span>
                    )}
                  </span>
                )}

                {/* Folder actions - show on hover */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button onClick={() => { setEditingFolder(folder.id); setEditName(folder.name) }}
                    className="p-0.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 rounded transition-colors">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button onClick={() => handleDeleteFolder(folder.id)}
                    className="p-0.5 text-stone-400 hover:text-red-500 rounded transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Feeds inside folder */}
              {isExpanded && folderFeeds.length > 0 && (
                <div className="ml-5 mt-0.5 space-y-0.5">
                  {folderFeeds.map(feed => (
                    <NavLink
                      key={feed.id}
                      to={`/dashboard?feed=${feed.id}`}
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                          isActive
                            ? 'bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-400'
                            : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
                        }`
                      }
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-stone-300 dark:bg-stone-600 flex-shrink-0" />
                      <span className="truncate">{feed.title}</span>
                      {feed.last_error && <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0 ml-auto" title={feed.last_error} />}
                    </NavLink>
                  ))}
                </div>
              )}

              {isExpanded && folderFeeds.length === 0 && (
                <div className="ml-8 px-2 py-1 text-xs text-stone-400 dark:text-stone-600 italic">
                  Empty — drag feeds here
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Unfiled feeds */}
      {unfiledFeeds.length > 0 && (
        <div className="mt-2">
          <span className="text-xs text-stone-400 dark:text-stone-600 px-1">Unfiled ({unfiledFeeds.length})</span>
          <div className="mt-1 space-y-0.5">
            {unfiledFeeds.map(feed => (
              <div
                key={feed.id}
                draggable
                onDragStart={e => e.dataTransfer.setData('feedId', feed.id)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 cursor-grab active:cursor-grabbing transition-colors group"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-stone-300 dark:bg-stone-600 flex-shrink-0" />
                <span className="truncate flex-1">{feed.title}</span>
                {feed.last_error && <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" title={feed.last_error} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
