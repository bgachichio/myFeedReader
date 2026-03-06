/**
 * fetch-feeds — Server-side RSS/Atom fetcher
 * No CORS, no proxies. Direct fetch from Supabase edge runtime.
 * POST { feeds: [{id, url}] } → { results: [{feedId, feedTitle, items} | {feedId, error}] }
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const FETCH_TIMEOUT_MS = 10000
const MAX_ITEMS = 20

function respond(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timeout ${ms}ms`)), ms)),
  ])
}

// ── Regex-based XML helpers (Deno has no DOMParser) ──────────────

function cdataOrTag(xml: string, tag: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`<${escaped}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${escaped}>`, 'i'),
    new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i'),
  ]
  for (const re of patterns) {
    const m = xml.match(re)
    if (m?.[1]?.trim()) return m[1].trim()
  }
  return ''
}

function getAttr(tag: string, attr: string): string {
  const re = new RegExp(`${attr}=["']([^"']+)["']`, 'i')
  return tag.match(re)?.[1]?.trim() || ''
}

function stripHtml(html: string): string {
  return html
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ').trim()
}

function cleanContent(raw: string): string {
  return raw.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/\s{3,}/g, '\n\n').trim().slice(0, 8000)
}

function splitBlocks(xml: string, tag: string): string[] {
  const blocks: string[] = []
  const open = `<${tag}`, close = `</${tag}>`
  let pos = 0
  while (pos < xml.length) {
    const s = xml.indexOf(open, pos)
    if (s === -1) break
    const e = xml.indexOf(close, s)
    if (e === -1) break
    blocks.push(xml.slice(s, e + close.length))
    pos = e + close.length
  }
  return blocks
}

function parseRSS(xml: string, feedUrl: string) {
  const feedTitle = stripHtml(cdataOrTag(xml, 'title')) || feedUrl
  return {
    feedTitle,
    items: splitBlocks(xml, 'item').slice(0, MAX_ITEMS).map(item => {
      const encoded = cdataOrTag(item, 'content:encoded') || cdataOrTag(item, 'encoded')
      const desc = cdataOrTag(item, 'description')
      const raw = encoded || desc
      const link = (cdataOrTag(item, 'link') || getAttr(item, 'href') || feedUrl).trim()
      return {
        title: stripHtml(cdataOrTag(item, 'title')) || 'Untitled',
        link,
        description: stripHtml(raw).slice(0, 280),
        fullContent: cleanContent(raw),
        pubDate: cdataOrTag(item, 'pubDate') || cdataOrTag(item, 'dc:date') || '',
        author: cdataOrTag(item, 'author') || cdataOrTag(item, 'dc:creator') || '',
        guid: (cdataOrTag(item, 'guid') || link).trim(),
      }
    }),
  }
}

function parseAtom(xml: string, feedUrl: string) {
  const feedTitle = stripHtml(cdataOrTag(xml, 'title')) || feedUrl
  return {
    feedTitle,
    items: splitBlocks(xml, 'entry').slice(0, MAX_ITEMS).map(entry => {
      const raw = cdataOrTag(entry, 'content') || cdataOrTag(entry, 'summary')
      const linkMatch = entry.match(/<link[^>]+href=["']([^"']+)["'][^>]*(?:rel=["']alternate["'])?/i)
        || entry.match(/<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["']/i)
      const link = (linkMatch?.[1] || feedUrl).trim()
      return {
        title: stripHtml(cdataOrTag(entry, 'title')) || 'Untitled',
        link,
        description: stripHtml(raw).slice(0, 280),
        fullContent: cleanContent(raw),
        pubDate: cdataOrTag(entry, 'updated') || cdataOrTag(entry, 'published') || '',
        author: cdataOrTag(entry, 'name') || '',
        guid: (cdataOrTag(entry, 'id') || link).trim(),
      }
    }),
  }
}

async function fetchOneFeed(url: string) {
  const res = await withTimeout(
    fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; myfeedreader/1.0; +https://myfeedreader.com)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
      redirect: 'follow',
    }),
    FETCH_TIMEOUT_MS
  )
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const xml = await res.text()
  if (!xml || xml.length < 100) throw new Error('Empty response')
  return /<feed[\s>]/i.test(xml) ? parseAtom(xml, url) : parseRSS(xml, url)
}

// ── Main ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: CORS })
  if (req.method !== 'POST') return respond({ error: 'POST required' }, 405)

  // Verify request has a valid Authorization header (anon key or user JWT)
  // fetch-feeds only reads external RSS URLs — no user data is accessed
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return respond({ error: 'Unauthorized' }, 401)

  let body: any = {}
  try { body = await req.json() } catch { return respond({ error: 'Invalid JSON' }, 400) }

  const feeds: Array<{ id: string; url: string }> = body.feeds || []
  if (!feeds.length) return respond({ error: 'No feeds provided' }, 400)

  console.log(`[fetch-feeds] feeds=${feeds.length}`)

  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      try {
        const data = await fetchOneFeed(feed.url)
        return { feedId: feed.id, feedTitle: data.feedTitle, items: data.items }
      } catch (e) {
        console.warn(`[fetch-feeds] FAIL ${feed.url}: ${(e as Error).message}`)
        return { feedId: feed.id, items: [], error: (e as Error).message }
      }
    })
  )

  const output = results.map(r =>
    r.status === 'fulfilled' ? r.value : { error: (r.reason as Error).message, items: [] }
  )

  console.log(`[fetch-feeds] ok=${output.filter(r => !r.error).length} fail=${output.filter(r => r.error).length}`)
  return respond({ results: output })
})
