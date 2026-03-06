// myFeedReader Service Worker v2
// Cache names updated — busts all previously cached myfeed-v1 files

const CACHE_NAME = 'myfeedreader-v2'
const STATIC_CACHE = 'myfeedreader-static-v2'

const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// ── Install ───────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

// ── Activate — delete ALL old caches ─────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== STATIC_CACHE)
          .map(key => {
            console.log('[SW] Deleting old cache:', key)
            return caches.delete(key)
          })
      )
    ).then(() => self.clients.claim())
  )
})

// ── Fetch ─────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET') return

  // Never intercept Supabase, fonts, or RSS proxies
  if (url.hostname.includes('supabase.co') ||
      url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com') ||
      url.hostname.includes('allorigins.win') ||
      url.hostname.includes('rss2json.com') ||
      url.hostname.includes('corsproxy.io') ||
      url.hostname.includes('microlink.io')) return

  // Navigation: network-first so updates deploy immediately
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
          return response
        })
        .catch(() => caches.match('/') || caches.match(request))
    )
    return
  }

  // Static assets (JS/CSS/images): cache-first
  if (url.pathname.match(/\.(js|css|png|svg|ico|woff2?)$/)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(response => {
          const clone = response.clone()
          caches.open(STATIC_CACHE).then(cache => cache.put(request, clone))
          return response
        })
      })
    )
    return
  }
})
