import React from 'react'
import { Coffee, Heart } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="w-full border-t border-gray-100 bg-white py-4 px-6">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-sm text-gray-500 flex items-center gap-1.5">
          Made with <Heart size={13} className="text-red-500 fill-red-500" /> by{' '}
          <a
            href="https://linkedin.com/in/briangachichio/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-gray-700 hover:text-[#237352] transition-colors"
          >
            Brian Gachichio
          </a>
        </p>
        <a
          href="https://paystack.shop/pay/gachichio"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:border-[#237352] hover:text-[#237352] hover:bg-[#f0f9f4] transition-all duration-150 shadow-sm"
        >
          <Coffee size={14} />
          Support
        </a>
      </div>
    </footer>
  )
}
