import { useEffect, useState, useCallback } from 'react'
import { NavLink } from 'react-router-dom'
import { Rss, LayoutDashboard, Bookmark, Plus, LogOut, BookOpen, BookMarked, BarChart2, Search, Sun, Moon, Menu, X, Keyboard } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useUnread } from '../contexts/UnreadContext'
import { useTheme } from '../contexts/ThemeContext'
import { getFeeds, getFolders } from '../lib/feedsService'
import FolderTree from './FolderTree'

export default function Sidebar({ onAddFeed, onSearch, onHelp, mobileOpen, onMobileClose }) {
  const { user, signOut } = useAuth()
  const { unreadCount, refreshUnreadCount } = useUnread()
  const { dark, toggleTheme } = useTheme()
  const [folders, setFolders] = useState([])
  const [feeds, setFeeds] = useState([])
  const [showFolders, setShowFolders] = useState(true)

  useEffect(() => {
    refreshUnreadCount()
    loadFoldersAndFeeds()
  }, [refreshUnreadCount])

  const loadFoldersAndFeeds = useCallback(async () => {
    try {
      const [f, fd] = await Promise.all([getFolders(user.id), getFeeds(user.id)])
      setFolders(f)
      setFeeds(fd)
    } catch {}
  }, [user.id])

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'My Feed', end: true, badge: unreadCount > 0 ? unreadCount : null },
    { to: '/dashboard/digest', icon: BookOpen, label: 'Daily Digest', end: true },
    { to: '/dashboard/read-later', icon: BookMarked, label: 'Read Later', end: true },
    { to: '/dashboard/bookmarks', icon: Bookmark, label: 'Bookmarks' },
    { to: '/dashboard/sources', icon: Rss, label: 'Sources' },
    { to: '/dashboard/stats', icon: BarChart2, label: 'Stats' },
  ]

  const sidebarContent = (
    <aside className="h-full flex flex-col bg-white dark:bg-stone-900 border-r border-stone-100 dark:border-stone-800">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center">
            <Rss className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-display font-bold text-lg text-stone-900 dark:text-stone-100">
            my<span className="text-brand-600">Feed</span>
          </span>
        </div>
        {onMobileClose && (
          <button onClick={onMobileClose} className="md:hidden p-1 text-stone-400 hover:text-stone-600 rounded">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search + Add */}
      <div className="px-3 py-3 space-y-1.5">
        <button onClick={onSearch}
          className="w-full flex items-center gap-2 px-3 py-2 bg-stone-50 dark:bg-stone-800 text-stone-500 dark:text-stone-400 text-sm rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors">
          <Search className="w-4 h-4" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="text-xs bg-stone-200 dark:bg-stone-700 text-stone-500 dark:text-stone-400 px-1.5 py-0.5 rounded font-mono">/</kbd>
        </button>
        <button onClick={onAddFeed}
          className="w-full flex items-center gap-2 px-3 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors">
          <Plus className="w-4 h-4" />Add source
        </button>
      </div>

      {/* Scrollable nav area */}
      <div className="flex-1 overflow-y-auto">
        {/* Main nav */}
        <nav className="px-3 py-2 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label, end, badge }) => (
            <NavLink key={to} to={to} end={end} onClick={onMobileClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-400 font-medium'
                    : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {badge && (
                <span className="min-w-[20px] h-5 px-1.5 bg-brand-600 text-white text-xs font-medium rounded-full flex items-center justify-center">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Divider */}
        <div className="mx-3 border-t border-stone-100 dark:border-stone-800 my-1" />

        {/* Folders section */}
        <FolderTree
          folders={folders}
          feeds={feeds}
          userId={user.id}
          onRefresh={loadFoldersAndFeeds}
        />
      </div>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-stone-100 dark:border-stone-800 space-y-1">
        <button onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {dark ? 'Light mode' : 'Dark mode'}
        </button>
        <button onClick={onHelp}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">
          <Keyboard className="w-4 h-4" />
          <span className="flex-1 text-left">Shortcuts</span>
          <kbd className="text-xs bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 px-1.5 py-0.5 rounded font-mono text-stone-500 dark:text-stone-400">?</kbd>
        </button>
        <div className="px-3 py-1">
          <p className="text-xs text-stone-400 dark:text-stone-600 truncate">{user?.email}</p>
        </div>
        <button onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">
          <LogOut className="w-4 h-4" />Sign out
        </button>
      </div>
    </aside>
  )

  return (
    <>
      <div className="hidden md:block fixed left-0 top-0 h-full w-56 z-40">
        {sidebarContent}
      </div>
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={onMobileClose} />
          <div className="relative w-64 h-full shadow-xl">{sidebarContent}</div>
        </div>
      )}
    </>
  )
}
