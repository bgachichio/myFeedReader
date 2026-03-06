// ── OPML Parser ─────────────────────────────────────────────────

export function parseOPML(xmlString) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'application/xml')

  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid OPML file. Please check the file and try again.')
  }

  const feeds = []

  // OPML feeds are <outline> elements with xmlUrl attribute
  // They may be nested inside category <outline> elements
  const outlines = doc.querySelectorAll('outline[xmlUrl]')

  outlines.forEach(outline => {
    const url = outline.getAttribute('xmlUrl')
    const title =
      outline.getAttribute('title') ||
      outline.getAttribute('text') ||
      url

    // Check if parent outline is a category folder
    const parent = outline.parentElement
    const parentText = parent?.getAttribute('text') || parent?.getAttribute('title') || ''
    const isParentFolder = parent?.tagName === 'outline' && !parent.getAttribute('xmlUrl')
    const category = isParentFolder ? parentText : 'General'

    if (url) {
      feeds.push({ url, title, category })
    }
  })

  if (feeds.length === 0) {
    throw new Error('No RSS feeds found in this OPML file.')
  }

  return feeds
}

// ── OPML Generator ───────────────────────────────────────────────

export function generateOPML(feeds) {
  // Group feeds by category
  const grouped = {}
  feeds.forEach(feed => {
    const cat = feed.category || 'General'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(feed)
  })

  const date = new Date().toUTCString()

  const categoryBlocks = Object.entries(grouped).map(([cat, items]) => {
    const outlines = items
      .map(f => `        <outline type="rss" text="${escapeXml(f.title)}" title="${escapeXml(f.title)}" xmlUrl="${escapeXml(f.url)}" />`)
      .join('\n')
    return `    <outline text="${escapeXml(cat)}" title="${escapeXml(cat)}">\n${outlines}\n    </outline>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>myFeedReader Export</title>
    <dateCreated>${date}</dateCreated>
  </head>
  <body>
${categoryBlocks}
  </body>
</opml>`
}

// ── CSV Generator ────────────────────────────────────────────────

export function generateCSV(feeds) {
  const header = 'Title,URL,Category,Added'
  const rows = feeds.map(f => {
    const title = `"${(f.title || '').replace(/"/g, '""')}"`
    const url = `"${(f.url || '').replace(/"/g, '""')}"`
    const category = `"${(f.category || '').replace(/"/g, '""')}"`
    const added = `"${f.created_at ? new Date(f.created_at).toLocaleDateString() : ''}"`
    return [title, url, category, added].join(',')
  })
  return [header, ...rows].join('\n')
}

// ── Download helper ──────────────────────────────────────────────

export function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function escapeXml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
