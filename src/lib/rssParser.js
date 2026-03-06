// CORS proxies — all tried simultaneously, first to succeed wins
const PROXIES = [
  (url) => `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
]

const FETCH_TIMEOUT_MS = 8000

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
  ])
}

async function fetchWithRss2Json(url) {
  const response = await fetch(PROXIES[0](url))
  if (!response.ok) throw new Error('rss2json failed')
  const data = await response.json()
  if (data.status !== 'ok') throw new Error('rss2json error: ' + data.message)
  return {
    feedTitle: data.feed?.title || url,
    feedDescription: data.feed?.description || '',
    items: (data.items || []).slice(0, 20).map(item => ({
      title: item.title || 'Untitled',
      link: item.link || '#',
      // Preserve full content — don't truncate here
      description: stripHtml(item.description || item.content || '').slice(0, 280),
      fullContent: cleanHtml(item.content || item.description || ''),
      pubDate: item.pubDate || '',
      author: item.author || '',
      guid: item.guid || item.link || Math.random().toString(),
    })),
  }
}

async function fetchWithProxy(proxyFn, url) {
  const response = await fetch(proxyFn(url))
  if (!response.ok) throw new Error('Proxy request failed')
  const contentType = response.headers.get('content-type') || ''
  let xml
  if (contentType.includes('json')) {
    const data = await response.json()
    xml = data.contents || data.body || ''
  } else {
    xml = await response.text()
  }
  if (!xml) throw new Error('Empty response from proxy')
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('Invalid XML')
  const isAtom = doc.querySelector('feed') !== null
  return isAtom ? parseAtom(doc, url) : parseRSS(doc, url)
}

// Race all proxies simultaneously — first to succeed wins
export async function fetchRSSFeed(url) {
  const attempts = [
    withTimeout(fetchWithRss2Json(url), FETCH_TIMEOUT_MS),
    withTimeout(fetchWithProxy(PROXIES[1], url), FETCH_TIMEOUT_MS),
    withTimeout(fetchWithProxy(PROXIES[2], url), FETCH_TIMEOUT_MS),
  ]
  try {
    return await Promise.any(attempts)
  } catch {
    throw new Error('Could not fetch this feed — all proxies failed.')
  }
}

function parseRSS(doc, feedUrl) {
  const channel = doc.querySelector('channel')
  if (!channel) throw new Error('No channel found in RSS feed')
  return {
    feedTitle: channel.querySelector('title')?.textContent || feedUrl,
    feedDescription: channel.querySelector('description')?.textContent || '',
    items: [...doc.querySelectorAll('item')].slice(0, 20).map(item => {
      // content:encoded is the standard full-text field in RSS
      const encoded = item.getElementsByTagNameNS('*', 'encoded')[0]?.textContent || ''
      const rawContent = encoded || item.querySelector('content')?.textContent || item.querySelector('description')?.textContent || ''
      return {
        title: item.querySelector('title')?.textContent?.trim() || 'Untitled',
        link: item.querySelector('link')?.textContent?.trim() || item.querySelector('link')?.getAttribute('href') || '#',
        description: stripHtml(rawContent).slice(0, 280),
        fullContent: cleanHtml(rawContent),
        pubDate: item.querySelector('pubDate')?.textContent || item.querySelector('dc\\:date')?.textContent || '',
        author: item.querySelector('author')?.textContent || item.querySelector('dc\\:creator')?.textContent || '',
        guid: item.querySelector('guid')?.textContent || item.querySelector('link')?.textContent || Math.random().toString(),
      }
    }),
  }
}

function parseAtom(doc, feedUrl) {
  return {
    feedTitle: doc.querySelector('feed > title')?.textContent || feedUrl,
    feedDescription: doc.querySelector('feed > subtitle')?.textContent || '',
    items: [...doc.querySelectorAll('entry')].slice(0, 20).map(entry => {
      const rawContent = entry.querySelector('content')?.textContent || entry.querySelector('summary')?.textContent || ''
      return {
        title: entry.querySelector('title')?.textContent?.trim() || 'Untitled',
        link: entry.querySelector('link')?.getAttribute('href') || '#',
        description: stripHtml(rawContent).slice(0, 280),
        fullContent: cleanHtml(rawContent),
        pubDate: entry.querySelector('updated')?.textContent || entry.querySelector('published')?.textContent || '',
        author: entry.querySelector('author > name')?.textContent || '',
        guid: entry.querySelector('id')?.textContent || Math.random().toString(),
      }
    }),
  }
}

function stripHtml(html) {
  if (!html) return ''
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return doc.body?.textContent?.trim() || ''
  } catch {
    return html.replace(/<[^>]+>/g, '').trim()
  }
}

// Clean HTML content — strip tags but preserve paragraphs as newlines
function cleanHtml(html) {
  if (!html) return ''
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    doc.querySelectorAll('p, br, li, h1, h2, h3, h4, h5, h6, blockquote').forEach(el => {
      el.insertAdjacentText('beforebegin', '\n')
    })
    const text = doc.body?.textContent?.trim() || ''
    return text
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim()
  } catch { return '' }
}

export async function validateFeedUrl(url) {
  try {
    const result = await fetchRSSFeed(url)
    return { valid: true, title: result.feedTitle }
  } catch {
    return { valid: false, title: null }
  }
}
