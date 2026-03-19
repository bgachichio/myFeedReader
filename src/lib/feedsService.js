import { supabase } from './supabase'
import { fetchFullText } from './fullText'

// ── Shared reading list invalidation signal ───────────────────────
// Increment this whenever reading list membership changes.
// ReadingListView watches this and reloads when it changes.
export const readingListSignal = { version: 0 }
export function invalidateReadingList() { readingListSignal.version++ }


// ── Folders ──────────────────────────────────────────────────────

export async function getFolders(userId) {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true })
  if (error) throw error
  return data
}

export async function createFolder(userId, name) {
  const { data: existing } = await supabase.from('folders').select('position').eq('user_id', userId).order('position', { ascending: false }).limit(1)
  const nextPos = existing?.[0]?.position != null ? existing[0].position + 1 : 0
  const { data, error } = await supabase.from('folders').insert([{ user_id: userId, name, position: nextPos }]).select().single()
  if (error) throw error
  return data
}

export async function updateFolder(folderId, updates) {
  const { data, error } = await supabase.from('folders').update(updates).eq('id', folderId).select().single()
  if (error) throw error
  return data
}

export async function deleteFolder(folderId) {
  // Feeds in this folder become unfiled (folder_id set to null via ON DELETE SET NULL)
  const { error } = await supabase.from('folders').delete().eq('id', folderId)
  if (error) throw error
}

export async function moveFeedToFolder(feedId, folderId) {
  const { data, error } = await supabase
    .from('feeds').update({ folder_id: folderId }).eq('id', feedId).select().single()
  if (error) throw error
  return data
}

// ── Feeds (sources) ──────────────────────────────────────────────

