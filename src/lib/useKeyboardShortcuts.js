import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export function useKeyboardShortcuts({ onSearch, onHelp } = {}) {
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e) => {
      const tag = e.target.tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return

      switch (e.key) {
        case '/':
        case 'f':
          e.preventDefault()
          onSearch?.()
          break
        case '?':
          e.preventDefault()
          onHelp?.()
          break
        case '1': navigate('/dashboard'); break
        case '2': navigate('/dashboard/digest'); break
        case '3': navigate('/dashboard/sources'); break
        case '4': navigate('/dashboard/bookmarks'); break
        case '5': navigate('/dashboard/read-later'); break
        case '6': navigate('/dashboard/stats'); break
        case '7': navigate('/dashboard/saved'); break
        default: break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, onSearch, onHelp])
}
