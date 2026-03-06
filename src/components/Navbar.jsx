import { useState } from 'react'
import { Menu, X, Sparkles } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import Logo from './Logo'

export default function Navbar({ onOpenAuth }) {
  const { user, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-stone-100">
      <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
        {/* Logo */}
        <Logo size="md" />

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">Features</a>
          <a href="#how-it-works" className="text-sm text-stone-500 hover:text-stone-900 transition-colors">How it works</a>
          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-stone-500">{user.email}</span>
              <button
                onClick={signOut}
                className="text-sm text-stone-500 hover:text-stone-900 transition-colors"
              >
                Sign out
              </button>
              <a href="/dashboard" className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors">
                My Feed →
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => onOpenAuth('signin')}
                className="text-sm text-stone-600 hover:text-stone-900 font-medium transition-colors"
              >
                Sign in
              </button>
              <button
                onClick={() => onOpenAuth('signup')}
                className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Get started free
              </button>
            </div>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button className="md:hidden p-2 text-stone-500" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-stone-100 px-5 py-4 flex flex-col gap-4">
          <a href="#features" className="text-sm text-stone-600">Features</a>
          <a href="#how-it-works" className="text-sm text-stone-600">How it works</a>
          <hr className="border-stone-100" />
          {user ? (
            <button onClick={signOut} className="text-sm text-left text-stone-600">Sign out</button>
          ) : (
            <>
              <button onClick={() => { onOpenAuth('signin'); setMenuOpen(false) }} className="text-sm text-left text-stone-600">Sign in</button>
              <button
                onClick={() => { onOpenAuth('signup'); setMenuOpen(false) }}
                className="px-4 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg text-center"
              >
                Get started free
              </button>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