export async function getFeeds(userId) {
  const { data, error } = await supabase
    .from('feeds')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function addFeed({ userId, url, title, category, feedType = 'rss', folderId = null }) {
  const { data, error } = await supabase
    .from('feeds')
    .insert([{ user_id: userId, url, title, category, feed_type: feedType, folder_id: folderId }])
    .select().single()
  if (error) throw error
  return data
}

export async function deleteFeed(feedId) {
  const { error } = await supabase.from('feeds').delete().eq('id', feedId)
  if (error) throw error
}

export async function updateFeed(feedId, updates) {
  const { data, error } = await supabase
    .from('feeds').update(updates).eq('id', feedId).select().single()
  if (error) throw error
  return data
}

// Update feed health after a fetch attempt
export async function updateFeedHealth(feedId, { success, error: errorMsg, articleCount } = {}) {
  const updates = { last_fetched_at: new Date().toISOString() }
  if (success) {
    updates.last_error = null
    updates.error_count = 0
    if (articleCount != null) updates.article_count = articleCount
  } else {
    updates.last_error = errorMsg || 'Unknown error'
    // Increment error_count via RPC would be ideal but update works too
  }
  await supabase.from('feeds').update(updates).eq('id', feedId)
}

// ── Articles (cached items) ──────────────────────────────────────

const PAGE_SIZE = 20

export async function getArticles(userId, { category, limit = PAGE_SIZE, offset = 0, readFilter = 'unread', ascending = false } = {}) {
  // readFilter: 'unread' (default) | 'all' | 'read'
  let query = supabase
    .from('articles')
    .select('*, feeds(title, category, url)', { count: 'exact' })
    .eq('user_id', userId)
    .order('pub_date', { ascending })
    .range(offset, offset + limit - 1)

  if (category && category !== 'All') query = query.eq('category', category)
  if (readFilter === 'unread') query = query.eq('is_read', false)
  if (readFilter === 'read')   query = query.eq('is_read', true)

  const { data, error, count } = await query
  if (error) throw error
  return { articles: data, total: count, hasMore: offset + limit < count }
}

export async function markArticleUnread(articleId) {
  const { error } = await supabase.from('articles').update({ is_read: false }).eq('id', articleId)
  if (error) throw error
}

export async function markArticlesBulk(articleIds, isRead) {
  if (!articleIds.length) return
  const { error } = await supabase
    .from('articles')
    .update({ is_read: isRead })
    .in('id', articleIds)
  if (error) throw error
}

export async function upsertArticles(articles) {
  if (!articles.length) return
  // Deduplicate by user_id+guid before upserting
  const seen = new Set()
  const unique = articles.filter(a => {
    const key = `${a.user_id}:${a.guid}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Split into new vs existing articles
  // For NEW articles: full insert with all fields
  // For EXISTING articles: only update content fields (title, description, full_content, etc.)
  // NEVER overwrite user flags (is_read_later, is_bookmarked, is_read) on existing rows
  const { data: existing } = await supabase
    .from('articles')
    .select('guid, user_id')
    .eq('user_id', unique[0]?.user_id)
    .in('guid', unique.map(a => a.guid))

  const existingGuids = new Set((existing || []).map(r => r.guid))
  const newArticles = unique.filter(a => !existingGuids.has(a.guid))
  const updatedArticles = unique.filter(a => existingGuids.has(a.guid))

  // Insert brand new articles (all fields, flags default to false)
  if (newArticles.length) {
    const { error } = await supabase
      .from('articles')
      .insert(newArticles)
    if (error && !error.message?.includes('duplicate')) {
      console.warn('upsertArticles insert error:', error.message)
    }
  }

  // Update existing articles — only content fields, preserve all user flags
  if (updatedArticles.length) {
    await Promise.allSettled(updatedArticles.map(a =>
      supabase
        .from('articles')
        .update({
          title:        a.title,
          description:  a.description,
          author:       a.author,
          pub_date:     a.pub_date,
          link:         a.link,
          // Only update full_content if we actually have content
          ...(a.full_content ? { full_content: a.full_content } : {}),
        })
        .eq('user_id', a.user_id)
        .eq('guid', a.guid)
    ))
  }
}

export async function markArticleRead(articleId) {
  const { error } = await supabase.from('articles').update({ is_read: true }).eq('id', articleId)
  if (error) throw error
}

export async function toggleBookmark(articleId, current) {
  const { error } = await supabase.from('articles').update({ is_bookmarked: !current }).eq('id', articleId)
  if (error) throw error
}

export async function toggleReadLater(articleId, current, articleLink = null, storedContent = null) {
  const next = !current
  const { error, data } = await supabase
    .from('articles')
    .update({ is_read_later: next })
    .eq('id', articleId)
    .select('id, is_read_later')
  if (error) {
    console.error('toggleReadLater DB error:', error.message, error.code)
    throw error
  }
  if (!data || data.length === 0) {
    console.warn('toggleReadLater: no row updated — article id:', articleId, '— possible RLS block or wrong user')
  }
  // Invalidate ReadingListView cache so next navigation reloads immediately
  invalidateReadingList()
  // A3: When saving for later, fetch and store full content for offline reading
  if (next && articleLink) {
    fetchFullText(articleLink, storedContent).then(result => {
      if (result?.content) {
        supabase.from('articles').update({ full_content: result.content }).eq('id', articleId)
          .then(({ error }) => { if (error) console.warn('full_content update:', error.message) })
      }
    }).catch(() => {})  // non-fatal — article is saved, content is best-effort
  }
  return next
}

export async function getReadLaterArticles(userId, ascending = false) {
  const { data, error } = await supabase
    .from('articles').select('*, feeds(title, category, url)')
    .eq('user_id', userId).eq('is_read_later', true)
    .order('pub_date', { ascending })
  if (error) throw error
  return data
}

export async function getStats(userId) {
  const { data, error } = await supabase
    .from('articles')
    .select('is_read, is_bookmarked, is_read_later, category, pub_date, created_at')
    .eq('user_id', userId)
  if (error) throw error
  return data
}

// Bulk insert multiple feeds in a single Supabase call
// Returns array of saved feeds with IDs, in same order as input
export async function addFeedsBulk(feedRows) {
  if (!feedRows.length) return []
  const { data, error } = await supabase
    .from('feeds')
    .insert(feedRows)
    .select()
  if (error) throw error
  return data
}

export async function markAllArticlesRead(userId) {
  const { error } = await supabase
    .from('articles')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)
  if (error) throw error
}

// ── Bulk prefetch full text for Reading List articles ─────────────
// Runs after auto-refresh on app open and on manual Reading List refresh.
// Only fetches articles that don't already have full_content stored.
// Non-blocking: failures are silent, runs in background.
export async function prefetchReadingListContent(userId) {
  try {
    // Get Reading List articles missing full text
    const { data, error } = await supabase
      .from('articles')
      .select('id, link, full_content')
      .eq('user_id', userId)
      .eq('is_read_later', true)
      .or('full_content.is.null,full_content.eq.')
      .limit(20)  // Cap to avoid hammering proxies

    if (error || !data?.length) return

    // Fetch in batches of 3 (respect proxy rate limits)
    const BATCH = 3
    for (let i = 0; i < data.length; i += BATCH) {
      const batch = data.slice(i, i + BATCH)
      await Promise.allSettled(
        batch.map(async (article) => {
          try {
            const result = await fetchFullText(article.link, article.full_content)
            if (result?.content) {
              await supabase
                .from('articles')
                .update({ full_content: result.content })
                .eq('id', article.id)
            }
          } catch {} // Silent — never block
        })
      )
      // Small delay between batches to avoid overwhelming proxies
      if (i + BATCH < data.length) await new Promise(r => setTimeout(r, 800))
    }
  } catch {} // Entire function is non-fatal
}

// ── Storage management: prune old read articles ───────────────────
// Deletes articles that are:
//   - older than PRUNE_DAYS days
//   - marked as read (is_read = true)
//   - NOT bookmarked, NOT saved for later
// Keeps: unread, bookmarked, and saved-for-later articles indefinitely.
// Run silently after every upsertArticles call — never blocks the UI.
const PRUNE_DAYS = 30

export async function pruneOldArticles(userId) {
  try {
    const cutoff = new Date(Date.now() - PRUNE_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const { error, count } = await supabase
      .from('articles')
      .delete({ count: 'exact' })
      .eq('user_id', userId)
      .eq('is_read', true)
      .eq('is_bookmarked', false)
      .eq('is_read_later', false)
      .lt('pub_date', cutoff)
    if (error) console.warn('[pruneOldArticles]', error.message)
    else if (count > 0) console.log(`[pruneOldArticles] pruned ${count} old articles`)
  } catch (e) {
    console.warn('[pruneOldArticles] failed silently:', e.message)
  }
}

// ── Storage usage estimate ────────────────────────────────────────
// Returns approximate article count and estimated storage used.
// Useful for diagnostics in SettingsView.
export async function getStorageStats(userId) {
  const { count: articleCount } = await supabase
    .from('articles')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  const { count: savedCount } = await supabase
    .from('saved_articles')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  const { count: readCount } = await supabase
    .from('articles')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', true)
    .eq('is_bookmarked', false)
    .eq('is_read_later', false)

  return {
    articleCount: articleCount || 0,
    savedCount: savedCount || 0,
    prunableCount: readCount || 0,
    // Rough estimate: avg 3KB per article row (title + description + metadata)
    // full_content adds ~8KB when present but only for reading list items
    estimatedKB: Math.round(((articleCount || 0) * 3 + (savedCount || 0) * 10)),
  }
}
