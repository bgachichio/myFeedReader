import { Rss } from 'lucide-react'

const SIZES = {
  sm: { icon: 'w-4 h-4', text: 'text-base' },
  md: { icon: 'w-5 h-5', text: 'text-xl'  },
  lg: { icon: 'w-6 h-6', text: 'text-2xl' },
}

export default function Logo({ size = 'md', className = '' }) {
  const s = SIZES[size] || SIZES.md
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
        <Rss className={`${s.icon} text-white`} />
      </div>
      <span className={`${s.text} font-bold tracking-tight`}>
        <span className="text-stone-900 dark:text-stone-100">my</span>
        <span className="text-brand-600">Feed</span>
        <span className="text-stone-900 dark:text-stone-100">Reader</span>
      </span>
    </div>
  )
}
