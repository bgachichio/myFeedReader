import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')  ?? ''
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function respond(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timeout after ${ms}ms`)), ms)),
  ])
}

// ── URL type detection ────────────────────────────────────────────

function isXPost(url: string): boolean {
  try {
    const h = new URL(url).hostname.replace('www.', '')
    return h === 'x.com' || h === 'twitter.com'
  } catch { return false }
}

function isSubstack(url: string): boolean {
  try {
    const h = new URL(url).hostname
    return h.endsWith('.substack.com') || h === 'substack.com'
  } catch { return false }
}

function isJsOnlySite(url: string): boolean {
  // Sites where generic proxy fetch is useless — handled by dedicated extractors or skipped
  const blocked = ['linkedin.com', 'instagram.com', 'tiktok.com', 'facebook.com']
  try {
    const h = new URL(url).hostname.replace('www.', '')
    return blocked.some(s => h === s || h.endsWith('.' + s))
  } catch { return false }
}

// ── Resolve shortlinks ────────────────────────────────────────────
async function resolveUrl(url: string): Promise<string> {
  const shorteners = ['t.co', 'bit.ly', 'tinyurl.com', 'ow.ly', 'buff.ly', 'dlvr.it']
  try {
    const hostname = new URL(url).hostname.replace('www.', '')
    if (!shorteners.some(s => hostname === s)) return url
    const res = await withTimeout(fetch(url, { method: 'HEAD', redirect: 'follow' }), 3000)
    const finalUrl = res.url || url
    console.log(`[resolve] ${url} → ${finalUrl}`)
    return finalUrl
  } catch { return url }
}

// ── X / Twitter extractor ─────────────────────────────────────────
// Uses the free oEmbed endpoint — no auth required, returns tweet text
async function extractXPost(url: string): Promise<EnrichedData> {
  // Normalise: x.com → twitter.com (oEmbed only accepts twitter.com)
  const twitterUrl = url.replace('x.com', 'twitter.com')

  const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(twitterUrl)}&omit_script=true`
  const res = await withTimeout(fetch(oembedUrl), 5000)
  if (!res.ok) throw new Error(`X oEmbed ${res.status}`)
  const json = await res.json()

  // oEmbed returns HTML like: <p>tweet text</p><a href...>...
  // Extract plain text from the HTML
  const html: string = json.html || ''
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<a[^>]*>.*?<\/a>/gi, '')  // remove links
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ').trim()

  const author = json.author_name ? `@${json.author_name}` : null

  return {
    title:    author ? `${author} on X` : 'Post on X',
    excerpt:  text.slice(0, 280),
    author,
    fullText: text.length > 20 ? text : null,
    source:   'x-oembed',
  }
}

// ── Substack extractor ────────────────────────────────────────────
// Substack embeds article content in __NEXT_DATA__ JSON in the HTML
// No JS rendering needed — the data is there in the raw HTML
async function extractSubstack(url: string): Promise<EnrichedData> {
  // Try direct fetch first (Substack often allows it)
  const res = await withTimeout(fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; myfeedreader/1.0)',
      'Accept': 'text/html',
    }
  }), 6000)

  if (!res.ok) throw new Error(`Substack fetch ${res.status}`)
  const html = await res.text()

  // Strategy 1: Extract from __NEXT_DATA__ JSON blob
  const nextDataMatch = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (nextDataMatch?.[1]) {
    try {
      const nextData = JSON.parse(nextDataMatch[1])
      // Substack stores post in props.pageProps.post
      const post = nextData?.props?.pageProps?.post
      if (post) {
        const bodyText = post.body_text || post.truncated_body_text || ''
        const title    = post.title || null
        const subtitle = post.subtitle || null
        const author   = post.publishedBylines?.[0]?.name || post.author?.name || null

        return {
          title,
          excerpt:  subtitle || bodyText.slice(0, 300) || null,
          author,
          fullText: bodyText.length > 100 ? bodyText.slice(0, 10000) : null,
          source:   'substack-nextdata',
        }
      }
    } catch (e) {
      console.warn('[substack] __NEXT_DATA__ parse failed:', e)
    }
  }

  // Strategy 2: Extract from og: meta + article body selectors
  const title   = extractMeta(html, 'og:title') || extractMeta(html, 'twitter:title')
  const excerpt = extractMeta(html, 'og:description') || extractMeta(html, 'twitter:description')
  const author  = extractMeta(html, 'author') || extractMeta(html, 'article:author')

  // Substack article body is in .available-content or article tag
  const bodyMatch = html.match(/<div[^>]+class="[^"]*available-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
    || html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
  const fullText = bodyMatch ? htmlToText(bodyMatch[1]).slice(0, 10000) : null

  if (!title && !fullText) throw new Error('Substack: no content extracted')

  return { title, excerpt, author, fullText, source: 'substack-html' }
}

