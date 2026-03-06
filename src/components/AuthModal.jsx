import { useState } from 'react'
import { X, Mail, Lock, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function AuthModal({ mode, onClose, onSwitchMode }) {
  const { signUp, signIn } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')

  const isSignUp = mode === 'signup'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setSuccess('')
    setLoading(true)
    try {
      if (isSignUp) {
        const { error } = await signUp(email, password)
        if (error) throw error
        setSuccess("Account created! Check your email to confirm, then sign in.")
      } else {
        const { error } = await signIn(email, password)
        if (error) throw error
        onClose()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-stone-900 rounded-2xl shadow-2xl w-full max-w-md p-8">
        <button onClick={onClose}
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800">
          <X className="w-4 h-4" />
        </button>

        <div className="mb-8">
          <h2 className="font-display font-bold text-2xl text-stone-900 dark:text-stone-100 mb-1">
            {isSignUp ? 'Create your feed' : 'Welcome back'}
          </h2>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {isSignUp
              ? "Sign up in seconds — we'll personalise your experience after."
              : 'Sign in to access your feed.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                required autoFocus placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-stone-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                required placeholder="••••••••" minLength={6}
                className="w-full pl-10 pr-4 py-2.5 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-stone-400" />
            </div>
            {isSignUp && <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">Minimum 6 characters</p>}
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 p-3 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 rounded-lg text-sm">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />{success}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-60 text-sm">
            {loading ? 'Please wait...' : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-stone-500 dark:text-stone-400">
          {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          <button onClick={() => { setError(''); setSuccess(''); onSwitchMode(isSignUp ? 'signin' : 'signup') }}
            className="text-brand-600 dark:text-brand-400 font-medium hover:underline">
            {isSignUp ? 'Sign in' : 'Sign up free'}
          </button>
        </p>
      </div>
    </div>
  )
}
