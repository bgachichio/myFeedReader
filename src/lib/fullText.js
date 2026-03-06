/**
 * Full-text fetching — three-tier strategy:
 *
 * Tier 1 (instant):  Use full_content already stored in the article from the RSS feed.
 *                    Many feeds (Substack, WordPress, Medium, most blogs) include
 *                    the complete article in <content:encoded>. Zero network calls.
 *
 * Tier 2 (fast):     Race three proxy strategies simultaneously — first to respond wins.
 *                    Falls back to this only when RSS content is thin (<300 chars).
 */

const TIMEOUT_MS = 5000
const MIN_CONTENT_LENGTH = 300  // Below this, RSS content is just a teaser — go fetch more

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ])
}

// ── Tier 2 strategies (all race simultaneously) ───────────────────

async function tryMicrolink(url) {
  const res = await fetch(
    `https://api.microlink.io/?url=${encodeURIComponent(url)}&meta=false&video=false&audio=false&screenshot=false`
  )
  if (!res.ok) throw new Error('microlink failed')
  const json = await res.json()
  if (json.status !== 'success') throw new Error('microlink error')
  const content = json.data?.content || json.data?.description
  if (!content || content.length < 100) throw new Error('too short')
  return cleanText(content)
}

async function tryAllOrigins(url) {
  const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`)
  if (!res.ok) throw new Error('allorigins failed')
  const json = await res.json()
  const extracted = extractFromHTML(json.contents || '')
  if (!extracted || extracted.length < 150) throw new Error('extraction too short')
  return extracted
}

async function tryCorsproxy(url) {
  const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`)
  if (!res.ok) throw new Error('corsproxy failed')
  const html = await res.text()
  const extracted = extractFromHTML(html)
  if (!extracted || extracted.length < 150) throw new Error('extraction too short')
  return extracted
}

// ── Main export ───────────────────────────────────────────────────

/**
 * @param {string} articleUrl  - The article's URL (used for Tier 2 fetch)
 * @param {string|null} storedContent - full_content from the DB (from RSS feed)
 */
export async function fetchFullText(articleUrl, storedContent = null) {
  // ── Tier 1: Use content already in the RSS feed (instant) ──────
  if (storedContent && storedContent.trim().length >= MIN_CONTENT_LENGTH) {
    return { content: cleanText(storedContent), source: 'rss' }
  }

  // ── Tier 2: Race all proxy strategies ─────────────────────────
  try {
    const content = await Promise.any([
      withTimeout(tryMicrolink(articleUrl), TIMEOUT_MS),
      withTimeout(tryAllOrigins(articleUrl), TIMEOUT_MS),
      withTimeout(tryCorsproxy(articleUrl), TIMEOUT_MS),
    ])
    return { content, source: 'proxy' }
  } catch {
    // If proxy fetch failed but RSS had *something*, use it anyway
    if (storedContent && storedContent.trim().length > 50) {
      return { content: cleanText(storedContent), source: 'rss-partial' }
    }
    return null
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function extractFromHTML(html) {
  if (!html) return null
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    ;['script','style','nav','header','footer','aside',
      '[class*="ad-"]','[id*="ad-"]','[class*="sidebar"]',
      '[class*="comment"]','[class*="related"]','[class*="share"]',
      '[class*="social"]','[class*="newsletter"]','[class*="popup"]'
    ].forEach(sel => doc.querySelectorAll(sel).forEach(el => el.remove()))

    const selectors = [
      'article','[itemprop="articleBody"]',
      '[class*="article-body"]','[class*="article-content"]',
      '[class*="post-content"]','[class*="entry-content"]',
      '[class*="story-body"]','[class*="body-content"]',
      'main','[role="main"]','.content','#content',
    ]
    for (const sel of selectors) {
      const text = doc.querySelector(sel)?.textContent?.trim()
      if (text && text.length > 200) return cleanText(text)
    }
    const body = doc.body?.textContent?.trim()
    if (body && body.length > 200) return cleanText(body)
    return null
  } catch { return null }
}

function cleanText(text) {
  if (!text) return ''
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 5000)
}