// ── Generic HTML extractors (existing, unchanged) ─────────────────
function extractMeta(html: string, prop: string): string | null {
  const p = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pats = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']{1,500})["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']{1,500})["'][^>]+(?:property|name)=["']${p}["']`, 'i'),
  ]
  for (const re of pats) {
    const m = html.match(re)
    if (m?.[1]) return m[1].trim()
  }
  return null
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s{3,}/g, '\n\n').trim()
    .slice(0, 10000)
}

async function tryMicrolink(url: string) {
  const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&meta=true&video=false&audio=false&screenshot=false&insights=false`
  const res = await fetch(apiUrl)
  if (!res.ok) throw new Error(`microlink ${res.status}`)
  const json = await res.json()
  if (json.status !== 'success') throw new Error('microlink: ' + (json.message || 'failed'))
  const d = json.data
  return {
    title:    d.title || null,
    excerpt:  d.description || null,
    author:   d.author || null,
    fullText: (d.content && d.content.length > 200) ? d.content.slice(0, 10000) : null,
    source:   'microlink',
  }
}

async function tryAllOrigins(url: string) {
  const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`)
  if (!res.ok) throw new Error(`allorigins ${res.status}`)
  const json = await res.json()
  const html = (json.contents as string) || ''
  if (html.length < 300) throw new Error('allorigins: too short')
  const text = htmlToText(html)
  return {
    title:    extractMeta(html, 'og:title') || extractMeta(html, 'twitter:title'),
    excerpt:  extractMeta(html, 'og:description') || extractMeta(html, 'description'),
    author:   extractMeta(html, 'author') || extractMeta(html, 'article:author') || null,
    fullText: text.length > 300 ? text : null,
    source:   'allorigins',
  }
}

async function tryCorsproxy(url: string) {
  const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`)
  if (!res.ok) throw new Error(`corsproxy ${res.status}`)
  const html = await res.text()
  if (html.length < 300) throw new Error('corsproxy: too short')
  const text = htmlToText(html)
  return {
    title:    extractMeta(html, 'og:title') || extractMeta(html, 'twitter:title'),
    excerpt:  extractMeta(html, 'og:description') || extractMeta(html, 'description'),
    author:   extractMeta(html, 'author') || extractMeta(html, 'article:author') || null,
    fullText: text.length > 300 ? text : null,
    source:   'corsproxy',
  }
}

type EnrichedData = {
  title: string | null
  excerpt: string | null
  author: string | null
  fullText: string | null
  source?: string
}

function mergeResults(results: EnrichedData[]): EnrichedData {
  const out: EnrichedData = { title: null, excerpt: null, author: null, fullText: null }
  for (const r of results) {
    if (!out.title   && r.title)   out.title   = r.title
    if (!out.excerpt && r.excerpt) out.excerpt = r.excerpt
    if (!out.author  && r.author)  out.author  = r.author
    if (r.fullText && (!out.fullText || r.fullText.length > out.fullText.length)) {
      out.fullText = r.fullText
    }
  }
  return out
}

// ── Main handler ──────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: CORS })
  if (req.method !== 'POST')   return respond({ error: 'Method not allowed' }, 405)

  // 1. Authenticate
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return respond({ error: 'Unauthorized — no token' }, 401)

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: { user }, error: authErr } = await sb.auth.getUser(jwt)
  if (authErr || !user) {
    console.error('[save-article] auth failed:', authErr?.message)
    return respond({ error: 'Unauthorized' }, 401)
  }

  // 2. Parse body + extract URL
  let body: any = {}
  try { body = await req.json() } catch { /* no body */ }

  let url = (body.url ?? '').trim()
  if (!url.startsWith('http')) {
    const textField = (body.text ?? '').trim()
    const urlMatch = textField.match(/https?:\/\/[^\s]+/)
    if (urlMatch) url = urlMatch[0]
  }
  if (!url.startsWith('http')) return respond({ error: 'A valid http/https URL is required' }, 400)

  const passedTitle = (body.title ?? '').trim()
  const passedText  = (body.text  ?? '').trim()

  console.log(`[save-article] user=${user.id} url=${url}`)

  // 3. Resolve shortlinks
  const resolvedUrl = await resolveUrl(url)
  const finalUrlIsX = isXPost(resolvedUrl)

  // ── PHASE 1: Save immediately ────────────────────────────────────
  const initialTitle = passedTitle || resolvedUrl
  const { data: savedRow, error: saveErr } = await sb
    .from('saved_articles')
    .upsert(
      { user_id: user.id, url: resolvedUrl, title: initialTitle },
      { onConflict: 'user_id,url' }
    )
    .select('id')
    .single()

  if (saveErr) {
    const { data: insertRow, error: insertErr } = await sb
      .from('saved_articles')
      .insert({ user_id: user.id, url: resolvedUrl, title: initialTitle })
      .select('id').single()
    if (insertErr) return respond({ error: 'Failed to save: ' + insertErr.message }, 500)
    return enrichAndUpdate(sb, insertRow.id, resolvedUrl, passedTitle, passedText, finalUrlIsX)
  }

  return enrichAndUpdate(sb, savedRow.id, resolvedUrl, passedTitle, passedText, finalUrlIsX)
})

// ── Phase 2: Enrich + update ──────────────────────────────────────
async function enrichAndUpdate(
  sb: any, articleId: string, url: string,
  passedTitle: string, passedText: string, isX: boolean,
): Promise<Response> {

  let enriched: EnrichedData = {
    title:   passedTitle || null,
    excerpt: passedText  || null,
    author:  null,
    fullText: null,
  }

  try {
    if (isX || isXPost(url)) {
      // ── X / Twitter: use oEmbed API ──────────────────────────────
      console.log('[enrich] X post — using oEmbed')
      try {
        enriched = { ...enriched, ...await extractXPost(url) }
      } catch (e) {
        console.warn('[enrich] X oEmbed failed:', (e as Error).message)
      }

    } else if (isSubstack(url)) {
      // ── Substack: dedicated extractor ───────────────────────────
      console.log('[enrich] Substack — using dedicated extractor')
      try {
        enriched = { ...enriched, ...await extractSubstack(url) }
      } catch (e) {
        console.warn('[enrich] Substack failed, falling back to proxies:', (e as Error).message)
        // Fall back to generic proxies
        const results = await withTimeout(
          Promise.allSettled([tryMicrolink(url), tryAllOrigins(url), tryCorsproxy(url)]),
          5000
        )
        const ok = results
          .filter((r): r is PromiseFulfilledResult<EnrichedData> => r.status === 'fulfilled')
          .map(r => r.value)
        if (ok.length > 0) enriched = { ...enriched, ...mergeResults(ok) }
      }

    } else if (!isJsOnlySite(url)) {
      // ── Generic article: race all proxies ────────────────────────
      console.log('[enrich] generic — racing proxies')
      const results = await withTimeout(
        Promise.allSettled([tryMicrolink(url), tryAllOrigins(url), tryCorsproxy(url)]),
        5000
      )
      const ok = results
        .filter((r): r is PromiseFulfilledResult<EnrichedData> => r.status === 'fulfilled')
        .map(r => r.value)
      results
        .filter(r => r.status === 'rejected')
        .forEach(r => console.warn('[enrich]', (r as PromiseRejectedResult).reason?.message))
      if (ok.length > 0) enriched = { ...enriched, ...mergeResults(ok) }

    } else {
      console.log(`[enrich] skipping JS-only site: ${url}`)
    }
  } catch (err) {
    console.warn('[enrich] outer error:', (err as Error).message)
  }

  // ── Phase 3: Write enriched data ─────────────────────────────────
  const finalTitle = enriched.title || passedTitle || url
  const wordCount  = enriched.fullText?.split(/\s+/).length ?? 0
  const readingMin = wordCount > 0 ? Math.max(1, Math.ceil(wordCount / 238)) : null

  const update: Record<string, unknown> = { title: finalTitle }
  if (enriched.excerpt)  update.excerpt  = enriched.excerpt
  if (enriched.author)   update.author   = enriched.author
  if (enriched.fullText) update.full_text = enriched.fullText
  if (readingMin)        update.reading_time_min = readingMin
  if (enriched.fullText) update.fetched_at = new Date().toISOString()

  const { error: updateErr } = await sb
    .from('saved_articles').update(update).eq('id', articleId)
  if (updateErr) console.warn('[save-article] update failed:', updateErr.message)

  console.log(`[save-article] done — id=${articleId} source=${enriched.source || 'generic'} fullText=${enriched.fullText ? enriched.fullText.length + 'ch' : 'none'}`)

  return new Response(
    JSON.stringify({
      success: true, id: articleId, title: finalTitle,
      enriched: !!enriched.fullText, source: enriched.source || null,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } }
  )
}
